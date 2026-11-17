/*!
 * dsh-to-bottom — browser half.
 *
 * 「回到底部」 button, centred over the input box: a 32px round glass button with a ↓ arrow.
 * While a reply is still being written it shows three softly pulsing dots instead of the arrow,
 * in dsh's own accent, so you can see there is more coming below.
 *
 * Position: dsh renders the button as a `position:sticky` child of the message scroller, offset
 * by the composer's height. With sticky the button only sticks when the flow runs past the
 * scrollport: a short conversation leaves it stranded right under the last message, mid-screen,
 * where it reads as a floating loader. So the slot's box is driven from the composer card's rect
 * instead (fixed, one line above the input, centred on it), and dsh's own click / visibility
 * logic stays untouched — the slot is still only mounted while the tail is off screen.
 *
 * Look: dsh tokens only (surface, border, label, business accent), so it matches the harness in
 * either theme instead of drifting toward another product's palette.
 */
part({
  id: 'dsh-to-bottom',
  factory(require, kit) {
    const SLOT = '[class*="_toBottomSlot"]'
    const SCROLL = '[data-conversation-scroll]'
    const SEAT = SEL.seat
    /* the box (left / width / bottom) is written inline by place(); here only what never changes:
       fixed instead of dsh's sticky, no padding, one line high, and the face itself */
    const sheet = kit.sheet('to-bottom', CSS_TO_BOTTOM)

    /* Sit the slot one line above the composer card, as wide as the card (so centring is the
       input box's centre) — recomputed whenever the layout can have moved.

       Don't assume where `fixed` resolves: the chat column (and its scrollport) carry
       `container-type:inline-size`, i.e. layout containment, so a fixed child is measured against
       that box rather than the viewport, and that box is not necessarily the window. dsh assigns no
       stable marker we could rely on. So: write a first guess from the viewport, read back where the
       button actually landed, and correct by the difference — one extra layout read, right either way. */
    const GAP = 8
    function place() {
      const slot = q(SLOT)
      if (slot === null) return
      const composer = q(`${SCROLL} ${SEAT}`) ?? q(SEAT)
      const seat = composer === null ? null : composer.getBoundingClientRect()
      if (seat === null || seat.height === 0) {
        slot.style.display = 'none'
        return
      }
      if (slot.style.display === 'none') slot.style.display = 'flex'
      const targetBottom = seat.top - GAP
      const targetLeft = seat.left
      const width = `${Math.round(seat.width)}px`
      if (slot.style.width !== width) slot.style.width = width

      // first pass: treat the window as the containing block
      let bottom = window.innerHeight - targetBottom
      let left = targetLeft
      slot.style.bottom = `${Math.round(bottom)}px`
      slot.style.left = `${Math.round(left)}px`
      const landed = slot.getBoundingClientRect()
      // second pass: whatever box `fixed` really resolved against, shift by the measured miss
      const dy = landed.bottom - targetBottom
      const dx = landed.left - targetLeft
      if (Math.abs(dy) > 1) {
        bottom += dy
        slot.style.bottom = `${Math.round(bottom)}px`
      }
      if (Math.abs(dx) > 1) {
        left += dx
        slot.style.left = `${Math.round(left)}px`
      }
      // shown only once it is where it belongs: a first paint in dsh's own spot would flash mid-thread
      if (slot.style.visibility !== 'visible') slot.style.visibility = 'visible'
    }
    function startAnchoring() {
      let timer = 0
      let watched = []
      const ro = new ResizeObserver(() => schedule())
      // the scroller and the composer card come and go with the session; re-target only when the
      // pair actually changed, so observing itself never feeds another round
      function watch() {
        const next = qa(`${SCROLL}, ${SEAT}`)
        if (next.length === watched.length && next.every((el, i) => el === watched[i])) return
        ro.disconnect()
        for (const el of next) ro.observe(el)
        watched = next
      }
      function schedule() {
        // setTimeout, not rAF: rAF stops in a hidden pane or background window
        if (timer !== 0) return
        timer = setTimeout(() => { timer = 0; place() }, 16)
      }
      // One shared body observer (dom-hub). Re-target the ResizeObserver only when a scroller / seat
      // mounts or unmounts, and re-place only while dsh has the slot mounted (the tail is off screen).
      // Streamed transcript tokens touch neither, so neither pass runs during ordinary streaming.
      const offHub = kit.dom.subscribe((recs) => {
        if (kit.dom.mounts(recs, `${SCROLL}, ${SEAT}`)) watch()
        if (q(SLOT) !== null) schedule()
      })
      const onScroll = () => { if (q(SLOT) !== null) schedule() }
      document.addEventListener('scroll', onScroll, { capture: true, passive: true })
      window.addEventListener('resize', schedule)
      watch()
      schedule()
      return () => {
        offHub(); ro.disconnect()
        document.removeEventListener('scroll', onScroll, { capture: true })
        window.removeEventListener('resize', schedule)
        if (timer !== 0) clearTimeout(timer)
        const slot = q(SLOT)
        if (slot !== null) {
          slot.style.display = ''; slot.style.bottom = ''; slot.style.left = ''
          slot.style.width = ''; slot.style.visibility = ''
        }
      }
    }

    return {
      inject: [],
      apply(ctx) {
        ctx.effect(() => { sheet.ensure(); return sheet.remove }, 'to-bottom: styles')
        ctx.effect(() => startAnchoring(), 'to-bottom: above the composer')
      },
    }
  },
})
