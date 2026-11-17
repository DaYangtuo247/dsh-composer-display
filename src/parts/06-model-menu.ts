/*!
 * dsh-model-menu — browser half.
 *
 * A Claude-style model menu in the composer: the current provider's top five
 * models (number keys), an Effort pane with descriptions, and a searchable
 * "More models" pane. Reads and writes the per-session model directory that
 * dsh's own seat and /model use, so either place reflects the other.
 */
part({
  id: 'dsh-model-menu',
  factory(require, kit) {
    const { React, h, portal } = kit
    const { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo, useSyncExternalStore } = React

    const NS = 'model-menu'
    const zh: Record<string, string> = {
      'm.title': '模型',
      'm.effort': '推理等级',
      'm.more': '更多模型',
      'm.search': '搜索模型',
      'm.none': '没有匹配的模型',
      'm.empty': '没有可用的模型',
      'm.loading': '加载中…',
      'm.pick': '选择模型',
      'm.trigger': '模型：{name}',
      'm.account': 'DeepSeek 账号',
      'm.failed': '切换失败：{msg}',
      'm.inUse': '会话被另一个 DSH 实例占用，请先退出其它实例再试',
    }
    const en: Record<string, string> = {
      'm.title': 'Model',
      'm.effort': 'Effort',
      'm.more': 'More models',
      'm.search': 'Search models',
      'm.none': 'No matching models',
      'm.empty': 'No models available',
      'm.loading': 'Loading…',
      'm.pick': 'Select model',
      'm.trigger': 'Model: {name}',
      'm.account': 'DeepSeek Account',
      'm.failed': 'Could not switch: {msg}',
      'm.inUse': 'Another DSH instance holds this session — quit it and retry',
    }
    zh.busy = '正在切换…'
    en.busy = 'Switching…'
    const fmt = (s, p) => String(s).replace(/\{(\w+)\}/g, (_, k) => (p && p[k] !== undefined ? String(p[k]) : `{${k}}`))

    // ------------------------------------------------------------------ styles
    const { ensure: ensureStyle, remove: removeStyle } = kit.sheet('model-menu', CSS_MODEL_MENU)

    const TOP_N = 5
    const Check = () => h('svg', { viewBox: '0 0 16 16', width: 15, height: 15, 'aria-hidden': true }, h('path', { d: 'M3.5 8.4 6.6 11.4 12.5 4.8', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }))
    const Chevron = ({ dir = 'right' }) => h('svg', { viewBox: '0 0 16 16', width: 13, height: 13, 'aria-hidden': true, className: `dmd-mchev ${dir}` }, h('path', { d: dir === 'left' ? 'M9.5 4 5.5 8l4 4' : 'M6.5 4l4 4-4 4', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }))
    const fuzzy = (name, q) => {
      if (!q) return true
      const s = name.toLowerCase()
      let i = 0
      for (const ch of q.toLowerCase()) { i = s.indexOf(ch, i); if (i < 0) return false; i++ }
      return true
    }

    function ModelMenu(props) {
      const { ctx, t, models, sessions } = props
      useSyncExternalStore(useCallback((fn) => ctx.locale.subscribe(fn), [ctx]), () => ctx.locale.getSnapshot())
      const sessionId = typeof props.sessionId === 'string' ? props.sessionId : ''
      const dir = useMemo(() => {
        if (!sessionId) return null
        try { return models.directoryFor(sessionId) } catch { return null }
      }, [models, sessionId])
      const available = useMemo(() => { try { return !sessions || sessions.subagentAddress(sessionId) === undefined } catch { return true } }, [sessions, sessionId])
      const nostore = useMemo(() => ({ subscribe: () => () => {}, getSnapshot: () => null }), [])
      const store = dir ? dir.store : nostore
      const st = useSyncExternalStore(useCallback((fn) => store.subscribe(fn), [store]), () => store.getSnapshot())
      const [open, setOpen] = useState(false)
      const [pane, setPane] = useState('root')
      const [query, setQuery] = useState('')
      const [pos, setPos] = useState(null)
      const [err, setErr] = useState(null)
      const btnRef = useRef(null)
      const popRef = useRef(null)
      const searchRef = useRef(null)
      useLayoutEffect(ensureStyle, [])

      useEffect(() => { if (dir && available) dir.load().catch(() => {}) }, [dir, available])
      useEffect(() => { if (open && dir && available) dir.load().catch(() => {}) }, [open, dir, available])

      const groups = useMemo(() => {
        const gs = (st?.groups || []).map((g) => ({ ...g, label: g.id === 'deepseek-account' ? t('m.account') : g.name }))
        const rank = (g) => (g.id === 'deepseek-account' ? 0 : g.id === 'deepseek-official' || g.id === 'deepseek' ? 1 : 2)
        return gs.map((g, i) => [g, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map((x) => x[0])
      }, [st?.groups, t])
      const cur = st?.pending || st?.current || null
      const curGroup = cur ? groups.find((g) => g.id === cur.provider) : null
      const curModel = curGroup ? curGroup.models.find((m) => m.id === cur.model) : null
      const topGroup = curGroup || groups[0] || null
      const top = topGroup ? topGroup.models.slice(0, TOP_N) : []
      if (curModel && !top.includes(curModel)) top[top.length - 1] = curModel
      const total = groups.reduce((n, g) => n + g.models.length, 0)
      const efforts = curModel?.reasoning?.efforts || []
      const curEffort = cur?.reasoningEffort || curModel?.reasoning?.defaultEffort
      const effortName = efforts.find((e) => e.id === curEffort)?.name || st?.retainedEffort || curEffort || ''
      const busy = st?.status === 'selecting'
      const badge = (m) => (m.badge ? h('span', { className: `dmd-mbadge ${m.badge.tone || 'neutral'}` }, (() => { try { return ctx.locale.resolveText(m.badge.text) } catch { return typeof m.badge.text === 'string' ? m.badge.text : '' } })()) : null)

      const pick = async (sel) => {
        if (!dir || busy) return
        setErr(null)
        try {
          const r = await dir.select(sel)
          if (r && !r.ok) { setErr(r.error?.code === 'session/writer-held' ? t('m.inUse') : String(r.error?.message || r.error)); return }
          setOpen(false)
          btnRef.current?.focus()
        } catch (e) { setErr(String(e?.message || e)) }
      }
      const pickModel = (g, m) => {
        if (cur && g.id === cur.provider && m.id === cur.model) { setOpen(false); return }
        const effs = m.reasoning?.efforts || []
        const keep = curEffort && effs.some((e) => e.id === curEffort) ? curEffort : m.reasoning?.defaultEffort
        pick({ provider: g.id, model: m.id, ...(keep ? { reasoningEffort: keep } : {}) })
      }
      const pickEffort = (e) => {
        if (!cur || e.id === curEffort) { setPane('root'); return }
        pick({ provider: cur.provider, model: cur.model, reasoningEffort: e.id })
      }

      const place = useCallback(() => {
        const el = btnRef.current
        const pop = popRef.current
        if (!el) return
        const r = el.getBoundingClientRect()
        const width = Math.min(240, window.innerWidth - 24)
        const left = Math.max(12, Math.min(r.right - width + 4, window.innerWidth - width - 12))
        const bottom = Math.max(12, window.innerHeight - r.top + 6)
        const maxH = Math.max(160, r.top - 18)
        setPos((o) => (o && o.left === left && o.bottom === bottom && o.width === width && o.maxH === maxH ? o : { left, bottom, width, maxH }))
        void pop
      }, [])
      useLayoutEffect(() => { if (open) place(); else { setPane('root'); setQuery(''); setErr(null) } }, [open, place])
      useEffect(() => { if (open && pane === 'more') searchRef.current?.focus() }, [open, pane])

      const moreGroups = useMemo(() => groups.map((g) => ({ ...g, models: g.models.filter((m) => fuzzy(m.name, query.trim())) })).filter((g) => g.models.length), [groups, query])

      // latest pane state for the open-menu listeners: subscribe once per open / close, not per render
      const live = useRef(null)
      live.current = { pane, moreGroups, pickModel }

      useEffect(() => {
        if (!open) return undefined
        const onDown = (e) => { if (popRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return; setOpen(false) }
        const onKey = (e) => {
          const { pane, moreGroups, pickModel } = live.current
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (pane !== 'root') setPane('root'); else { setOpen(false); btnRef.current?.focus() } return }
          if (pane === 'more') {
            if (e.key === 'Enter' && document.activeElement === searchRef.current) { const g = moreGroups[0]; if (g) { e.preventDefault(); pickModel(g, g.models[0]) } }
            return
          }
          // (no 1–9 shortcuts: the numbers are no longer shown, so a stray digit must not switch models)
        }
        window.addEventListener('resize', place)
        document.addEventListener('mousedown', onDown, true)
        document.addEventListener('keydown', onKey, true)
        return () => { window.removeEventListener('resize', place); document.removeEventListener('mousedown', onDown, true); document.removeEventListener('keydown', onKey, true) }
      }, [open, place])

      if (!sessionId || !dir || !available) return null
      const name = curModel ? curModel.name : (cur ? cur.model : t('m.pick'))
      const full = effortName && curModel ? `${name} · ${effortName}` : name
      const row = (key: string, { on, onClick, label, sub = null, right = null, num = 0, cls = '' }: ModelRowProps) => h('button', {
        key, type: 'button', role: 'menuitemradio', 'aria-checked': !!on, disabled: busy,
        className: `dmd-mrow${on ? ' on' : ''} ${cls}`, onClick,
      },
        h('span', { className: 'lbl' }, label),
        sub ? h('span', { className: 'sub' }, sub) : null,
        h('span', { className: 'chk' }, on ? h(Check) : null),
        right !== undefined ? h('span', { className: 'val' }, right) : null)

      let body
      if (pane === 'effort') {
        body = h(React.Fragment, null,
          h('button', { type: 'button', className: 'dmd-mback', onClick: () => setPane('root') }, h(Chevron, { dir: 'left' }), t('m.effort')),
          efforts.map((e, i) => row(e.id, { on: e.id === curEffort, onClick: () => pickEffort(e), label: e.name, sub: e.description, num: i + 1 })))
      } else if (pane === 'more') {
        body = h(React.Fragment, null,
          h('button', { type: 'button', className: 'dmd-mback', onClick: () => setPane('root') }, h(Chevron, { dir: 'left' }), t('m.more')),
          h('input', { ref: searchRef, className: 'dmd-msearch', placeholder: t('m.search'), value: query, onChange: (e) => setQuery(e.target.value), spellCheck: false, autoComplete: 'off' }),
          h('div', { className: 'dmd-mscroll' },
            moreGroups.length ? moreGroups.map((g) => h('div', { key: g.id, role: 'group', 'aria-label': g.label },
              h('div', { className: 'dmd-mgroup' }, g.label),
              g.models.map((m) => row(`${g.id}/${m.id}`, { on: !!cur && cur.provider === g.id && cur.model === m.id, onClick: () => pickModel(g, m), label: h(React.Fragment, null, h('span', { className: 'nm' }, m.name), badge(m)) }))))
              : h('div', { className: 'dmd-note' }, total ? t('m.none') : (st?.status === 'loading' ? t('m.loading') : t('m.empty')))))
      } else {
        body = h(React.Fragment, null,
          top.length ? top.map((m, i) => row(m.id, { on: !!curModel && m === curModel, onClick: () => pickModel(topGroup, m), label: h(React.Fragment, null, h('span', { className: 'nm' }, m.name), badge(m)), num: i + 1 }))
            : h('div', { className: 'dmd-note' }, st?.status === 'loading' || !st ? t('m.loading') : t('m.empty')),
          efforts.length || total > top.length ? h('div', { className: 'dmd-div' }) : null,
          efforts.length ? h('button', { type: 'button', className: 'dmd-mrow nav', disabled: busy, onClick: () => setPane('effort') },
            h('span', { className: 'lbl' }, t('m.effort')), h('span', { className: 'val' }, effortName), h(Chevron)) : null,
          efforts.length && total > top.length ? h('div', { className: 'dmd-div' }) : null,
          total > top.length ? h('button', { type: 'button', className: 'dmd-mrow nav', disabled: busy, onClick: () => setPane('more') },
            h('span', { className: 'lbl' }, t('m.more')), h('span', { className: 'val' }, ''), h(Chevron)) : null)
      }

      return h(React.Fragment, null,
        h('button', {
          ref: btnRef, type: 'button', className: 'dmd-trigger dmd-mtrigger', disabled: !!props.locked,
          'aria-haspopup': 'menu', 'aria-expanded': open, 'aria-label': fmt(t('m.trigger'), { name: full }), title: full,
          onClick: () => setOpen((v) => !v),
        },
          h('span', { className: 'nm' }, name),
          effortName && curModel ? h('span', { className: 'eff' }, effortName) : null,
          h('svg', { className: 'dmd-chev', viewBox: '0 0 16 16', width: 12, height: 12, 'aria-hidden': true }, h('path', { d: 'M4.5 6.5 8 10l3.5-3.5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' }))),
        open && pos ? portal(h('div', {
          ref: popRef, className: 'dmd-pop dmd-mpop notranslate', translate: 'no', role: 'menu', 'aria-label': t('m.title'),
          style: { left: pos.left, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxH },
        },
          body,
          busy ? h('div', { className: 'dmd-note' }, t('busy')) : null,
          err || st?.error ? h('div', { className: 'dmd-note err' }, fmt(t('m.failed'), { msg: err || st.error })) : null)) : null)
    }


    // ------------------------------------------------------------------ registration
    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'model-menu: dictionaries')
        const t = ctx.locale.bind(NS)
        ctx.effect(() => () => removeStyle(), 'model-menu: styles')
        // Claude-style model menu over the same per-session directory the built-in seat and /model use.
        ctx.inject(['slots', 'modelDirectories'], (scope) => {
          const models = scope.modelDirectories
          let sessions = null
          try { sessions = scope.sessions || null } catch {}
          function ModelSlot(props) {
            return h(ModelMenu, { ...props, ctx, t, models, sessions })
          }
          scope.slots.inject('conversation.input.model', () => scope.slots.register({
            name: 'conversation.input.model',
            id: 'model-menu',
            priority: -100,
            order: -100,
            label: () => t('m.title'),
          }, ModelSlot))
        })
      },
    }
  },
})
