/* Offline test harness for dsh-composer-display.
 * Real React 18.3.1 + a faithful mock of dsh's composer DOM contract, slot system, locale, remote
 * commands / permission catalog, model directories and projections. The plugin's own code (observers,
 * hub gating, highlight ranges, caret, menus, anchoring) runs for real; only dsh's shell is approximated. */
;(() => {
  const React = window.React
  const ReactDOM = window.ReactDOM
  const h = React.createElement
  const { useState, useEffect, useRef, useSyncExternalStore } = React

  /* A hidden page (background tab / headless) never fires requestAnimationFrame and throttles
   * setTimeout / setInterval to ~1s, which would stall the plugin's frame-coalesced hub, its
   * debounces and these scenarios. Drive all timers and frames from a Worker tick (workers are not
   * background-throttled) at their intended delays, so ordering and coalescing stay faithful while
   * the suite runs promptly regardless of visibility. */
  ;(() => {
    const tasks = new Map(); let seq = 1
    const blob = new Blob(['setInterval(()=>postMessage(0),4)'], { type: 'text/javascript' })
    const worker = new Worker(URL.createObjectURL(blob))
    const due = () => {
      const now = performance.now()
      for (const [id, t] of [...tasks]) if (t.at <= now) { tasks.delete(id); try { t.fn(now) } catch (e) { console.error(e) } }
    }
    worker.onmessage = due
    const set = (fn, ms) => { const id = seq++; tasks.set(id, { fn, at: performance.now() + (ms || 0) }); return id }
    const clear = (id) => { tasks.delete(id) }
    window.setTimeout = set
    window.clearTimeout = clear
    window.requestAnimationFrame = (fn) => set(fn, 16)
    window.cancelAnimationFrame = clear
    window.setInterval = (fn, ms) => {
      const id = seq++
      const wrap = () => { tasks.set(id, { fn: wrap, at: performance.now() + (ms || 0) }); fn() }
      tasks.set(id, { fn: wrap, at: performance.now() + (ms || 0) })
      return id
    }
    window.clearInterval = clear
    // a focused app window is what the caret guards on; a headless hidden page reports false, so
    // simulate the focused window the plugin is meant to run in
    document.hasFocus = () => true
  })()

  /* ResizeObserver callbacks are delivered on the browser's rendering steps, which never run on a
   * hidden page. Poll observed boxes on the (unthrottled) timer instead, reading sizes through the
   * original getters so the poll itself is not counted as a forced layout by the metrics below. */
  ;(() => {
    const cw = Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth').get
    const ch = Object.getOwnPropertyDescriptor(Element.prototype, 'clientHeight').get
    window.ResizeObserver = class {
      constructor(cb) { this.cb = cb; this.els = new Map(); this._id = setInterval(() => this._check(), 16) }
      observe(el) { this.els.set(el, { w: cw.call(el), h: ch.call(el) }) }
      unobserve(el) { this.els.delete(el) }
      disconnect() { this.els.clear(); clearInterval(this._id) }
      _check() {
        const entries = []
        for (const [el, prev] of this.els) {
          const w = cw.call(el), h = ch.call(el)
          if (w !== prev.w || h !== prev.h) { this.els.set(el, { w, h }); entries.push({ target: el, contentRect: { width: w, height: h } }) }
        }
        if (entries.length) { try { this.cb(entries, this) } catch (e) { console.error(e) } }
      }
    }
  })()

  /* ---------------- instrumentation ---------------- */
  const M = { reflow: 0, moCallbacks: 0, moInstances: 0, longTasks: [], frames: [], errors: [], measuring: false }
  window.addEventListener('error', (e) => M.errors.push(String(e.message || e.error)))
  window.addEventListener('unhandledrejection', (e) => M.errors.push('rejection: ' + String(e.reason)))
  const origCE = console.error
  console.error = (...a) => { M.errors.push(a.map((x) => (x && x.message) || String(x)).join(' ')); origCE.apply(console, a) }
  const patchGetter = (proto, name) => {
    const d = Object.getOwnPropertyDescriptor(proto, name)
    if (!d || !d.get) return
    Object.defineProperty(proto, name, { configurable: true, get() { if (M.measuring) M.reflow++; return d.get.call(this) } })
  }
  for (const n of ['offsetHeight', 'offsetWidth', 'clientHeight', 'clientWidth', 'scrollTop', 'scrollHeight']) patchGetter(HTMLElement.prototype, n)
  const wrapMethod = (proto, name) => { const orig = proto[name]; proto[name] = function (...a) { if (M.measuring) M.reflow++; return orig.apply(this, a) } }
  wrapMethod(Element.prototype, 'getClientRects')
  wrapMethod(Element.prototype, 'getBoundingClientRect')
  const NativeMO = window.MutationObserver
  window.MutationObserver = class extends NativeMO {
    constructor(cb) { M.moInstances++; super((...a) => { if (M.measuring) M.moCallbacks++; return cb(...a) }) }
  }
  try {
    const po = new PerformanceObserver((list) => { for (const e of list.getEntries()) if (M.measuring) M.longTasks.push({ start: Math.round(e.startTime), dur: Math.round(e.duration) }) })
    po.observe({ entryTypes: ['longtask'] })
  } catch {}
  function resetMetrics() { M.reflow = 0; M.moCallbacks = 0; M.longTasks = []; M.frames = []; M.errors = [] }
  function snapshot() {
    const lt = M.longTasks
    const sum = lt.reduce((a, b) => a + b.dur, 0)
    const max = lt.reduce((a, b) => Math.max(a, b.dur), 0)
    const frames = M.frames
    const avgFrame = frames.length ? frames.reduce((a, b) => a + b, 0) / frames.length : 0
    const jank = frames.filter((d) => d > 32).length
    return { reflow: M.reflow, moCallbacks: M.moCallbacks, moInstances: M.moInstances, longTasks: lt.length, longTaskMs: sum, longTaskMax: max, avgFrame: +avgFrame.toFixed(1), jankFrames: jank, errors: M.errors.slice() }
  }

  /* ---------------- mock locale ---------------- */
  const locale = {
    _dicts: new Map(), _lang: 'zh', _subs: new Set(),
    register(ns, d) { this._dicts.set(ns, d); return () => this._dicts.delete(ns) },
    bind(ns) { const self = this; return (k) => { const d = self._dicts.get(ns); return (d && d[self._lang] && d[self._lang][k] !== undefined) ? d[self._lang][k] : k } },
    resolveText(x) { return typeof x === 'string' ? x : (x && x[this._lang]) || '' },
    subscribe(fn) { this._subs.add(fn); return () => this._subs.delete(fn) },
    getSnapshot() { return this._lang },
    setLang(l) { this._lang = l; document.documentElement.lang = l; for (const fn of [...this._subs]) fn() },
  }

  /* ---------------- mock projections ---------------- */
  const proj = {
    _v: { permissions: { currentValue: 'workspace-write', pending: null }, plan: { active: false, pending: false } },
    _subs: new Set(),
    get(name) { return this._v[name] },
    set(name, v) { this._v = { ...this._v, [name]: v }; for (const fn of [...this._subs]) fn() },
    subscribe(fn) { this._subs.add(fn); return () => this._subs.delete(fn) },
  }
  function useProjection(name) {
    return useSyncExternalStore((fn) => proj.subscribe(fn), () => proj.get(name))
  }

  /* ---------------- mock remote ---------------- */
  const commandLog = []
  const remote = {
    commands: {
      async execute(sessionId, line) {
        commandLog.push(line)
        const m = /^\/permission\s+(\S+)$/.exec(line)
        if (m) { proj.set('permissions', { currentValue: m[1], pending: null }); return { ok: true, value: {} } }
        if (line === '/plan') { proj.set('plan', { active: true, pending: false }); return { ok: true, value: {} } }
        if (line === '/plan off') { proj.set('plan', { active: false, pending: false }); return { ok: true, value: {} } }
        return { ok: true, value: {} }
      },
    },
    permissionPresets: {
      async catalog() {
        return { ok: true, value: { options: [
          { value: 'read-only', name: 'Read only', description: 'host read-only' },
          { value: 'workspace-write', name: 'Workspace write', description: 'host workspace' },
          { value: 'danger-full-access', name: 'Full access', description: 'host full' },
          { value: 'auto', name: 'Auto review', description: 'host auto' },
        ] } }
      },
    },
    _handlers: new Map(),
    $on(evt, fn) { const s = this._handlers.get(evt) || new Set(); s.add(fn); this._handlers.set(evt, s); return () => s.delete(fn) },
    emit(evt) { for (const fn of [...(this._handlers.get(evt) || [])]) fn() },
  }

  /* ---------------- mock model directories ---------------- */
  function makeDir() {
    const subs = new Set()
    const models = [
      { id: 'deepseek-chat', name: 'DeepSeek Chat', reasoning: { defaultEffort: 'low', efforts: [{ id: 'low', name: 'Low', description: 'fast' }, { id: 'medium', name: 'Medium', description: 'balanced' }, { id: 'high', name: 'High', description: 'deep' }] } },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', badge: { tone: 'info', text: 'R1' } },
      { id: 'deepseek-coder', name: 'DeepSeek Coder' },
      { id: 'deepseek-v3', name: 'DeepSeek V3' },
      { id: 'deepseek-lite', name: 'DeepSeek Lite' },
      { id: 'deepseek-pro', name: 'DeepSeek Pro' },
    ]
    const st = { groups: [{ id: 'deepseek-official', name: 'DeepSeek', models }], current: { provider: 'deepseek-official', model: 'deepseek-chat', reasoningEffort: 'low' }, pending: null, status: 'idle', retainedEffort: null, error: null }
    const emit = () => { for (const fn of [...subs]) fn() }
    return {
      store: { subscribe(fn) { subs.add(fn); return () => subs.delete(fn) }, getSnapshot() { return st } },
      async load() { st.status = 'idle'; emit() },
      async select(sel) {
        st.status = 'selecting'; st.pending = sel; emit()
        await new Promise((r) => setTimeout(r, 10))
        st.current = { provider: sel.provider, model: sel.model, reasoningEffort: sel.reasoningEffort }; st.pending = null; st.status = 'idle'; emit()
        return { ok: true }
      },
      _st: st,
    }
  }
  const dir = makeDir()
  const modelDirectories = { directoryFor: () => dir }
  const sessions = { subagentAddress: () => undefined }

  /* ---------------- mock slots ---------------- */
  function makeSlots() {
    const byName = new Map()
    const subs = new Map()
    const notify = (name) => { for (const fn of subs.get(name) || []) fn() }
    return {
      entries(name) { return byName.get(name) || [] },
      register(opts, component) {
        const entry = { name: opts.name, options: opts, component }
        const list = byName.get(opts.name) || []
        const i = list.findIndex((e) => e.options && e.options.id && e.options.id === opts.id)
        if (i >= 0) list[i] = entry; else list.push(entry)
        list.sort((a, b) => (b.options.priority || 0) - (a.options.priority || 0) || (b.options.order || 0) - (a.options.order || 0))
        byName.set(opts.name, list)
        notify(opts.name)
        return () => { const l = byName.get(opts.name) || []; const j = l.indexOf(entry); if (j >= 0) l.splice(j, 1); notify(opts.name) }
      },
      inject(name, fn) { try { fn() } catch (e) { console.error(e) } return () => {} },
      subscribe(name, fn) { const s = subs.get(name) || new Set(); s.add(fn); subs.set(name, s); return () => s.delete(fn) },
      renderSlot(name, props) { const e = (byName.get(name) || [])[0]; return e && e.component ? h(e.component, props) : null },
      renderSlotAll(name, props) { return (byName.get(name) || []).map((e, i) => e.component ? h(e.component, { ...props, key: e.options.id || i }) : null) },
    }
  }

  /* ---------------- mock ctx ---------------- */
  let ctx = null
  function makeCtx() {
    const slots = makeSlots()
    const cleanups = []
    const injected = []
    return {
      slots, locale, remote, modelDirectories, sessions,
      effect(fn, label) { const c = fn(); if (typeof c === 'function') cleanups.push(c); return c },
      inject(deps, fn) { try { fn(this) } catch (e) { console.error(e) } const off = () => {}; injected.push(off); return off },
      _cleanups: cleanups,
    }
  }

  /* ---------------- module loader + require ---------------- */
  const factories = new Map()
  window.__ModuleLoader__ = { load({ id, factory }) { factories.set(id, factory) } }
  const modules = { react: React, 'react-dom': ReactDOM, 'react/jsx-runtime': { jsx: h, jsxs: h, Fragment: React.Fragment } }
  const require = (id) => { if (id in modules) return modules[id]; throw new Error('harness: unknown require ' + id) }

  /* ---------------- mock composer shell ---------------- */
  const SEND_PATH = 'M8.3125 0.98L15 8l-1.4 1.4-4.6-4.6V15H7V4.8L2.4 9.4 1 8z'
  function Composer() {
    const [, force] = useState(0)
    useEffect(() => {
      const names = ['conversation.input.permission', 'conversation.input.model', 'conversation.composer.dock', 'conversation.input.plan']
      const offs = names.map((n) => ctx.slots.subscribe(n, () => force((x) => x + 1)))
      return () => offs.forEach((f) => f())
    }, [])
    const slotProps = { sessionId: 'sess-1', useProjection, locked: false }
    return h('div', { 'data-composer-seat': '', id: 'seat' },
      h('div', { className: '_root_x', id: 'root' },
        h('div', { 'data-composer-card': '', id: 'card' },
          h('div', { 'data-composer-overlay': '' }),
          h('div', { 'data-slot': 'conversation.input.attachments' }),
          h('div', { className: '_row_x', 'data-model-compact': '' },
            h('div', { className: '_tools_x' },
              h('button', { type: 'button', className: '_add_x', 'aria-label': '添加' }, h('svg', { viewBox: '0 0 16 16' }, h('path', { d: 'M8 3v10M3 8h10' }))),
              h('div', { className: '_modes_x' }, h('div', { 'data-slot': 'conversation.input.permission' }, ctx.slots.renderSlot('conversation.input.permission', slotProps))),
              h('div', { 'data-slot': 'conversation.input.left' })),
            h('div', { className: '_trailing_x' },
              h('div', { className: '_standardControls_x' }, ctx.slots.renderSlot('conversation.input.model', slotProps)),
              h('button', { type: 'button', className: '_primary_x', id: 'send', 'aria-label': '发送' }, h('svg', { viewBox: '0 0 16 16' }, h('path', { d: SEND_PATH }))))),
          h('div', { 'data-input-scroll': '', id: 'inputScroll' },
            h('div', { 'data-composer-input': '', contentEditable: true, id: 'input', 'data-placeholder': '发消息，/ 调用指令，@ 引用文件或对话', suppressContentEditableWarning: true }),
            h('div', { 'data-composer-placeholder': '', id: 'placeholder' }))),
        h('div', { 'data-composer-dock': '', id: 'dock' },
          h('div', { 'data-slot': 'conversation.composer.dock' }, ctx.slots.renderSlotAll('conversation.composer.dock', slotProps)),
          h('div', { 'data-composer-stat': 'activity' }, 'activity'),
          h('div', { 'data-composer-stat': 'usage' }, 'usage'),
          h('div', { id: 'meterSeat' }, h('button', { type: 'button', id: 'meterBtn', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, h('svg', { viewBox: '0 0 16 16', width: 14, height: 14 }, h('circle', { cx: 8, cy: 8, r: 6, fill: 'none', stroke: 'currentColor', strokeWidth: 2 })))))))
  }

  /* ---------------- boot / dispose ---------------- */
  const seatHost = document.getElementById('seatHost')
  const root = ReactDOM.createRoot(seatHost)
  let booted = false
  function renderComposer() { root.render(h(Composer)) }
  function boot() {
    ctx = makeCtx()
    // dsh owns the 'conversation' dictionary; the hints part only swaps display while dsh shows its
    // default placeholder, so the harness must provide that default for the comparison to match.
    ctx.locale.register('conversation', {
      zh: { 'placeholder.default': '发消息，/ 调用指令，@ 引用文件或对话' },
      en: { 'placeholder.default': 'Message, / for commands, @ for files or sessions' },
    })
    renderComposer()
    const factory = factories.get('dsh-composer-display')
    if (!factory) throw new Error('plugin factory not registered')
    const mod = factory(require)
    mod.inject // merged inject list (informational)
    mod.apply(ctx)
    renderComposer()
    booted = true
    return ctx
  }
  function dispose() {
    if (!ctx) return
    for (const c of [...ctx._cleanups].reverse()) { try { c() } catch (e) { console.error(e) } }
    ctx._cleanups.length = 0
    root.render(null)
    booted = false
  }

  /* ---------------- helpers ---------------- */
  const $ = (s) => document.querySelector(s)
  const $$ = (s) => [...document.querySelectorAll(s)]
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const raf = () => new Promise((r) => requestAnimationFrame(() => r()))
  function setInput(html) { const el = $('#input'); el.innerHTML = html; el.dispatchEvent(new Event('input', { bubbles: true })) }
  function focusInput() { const el = $('#input'); el.focus(); const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new Event('selectionchange')) }
  function setRunning(v) {
    const btn = $('#send')
    if (v) { btn.setAttribute('aria-label', '停止'); btn.innerHTML = '<svg viewBox="0 0 16 16"><rect x="4" y="4" width="8" height="8" rx="2"/></svg>' }
    else { btn.setAttribute('aria-label', '发送'); btn.innerHTML = `<svg viewBox="0 0 16 16"><path d="${SEND_PATH}"/></svg>` }
  }
  function mountToBottom() {
    let slot = $('#toBottom')
    if (!slot) { slot = document.createElement('div'); slot.className = '_toBottomSlot_x'; slot.id = 'toBottom'; slot.innerHTML = '<button type="button" aria-label="回到底部"><svg viewBox="0 0 16 16"><path d="M8 3v10"/></svg></button>'; $('#scroller').appendChild(slot) }
    slot.style.display = ''
    return slot
  }
  function unmountToBottom() { const s = $('#toBottom'); if (s) s.remove() }
  function openMeter() {
    $('#meterBtn').setAttribute('aria-expanded', 'true')
    let panel = $('#meterPanel')
    if (!panel) { panel = document.createElement('div'); panel.id = 'meterPanel'; panel.setAttribute('role', 'dialog'); panel.style.cssText = 'position:fixed;top:100px;left:900px;width:220px;--dsh-anchored-max-width:320px'; panel.textContent = 'context'; document.body.appendChild(panel) }
    return panel
  }
  function closeMeter() { $('#meterBtn').setAttribute('aria-expanded', 'false'); const p = $('#meterPanel'); if (p) p.remove() }

  /* ---------------- public API ---------------- */
  window.H = {
    React, h, M, locale, remote, proj, dir, commandLog,
    boot, dispose, renderComposer, resetMetrics, snapshot,
    $, $$, wait, raf, setInput, focusInput, setRunning, mountToBottom, unmountToBottom, openMeter, closeMeter,
    get ctx() { return ctx }, get booted() { return booted },
    measure: {
      start() { resetMetrics(); M.measuring = true; this._last = performance.now(); this._raf() },
      _raf() { if (!M.measuring) return; const now = performance.now(); M.frames.push(now - this._last); this._last = now; requestAnimationFrame(() => this._raf()) },
      stop() { M.measuring = false; return snapshot() },
    },
  }
})()