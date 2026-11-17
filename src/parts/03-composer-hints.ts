/*!
 * dsh-composer-display-hints — browser half.
 *
 * Claude-style input hints that always describe the keys that actually work:
 *   - idle: a short placeholder;
 *   - running, nothing queued: Enter / ⌘Enter delivery, resolved against the LIVE busy-Enter
 *     preference read from the `ui-conversation` config form — the very store dsh's own submission
 *     policy adopts from, so the hint names the keys that actually fire even with an empty draft and
 *     even for anyone who switched Enter to "steer" (the settings selector / send label are only a
 *     fallback for the brief window before the form serves);
 *   - running, empty draft, messages queued: the empty-draft accelerated chord that steers the
 *     whole queue, with the live count. dsh's own wording for this state names the chord but not
 *     the count and ignores that plain Enter does nothing here.
 * Display only: dsh's plan / unavailable / workspace placeholders are left alone.
 */
part({
  id: 'dsh-composer-hints',
  factory(require, kit) {
    const { React, h } = kit
    const { useEffect, useRef } = React

    const NS = 'composer-hints'
    const zh = {
      'ph.idle': '发消息，/ 调用指令，@ 引用文件或对话',
      'ph.queue': '{enter} 排队发送，{mod}{enter} 立即插话',
      'ph.steer': '{enter} 立即插话，{mod}{enter} 排队稍后发送',
      'ph.steerAll': '{mod}{enter} 立即发送全部 {n} 条排队',
    }
    const en = {
      'ph.idle': 'Message, / for commands, @ for files or sessions',
      'ph.queue': '{enter} to queue, {mod}{enter} to steer now',
      'ph.steer': '{enter} to steer now, {mod}{enter} to queue for later',
      'ph.steerAll': '{mod}{enter} sends all {n} queued now',
    }
    const fmt = (s, p) => String(s).replace(/\{(\w+)\}/g, (_, k) => (p && p[k] !== undefined ? String(p[k]) : `{${k}}`))

    const { ensure: ensureStyle, remove: removeStyle } = kit.sheet('composer-hints', CSS_COMPOSER_HINTS)

    let liveBusy = null // busy-Enter from the ui-conversation config form dsh itself adopts from
    let rpcBusy = null // Host setting seed, fallback until the form serves
    let poke = null

    function Hints(props) {
      const { ctx, t } = props
      const ref = useRef(null)
      useEffect(() => {
        const root = ref.current?.closest(SEL.dock)?.parentElement
        const card = root?.querySelector(`:scope>${SEL.card}`)
        // the tray (input.dock) and the composer (composer.dock) are siblings under composerStack;
        // observing that common ancestor lets the hint see the live queue count.
        const stack = root?.closest(SEL.stack) || root?.parentElement
        if (!card || !stack || typeof MutationObserver !== 'function') return undefined
        const conv = ctx.locale.bind('conversation')
        const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '')
        const mod = mac ? '⌘' : 'Ctrl+'
        let cached = null
        const sync = () => {
          const input = card.querySelector(SEL.input)
          const ph = input?.getAttribute('data-placeholder')
          const ours = ph === conv('placeholder.default') || ph === conv('placeholder.steerQueue')
          if (!input || !ours) {
            if (root.hasAttribute('data-dch-ph')) { root.removeAttribute('data-dch-ph'); root.style.removeProperty('--dch-ph') }
            return
          }
          const running = !!card.querySelector('[class*="_primary"][aria-label*="停止"], [class*="_primary"][aria-label*="Stop" i], [class*="_primary"] svg rect')
          const draftEmpty = !(input.textContent || '').trim()
          const tray = stack.querySelector('[data-dqt]')
          let n = tray ? parseInt(tray.getAttribute('data-dqt-count') || '0', 10) || 0 : 0
          if (!tray) { const dock = stack.querySelector('[data-queue-dock]'); if (dock) n = dock.querySelectorAll('li').length }
          // live busy-Enter: the ui-conversation config form is authoritative (dsh adopts from it and
          // it reads even with an empty draft); the settings selector / send label only cover the
          // brief window before the form serves.
          let be = liveBusy
          if (be == null) {
            const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'steer') && [...s.options].some((o) => o.value === 'queue'))
            if (sel && (sel.value === 'queue' || sel.value === 'steer')) be = cached = sel.value
            else if (running && !draftEmpty) {
              const label = [...card.querySelectorAll('button')].map((b) => b.getAttribute('aria-label')).find((l) => l === conv('input.send.steer') || l === conv('input.send.queue'))
              if (label === conv('input.send.steer')) be = cached = 'steer'
              else if (label === conv('input.send.queue')) be = cached = 'queue'
            }
            if (be == null) be = cached ?? rpcBusy ?? 'queue'
          }
          const text = !running ? t('ph.idle')
            : draftEmpty && n > 0 ? fmt(t('ph.steerAll'), { enter: '↵', mod, n })
              : fmt(t(be === 'steer' ? 'ph.steer' : 'ph.queue'), { enter: '↵', mod })
          const v = JSON.stringify(text)
          if (root.style.getPropertyValue('--dch-ph') !== v) root.style.setProperty('--dch-ph', v)
          // the observer watches the stack that contains root: writing an unchanged attribute
          // would re-trigger it forever, so only write on an actual change
          const state = !running ? 'idle' : n > 0 ? 'queue' : 'running'
          if (root.getAttribute('data-dch-ph') !== state) root.setAttribute('data-dch-ph', state)
        }
        poke = sync
        sync()
        const mo = new MutationObserver(sync)
        mo.observe(stack, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-placeholder', 'aria-label', 'data-dqt-count'] })
        const offLocale = ctx.locale.subscribe(sync)
        return () => { mo.disconnect(); try { offLocale() } catch {} ; if (poke === sync) poke = null; root.removeAttribute('data-dch-ph'); root.style.removeProperty('--dch-ph') }
      }, [ctx, t])
      return h('span', { ref, hidden: true, 'data-dch-probe': '' })
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'composer-hints: dictionaries')
        const t = ctx.locale.bind(NS)
        ensureStyle()
        ctx.effect(() => () => removeStyle(), 'composer-hints: styles')
        ctx.effect(() => {
          try {
            const svc = ctx.remote?.settingsController || ctx.remote?.settings
            const p = svc?.describe?.()
            p?.then?.((d) => {
              const ns = (d?.namespaces || []).find((x) => x.ns === 'ui-conversation')
              const v = ns?.value?.busyEnter
              if (v === 'queue' || v === 'steer') { rpcBusy = v; poke?.() }
            }, () => {})
          } catch {}
          return () => { rpcBusy = null }
        }, 'composer-hints: busy-Enter seed')
        ctx.inject(['configForms'], (scope) => {
          ctx.effect(() => {
            const form = scope.configForms.get('ui-conversation')
            if (!form?.subscribe) return undefined
            const read = () => {
              const v = form.getSnapshot?.()?.value?.busyEnter
              if (v === 'queue' || v === 'steer') { liveBusy = v; poke?.() }
            }
            read()
            const off = form.subscribe(read)
            return () => { try { off?.() } catch {} ; liveBusy = null }
          }, 'composer-hints: busy-Enter form')
        })
        function Slot(props) { return h(Hints, { ...props, ctx, t }) }
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock',
          id: 'composer-hints-probe',
          order: 998,
        }, Slot))
      },
    }
  },
})