/*!
 * dsh-mode-menu — browser half.
 *
 * A Claude-Code-style "Mode" menu in the composer: the session's permission
 * presets and Plan mode in one list, each with a description, a number key
 * and a check mark; Shift+Tab in the composer cycles the everyday modes.
 *
 * It only drives the host's own commands (`/permission <preset>`, `/plan`,
 * `/plan off`) and reads the `permissions` / `plan` projections. While mounted
 * it hides dsh's built-in access-mode control and plan chip; disable the
 * plugin and both come back. Composer layout, hints, the model menu and the
 * transcript view live in their own plugins now.
 */
part({
  id: 'dsh-mode-menu',
  factory(require, kit) {
    const { React, h, portal } = kit
    const { useState, useEffect, useRef, useCallback, useLayoutEffect, useSyncExternalStore } = React

    const NS = 'mode-menu'
    const PLAN = 'plan'
    const RISKY = new Set(['danger-full-access', 'auto'])

    const zh = {
      'title': '模式',
      'cycle': 'Shift+Tab 切换',
      'trigger': '模式：{name}（点击切换，Shift+Tab 循环）',
      'p.read-only': '仅可查看',
      'p.read-only.d': '只读取和分析，不修改任何文件',
      'p.workspace-write': '工作区内修改',
      'p.workspace-write.d': '可以修改工作区里的文件；越界操作会先问你',
      'p.danger-full-access': '完全权限',
      'p.danger-full-access.d': '不受沙箱限制，可修改任意文件、运行任意命令',
      'p.auto': '自动审查',
      'p.auto.d': '安全操作自动放行，危险或模糊的操作交给你确认',
      'p.custom': '自定义',
      'p.custom.d': '当前的沙箱和审批组合不对应任何预设',
      'plan': '计划模式',
      'plan.d': '先调研并写出计划，你批准后再动手',
      'plan.on': '计划',
      'exp': 'EXP',
      'confirm': '确认开启「{name}」？',
      'confirm.full': '智能体将能修改任意文件、运行任意命令，不再受工作区限制。',
      'confirm.auto': '实验功能：由审查器决定大部分操作是否放行。',
      'confirm.ok': '开启',
      'confirm.cancel': '取消',
      'failed': '切换失败：{msg}',
      'busy': '正在切换…',
    }
    const en = {
      'title': 'Mode',
      'cycle': 'Shift+Tab to cycle',
      'trigger': 'Mode: {name} (click to change, Shift+Tab to cycle)',
      'p.read-only': 'Read only',
      'p.read-only.d': 'Reads and analyses; never changes files',
      'p.workspace-write': 'Workspace write',
      'p.workspace-write.d': 'Edits files in the workspace; asks before going outside it',
      'p.danger-full-access': 'Full access',
      'p.danger-full-access.d': 'No sandbox: any file, any command',
      'p.auto': 'Auto review',
      'p.auto.d': 'Safe actions run on their own; risky or unclear ones ask you',
      'p.custom': 'Custom',
      'p.custom.d': 'The current sandbox and approval mix matches no preset',
      'plan': 'Plan mode',
      'plan.d': 'Research and write a plan first; act after you approve it',
      'plan.on': 'Plan',
      'exp': 'EXP',
      'confirm': 'Turn on "{name}"?',
      'confirm.full': 'The agent can change any file and run any command, outside the workspace too.',
      'confirm.auto': 'Experimental: a reviewer decides whether most actions may run.',
      'confirm.ok': 'Turn on',
      'confirm.cancel': 'Cancel',
      'failed': 'Could not switch: {msg}',
      'busy': 'Switching…',
    }
    const fmt = (s, p) => String(s).replace(/\{(\w+)\}/g, (_, k) => (p && p[k] !== undefined ? String(p[k]) : `{${k}}`))
    const FALLBACK = ['read-only', 'workspace-write', 'danger-full-access']

    // ------------------------------------------------------------------ glyphs
    const GLYPH = {
      'read-only': 'M8 2.2 13.4 4.2v3.4c0 3.3-2.3 5.3-5.4 6.3C4.9 12.9 2.6 10.9 2.6 7.6V4.2zM5.4 7.9h5.2M8 5.3v.01',
      'workspace-write': 'M8 2.2 13.4 4.2v3.4c0 3.3-2.3 5.3-5.4 6.3C4.9 12.9 2.6 10.9 2.6 7.6V4.2zM5.6 8.1l1.7 1.7 3.1-3.3',
      'danger-full-access': 'M8 2.2 13.4 4.2v3.4c0 3.3-2.3 5.3-5.4 6.3C4.9 12.9 2.6 10.9 2.6 7.6V4.2zM8 5.2v3.4M8 10.6v.01',
      'auto': 'M8 2.2 13.4 4.2v3.4c0 3.3-2.3 5.3-5.4 6.3C4.9 12.9 2.6 10.9 2.6 7.6V4.2zM5.6 9.6 8 5.4l2.4 4.2z',
      [PLAN]: 'M3.5 3.5h9v9h-9zM5.8 6.3h4.4M5.8 8.3h4.4M5.8 10.3h2.6',
      custom: 'M8 2.2 13.4 4.2v3.4c0 3.3-2.3 5.3-5.4 6.3C4.9 12.9 2.6 10.9 2.6 7.6V4.2z',
    }
    function Glyph({ id, size = 15 }) {
      return h('svg', { viewBox: '0 0 16 16', width: size, height: size, 'aria-hidden': true, className: 'dmm-glyph' },
        h('path', { d: GLYPH[id] || GLYPH.custom, fill: 'none', stroke: 'currentColor', strokeWidth: 1.25, strokeLinecap: 'round', strokeLinejoin: 'round' }))
    }


    // ------------------------------------------------------------------ styles
    const { ensure: ensureStyle, remove: removeStyle } = kit.sheet('mode-menu', CSS_MODE_MENU)

    // ------------------------------------------------------------------ catalog
    /** Process-wide permission catalog (the presets the host offers), refreshed on change. */
    function createCatalog(ctx) {
      let value: PermissionCatalog | null = null
      const subs = new Set<() => void>()
      const emit = () => { for (const fn of subs) fn() }
      let seq = 0
      const load = () => {
        const mine = ++seq
        let p
        try { p = ctx.remote?.permissionPresets?.catalog?.() } catch { p = undefined }
        if (!p || typeof p.then !== 'function') return
        p.then((r) => {
          if (mine !== seq) return
          if (r && r.ok && r.value && Array.isArray(r.value.options)) { value = r.value; emit() }
        }, () => {})
      }
      load()
      let off = null
      try { off = ctx.remote?.$on?.('permission-presets/catalog-changed', load) } catch {}
      return {
        subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn) },
        get: () => value,
        dispose: () => { try { typeof off === 'function' && off() } catch {} },
      }
    }

    function safeProjection(props, name) {
      try { return typeof props.useProjection === 'function' ? props.useProjection(name) : undefined } catch { return undefined }
    }

    // ------------------------------------------------------------------ the menu
    function ModeMenu(props) {
      const { ctx, t, catalog } = props
      useSyncExternalStore(useCallback((fn) => ctx.locale.subscribe(fn), [ctx]), () => ctx.locale.getSnapshot())
      const cat = useSyncExternalStore<PermissionCatalog | null>(catalog.subscribe, catalog.get)
      const perm = safeProjection(props, 'permissions')
      const plan = safeProjection(props, 'plan')
      const sessionId = typeof props.sessionId === 'string' ? props.sessionId : ''
      const [open, setOpen] = useState(false)
      const [pos, setPos] = useState(null)
      const [confirm, setConfirm] = useState(null)
      const [busy, setBusy] = useState(false)
      const [error, setError] = useState(null)
      const [kbd, setKbd] = useState(-1)
      const btnRef = useRef(null)
      const popRef = useRef(null)
      useLayoutEffect(ensureStyle, [])

      const planOn = !!plan && (plan.pending ? !plan.active : !!plan.active)
      const current = perm?.currentValue
      const presets = (cat?.options?.length ? cat.options.map((o) => ({ id: o.value, name: o.name, hostDesc: o.description })) : FALLBACK.map((id) => ({ id })))
      const label = (p) => {
        const k = `p.${p.id}`
        const v = t(k)
        return v === k ? (p.name || p.id.replace(/(^|-)(\w)/g, (_, s, c) => `${s ? ' ' : ''}${c.toUpperCase()}`)) : v
      }
      const desc = (p) => {
        const k = `p.${p.id}.d`
        const v = t(k)
        return v === k ? (p.hostDesc || '') : v
      }
      const currentPreset = presets.find((p) => p.id === current) || (current ? { id: current } : null)
      const items: ModeItem[] = [...presets.map((p) => ({ kind: 'perm' as const, ...p })), { kind: 'plan', id: PLAN }]

      const run = useCallback(async (line) => {
        const res = await ctx.remote.commands.execute(sessionId, line, [])
        if (!res || !res.ok) throw new Error(res?.error ? `${res.error.message} (${res.error.code})` : 'unknown error')
        if (res.value === undefined) throw new Error(`unknown command: ${line}`)
      }, [ctx, sessionId])

      const act = useCallback(async (fn) => {
        setBusy(true)
        setError(null)
        try { await fn(); return true } catch (e) { setError(String(e?.message || e)); return false } finally { setBusy(false) }
      }, [])

      const choose = (item: ModeItem, confirmed = false) => {
        if (busy) return
        if (item.kind === 'plan') {
          act(() => run(planOn ? '/plan off' : '/plan'))
          return
        }
        if (item.id === current) { setOpen(false); return }
        if (RISKY.has(item.id) && !confirmed) { setConfirm(item); return }
        setConfirm(null)
        act(() => run(`/permission ${item.id}`)).then((ok) => { if (ok) setOpen(false) })
      }

      // Shift+Tab in this composer cycles the everyday modes (never into a risky one):
      // workspace write → plan → read only → workspace write …
      useEffect(() => {
        if (!sessionId || !perm) return undefined
        const onKey = (e) => {
          if (e.key !== 'Tab' || !e.shiftKey || e.altKey || e.metaKey || e.ctrlKey || e.isComposing) return
          const seat = btnRef.current?.closest(SEL.seat) || btnRef.current?.closest('[data-slot="conversation.composer"]')
          if (!seat || !seat.contains(document.activeElement)) return
          e.preventDefault()
          e.stopPropagation()
          if (busy) return
          const has = (id) => presets.some((p) => p.id === id)
          if (planOn) act(async () => { await run('/plan off'); if (has('read-only') && current !== 'read-only') await run('/permission read-only') })
          else if (current === 'read-only') act(() => run(has('workspace-write') ? '/permission workspace-write' : '/plan'))
          else act(() => run('/plan'))
        }
        document.addEventListener('keydown', onKey, true)
        return () => document.removeEventListener('keydown', onKey, true)
      }, [sessionId, perm, planOn, current, busy, presets.length, act, run])

      const place = useCallback(() => {
        const el = btnRef.current
        if (!el) return
        const r = el.getBoundingClientRect()
        const width = Math.min(350, window.innerWidth - 24)
        const left = Math.max(12, Math.min(r.right - width + 4, window.innerWidth - width - 12))
        const bottom = Math.max(12, window.innerHeight - r.top + 8)
        setPos((o) => (o && o.left === left && o.bottom === bottom && o.width === width ? o : { left, bottom, width }))
      }, [])

      useLayoutEffect(() => { if (open) place() }, [open, place])

      // latest menu state for the open-menu listeners, so they subscribe once per open / close
      // instead of on every render (the handlers read live.current rather than a stale closure)
      const live = useRef(null)
      live.current = { confirm, kbd, items, choose }

      useLayoutEffect(() => {
        if (!open) {
          if (confirm) setConfirm(null)
          if (kbd !== -1) setKbd(-1)
          return undefined
        }
        const onDown = (e) => {
          if (popRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return
          setOpen(false)
        }
        const onKey = (e) => {
          const { confirm, kbd, items, choose } = live.current
          if (e.key === 'Escape') { e.preventDefault(); if (confirm) setConfirm(null); else { setOpen(false); btnRef.current?.focus() } return }
          if (confirm) { if (e.key === 'Enter') { e.preventDefault(); choose(confirm, true) } return }
          const n = Number(e.key)
          if (n >= 1 && n <= items.length && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); choose(items[n - 1]); return }
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            setKbd((k) => (k + (e.key === 'ArrowDown' ? 1 : items.length - 1) + (k < 0 && e.key === 'ArrowUp' ? 1 : 0)) % items.length)
            return
          }
          if (e.key === 'Enter' && kbd >= 0) { e.preventDefault(); choose(items[kbd]) }
        }
        window.addEventListener('resize', place)
        document.addEventListener('mousedown', onDown, true)
        document.addEventListener('keydown', onKey, true)
        return () => {
          window.removeEventListener('resize', place)
          document.removeEventListener('mousedown', onDown, true)
          document.removeEventListener('keydown', onKey, true)
        }
      }, [open, place])

      if (!sessionId || !perm) return null
      const curLabel = currentPreset ? label(currentPreset) : '—'
      const trigLabel = planOn ? h(React.Fragment, null, h('span', null, t('plan.on')), h('span', { className: 'sep' }, '·'), h('span', null, curLabel)) : h('span', null, curLabel)
      const locked = !!props.locked
      return h(React.Fragment, null,
        h('button', {
          ref: btnRef, type: 'button',
          className: `dmm-trigger${planOn ? ' plan' : ''}${RISKY.has(current) ? ' risky' : ''}`,
          'aria-haspopup': 'menu', 'aria-expanded': open,
          'aria-label': fmt(t('trigger'), { name: planOn ? `${t('plan')} · ${curLabel}` : curLabel }),
          title: fmt(t('trigger'), { name: planOn ? `${t('plan')} · ${curLabel}` : curLabel }),
          disabled: locked,
          onClick: () => setOpen((v) => !v),
        },
          h(Glyph, { id: planOn ? PLAN : current }),
          trigLabel,
          h('svg', { className: 'dmm-chev', viewBox: '0 0 16 16', width: 12, height: 12, 'aria-hidden': true }, h('path', { d: 'M4.5 6.5 8 10l3.5-3.5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' }))),
        open && pos ? portal(h('div', {
          ref: popRef, className: 'dmm-pop notranslate', translate: 'no', role: 'menu',
          style: { left: pos.left, bottom: pos.bottom, width: pos.width },
        },
          // no 「模式 · Shift+Tab 切换」 header: the shortcut lives in the trigger's tooltip
          items.map((it, i) => {
            const isPlan = it.kind === 'plan'
            const on = isPlan ? planOn : it.id === current
            const row = h('button', {
              key: it.id, type: 'button', role: isPlan ? 'menuitemcheckbox' : 'menuitemradio', 'aria-checked': on,
              className: `dmm-item${isPlan ? ' plan' : ''}${on ? ' on' : ''}${kbd === i ? ' kbd' : ''}`,
              disabled: busy, onMouseEnter: () => setKbd(-1),
              onClick: () => choose(it),
            },
              h(Glyph, { id: it.id }),
              h('span', { className: 'txt' },
                h('span', { className: 'lbl' }, isPlan ? t('plan') : label(it), it.id === 'auto' ? h('span', { className: 'dmm-badge' }, t('exp')) : null),
                h('span', { className: 'desc' }, isPlan ? t('plan.d') : desc(it))),
              isPlan ? h('span', { className: `dmm-sw${on ? ' on' : ''}`, 'aria-hidden': true })
                : h('span', { className: 'chk' }, on ? h('svg', { viewBox: '0 0 16 16', width: 15, height: 15, 'aria-hidden': true }, h('path', { d: 'M3.5 8.4 6.6 11.4 12.5 4.8', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' })) : null))
            return h(React.Fragment, { key: it.id }, isPlan ? h('div', { className: 'dmm-div' }) : null, row,
              confirm && confirm.id === it.id ? h('div', { className: 'dmm-confirm', role: 'alertdialog' },
                h('b', null, fmt(t('confirm'), { name: label(it) })),
                h('p', null, it.id === 'auto' ? t('confirm.auto') : t('confirm.full')),
                h('div', { className: 'row' },
                  h('button', { type: 'button', className: 'dmm-btn', onClick: () => setConfirm(null) }, t('confirm.cancel')),
                  h('button', { type: 'button', className: 'dmm-btn warn', autoFocus: true, onClick: () => choose(it, true) }, t('confirm.ok')))) : null)
          }),
          busy ? h('div', { className: 'dmm-note' }, t('busy')) : null,
          error ? h('div', { className: 'dmm-note err' }, fmt(t('failed'), { msg: error })) : null)) : null)
    }

    // ------------------------------------------------------------------ registration
    return {
      inject: ['slots', 'locale', 'remote', 'remote.commands', 'remote.permissionPresets'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'mode-menu: dictionaries')
        const t = ctx.locale.bind(NS)
        const catalog = createCatalog(ctx)
        ctx.effect(() => () => { catalog.dispose(); removeStyle() }, 'mode-menu: catalog and styles')
        function Slot(props) {
          return h(ModeMenu, { ...props, ctx, t, catalog })
        }
        ctx.slots.inject('conversation.input.permission', () => ctx.slots.register({
          name: 'conversation.input.permission',
          id: 'mode-menu',
          priority: -100,
          order: -100,
          label: () => t('title'),
        }, Slot))
      },
    }
  },
})
