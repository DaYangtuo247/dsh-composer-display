/*!
 * dsh-smooth-caret — browser half.
 *
 * A calmer caret for the message input (dsh's Lexical editor, `[data-composer-input]`):
 * a 2px rounded bar in the text colour instead of the thin blue system caret, gliding
 * to its new place as you type or move, and breathing (fade in and out) instead of a
 * hard blink — it stays solid while you type. It only reads the selection and never
 * touches the editor's DOM. Whenever it cannot measure the caret (a range selection,
 * nothing focused, an unmeasurable spot) it gets out of the way and the native caret
 * shows again. prefers-reduced-motion: no glide, no breathing.
 */
part({
  id: 'dsh-smooth-caret',
  factory(require, kit) {
    const EDITOR = `${SEL.input}[contenteditable="true"]`
    const sheet = kit.sheet('smooth-caret', CSS_SMOOTH_CARET)

    /** The caret rectangle of a collapsed selection inside `ed`, or null. Read-only. */
    function caretRect(ed) {
      const sel = document.getSelection()
      if (!sel || !sel.rangeCount || !sel.isCollapsed) return null
      const range = sel.getRangeAt(0)
      if (!ed.contains(range.startContainer)) return null
      const cs = getComputedStyle(ed)
      const fs = parseFloat(cs.fontSize) || 15
      const lh = parseFloat(cs.lineHeight) || fs * 1.6
      const h = Math.round(Math.min(lh, fs * 1.3))
      const rects = range.getClientRects()
      let r = rects.length ? rects[rects.length - 1] : null
      if (r && r.height > 0) return { x: r.left, y: r.top + (r.height - h) / 2, h }
      // empty line / empty editor: measure the element the caret sits in
      let node: Node | null = range.startContainer
      if (node.nodeType === Node.TEXT_NODE) node = node.parentElement
      else if (node.childNodes[range.startOffset]?.nodeType === Node.ELEMENT_NODE) node = node.childNodes[range.startOffset]
      if (!node || (!ed.contains(node) && node !== ed)) return null
      if (node.nodeType !== Node.ELEMENT_NODE) return null
      const box = node as Element
      r = box.getBoundingClientRect()
      if (!r || (r.width === 0 && r.height === 0)) return null
      const ncs = getComputedStyle(box)
      const padL = parseFloat(ncs.paddingLeft) || 0
      const padT = parseFloat(ncs.paddingTop) || 0
      const lineH = parseFloat(ncs.lineHeight) || lh
      const left = ncs.textAlign === 'center' ? r.left + r.width / 2 : r.left + padL
      // a <br> (empty line) has its own one-line box: centre in it; a block: its first line
      if ((box as HTMLElement).tagName === 'BR' && r.height > 0) return { x: r.left, y: r.top + (r.height - h) / 2, h }
      return { x: left, y: r.top + padT + (lineH - h) / 2, h }
    }

    function start() {
      const html = document.documentElement
      const el = document.createElement('div')
      el.className = 'dsc-caret'
      el.setAttribute('aria-hidden', 'true')
      document.body.appendChild(el)
      let shown = false
      let raf = 0
      let lastX = NaN
      let lastY = NaN
      // the editor can move without a selection change (composer growing, layout shifts)
      const ro = new ResizeObserver(() => schedule())
      let watched = null
      // Follow scroll only on the editor's own scroll container. A document-wide capture listener
      // would also fire for the transcript's auto-follow scroll while a reply streams, re-measuring
      // the caret (forced layout) every frame even though the pinned composer never moves.
      let scrollTargets = []
      const onScroll = () => schedule()
      function watch(ed) {
        ro.disconnect(); watched = ed; ro.observe(ed)
        const card = ed.closest(SEL.card); if (card) ro.observe(card)
        for (const t of scrollTargets) t.removeEventListener('scroll', onScroll)
        scrollTargets = []
        const sc = ed.closest('[data-input-scroll]')
        for (const t of [ed, sc]) if (t && !scrollTargets.includes(t)) { t.addEventListener('scroll', onScroll, { passive: true }); scrollTargets.push(t) }
      }

      const hide = () => {
        if (!shown) return
        shown = false
        el.classList.remove('on')
        el.style.opacity = '0'
        html.removeAttribute('data-dsc-caret')
      }
      const place = () => {
        raf = 0
        const ed = document.activeElement && document.activeElement.matches && document.activeElement.matches(EDITOR) ? document.activeElement : null
        if (!ed || !document.hasFocus()) { hide(); return }
        if (ed !== watched) watch(ed)
        const c = caretRect(ed)
        const box = ed.getBoundingClientRect()
        const clip = ed.closest('[data-input-scroll]')?.getBoundingClientRect() || box
        if (!c || c.y + c.h < clip.top - 1 || c.y > clip.bottom + 1 || c.x < clip.left - 4 || c.x > clip.right + 4) { hide(); return }
        const x = Math.round(c.x * 2) / 2 - 1
        const y = Math.round(c.y)
        const far = !shown || Math.abs(y - lastY) > 2 * c.h || Math.abs(x - lastX) > 240
        el.classList.toggle('jump', far)
        el.style.height = `${c.h}px`
        el.style.transform = `translate(${x}px,${y}px)`
        if (x !== lastX || y !== lastY || !shown) {
          // moved: solid now, breathe again after a pause. Restart the breathe animation through the
          // Web Animations API rather than remove-class / force-reflow / add-class, so a caret move
          // never forces a synchronous layout. Only the breathe animation — leave the glide transition.
          el.classList.add('on')
          for (const a of el.getAnimations()) if ((a as CSSAnimation).animationName === 'dsc-breathe') { try { a.currentTime = 0 } catch {} }
        }
        el.style.opacity = ''
        lastX = x; lastY = y
        if (!shown) { shown = true; html.setAttribute('data-dsc-caret', '') }
      }
      const schedule = () => { if (!raf) raf = requestAnimationFrame(place) }

      document.addEventListener('selectionchange', schedule)
      document.addEventListener('focusin', schedule)
      let outTimer = 0
      const onOut = () => { if (outTimer) clearTimeout(outTimer); outTimer = setTimeout(() => { outTimer = 0; schedule() }, 0) }
      document.addEventListener('focusout', onOut)
      document.addEventListener('input', schedule, true)
      document.addEventListener('keydown', schedule, true)
      document.addEventListener('compositionupdate', schedule, true)
      window.addEventListener('blur', hide)
      window.addEventListener('focus', schedule)
      window.addEventListener('resize', schedule)
      // the editor can move without a selection change (composer growing, layout shifts)
      schedule()

      return () => {
        document.removeEventListener('selectionchange', schedule)
        document.removeEventListener('focusin', schedule)
        document.removeEventListener('focusout', onOut)
        document.removeEventListener('input', schedule, true)
        document.removeEventListener('keydown', schedule, true)
        document.removeEventListener('compositionupdate', schedule, true)
        window.removeEventListener('blur', hide)
        window.removeEventListener('focus', schedule)
        window.removeEventListener('resize', schedule)
        for (const t of scrollTargets) t.removeEventListener('scroll', onScroll)
        scrollTargets = []
        ro.disconnect()
        if (raf) cancelAnimationFrame(raf)
        if (outTimer) clearTimeout(outTimer)
        el.remove()
        html.removeAttribute('data-dsc-caret')
      }
    }

    return {
      inject: [],
      apply(ctx) {
        ctx.effect(() => { sheet.ensure(); const stop = start(); return () => { stop(); sheet.remove() } }, 'smooth-caret')
      },
    }
  },
})
