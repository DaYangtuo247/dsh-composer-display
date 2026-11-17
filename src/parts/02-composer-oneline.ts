/*!
 * dsh-composer-oneline — browser half.
 *
 * Claude's compact composer: one row ([+] [input] [send]) inside the card, and
 * one meta line under it (stats on the left; model, mode and context ring on
 * the right). CSS only, keyed on dsh's data-composer-* attributes; a tiny dock
 * probe flags narrow bars so the stats move to their own line.
 */
part({
  id: 'dsh-composer-oneline',
  factory(require, kit) {
    const { React, h } = kit
    const { useEffect, useRef } = React

    // ------------------------------------------------------------------ styles
    const { ensure: ensureStyle, remove: removeStyle } = kit.sheet('composer-oneline', CSS_COMPOSER_ONELINE)

    /**
     * dsh's own context meter (shown when dsh-claude-context is off) opens its panel from the ring's left edge.
     * The ring now sits at the right end of the meta line, so the panel ran off to the right: while it is open,
     * its right edge is lined up with the ring's instead (dsh keeps the fixed top; the left is re-applied
     * if dsh re-places the panel).
     */
    function alignMeterPanel(root) {
      let panel = null
      let pmo = null
      const trigger = () => root.querySelector(':scope>[data-composer-dock]>:not([data-slot]) button[aria-haspopup="dialog"]')
      const place = () => {
        const t = trigger()
        if (!panel || !panel.isConnected || !t) return
        const tr = t.getBoundingClientRect()
        const left = Math.max(8, Math.round(tr.right - panel.offsetWidth))
        if (panel.style.left !== `${left}px`) panel.style.left = `${left}px`
        panel.setAttribute('data-dco-placed', '')
      }
      const release = () => { if (pmo) { pmo.disconnect(); pmo = null } if (hubOff) { hubOff(); hubOff = null } panel = null }
      let hubOff = null
      const check = () => {
        const t = trigger()
        if (!t || t.getAttribute('aria-expanded') !== 'true') { release(); return }
        // while open, catch the panel the moment it mounts (it is portaled to body) through the shared
        // hub, gated to dialog mounts so streamed transcript tokens never run this check
        if (!hubOff) hubOff = kit.dom.subscribe((recs) => { if (kit.dom.mounts(recs, '[role="dialog"]')) check() })
        // the newest anchored dialog (dsh's anchored popovers carry --dsh-anchored-max-width inline)
        const found = [...document.querySelectorAll<HTMLElement>('[role="dialog"]')].reverse()
          .find((d) => d.style.getPropertyValue('--dsh-anchored-max-width'))
        if (!found || found === panel) { place(); return }
        if (pmo) pmo.disconnect()
        panel = found
        pmo = new MutationObserver(place)
        pmo.observe(panel, { attributes: true, attributeFilter: ['style'] })
        place()
      }
      // MutationObserver callbacks run before the next paint, so the panel is first drawn already in place
      const mo = new MutationObserver(check)
      mo.observe(root, { subtree: true, attributes: true, attributeFilter: ['aria-expanded'] })
      window.addEventListener('resize', place)
      return () => { mo.disconnect(); release(); window.removeEventListener('resize', place) }
    }

    /**
     * An invisible dock entry: it gives the plugin a foothold inside each composer so a
     * ResizeObserver can flag narrow bars (data-dco-narrow). A JS observer rather than
     * container-type: a CSS container would become the containing block of every
     * position:fixed popover inside the bar.
     */
    function NarrowProbe() {
      const ref = useRef(null)
      useEffect(() => {
        const root = ref.current?.closest('[data-composer-dock]')?.parentElement
        if (!root || typeof ResizeObserver !== 'function') return undefined
        const ro = new ResizeObserver(() => { root.toggleAttribute('data-dco-narrow', root.clientWidth <= 600) })
        ro.observe(root)
        const stopMeter = alignMeterPanel(root)
        return () => { ro.disconnect(); stopMeter(); root.removeAttribute('data-dco-narrow') }
      }, [])
      return h('span', { ref, hidden: true, 'data-dco-probe': '' })
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ensureStyle()
        ctx.effect(() => () => removeStyle(), 'composer-oneline: styles')
        ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
          name: 'conversation.composer.dock',
          id: 'composer-oneline-probe',
          order: 999,
        }, NarrowProbe))
      },
    }
  },
})
