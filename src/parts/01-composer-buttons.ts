/*!
 * dsh-composer-buttons — browser half.
 *
 * Claude-style composer buttons, CSS only:
 * - Add (+) and Send: one ghost button, written once as the + key and mirrored by the send key
 *   (28px box, 8px corner, no fill, a soft square wash on hover), the two sitting either side of the
 *   card's centre; Send draws a bare return (corner-down-left) glyph and turns into a small stop
 *   square while a reply runs.
 *
 * - Markdown: the input renders formatting in place as you type (code, **bold**, _italic_, ~~strike~~,
 *   links, headings, list / quote markers, ``` fences). Markers are painted transparent and the text
 *   carries the style, without touching dsh's editor DOM — it stays raw Markdown and live-editable.
 *
 * Colours can be overridden with --dcb-send-bg / --dcb-send-bg-hover / --dcb-send-fg, set on any
 * ancestor of the composer. They must NOT be pre-declared on :root as aliases of dsh tokens: dsh themes
 * its tokens on <body>, so a :root alias resolves against nothing and the property becomes invalid.
 */
part({
  id: 'dsh-composer-buttons',
  factory(require, kit) {

    /* ---- Markdown in the composer -------------------------------------------------------------
     * The input is dsh's own contenteditable (its model owns the DOM), so nothing is rewritten:
     * the CSS Custom Highlight API paints ranges over the existing text. What you send is still
     * the raw Markdown. Highlights can only set colour / background / decoration / text-shadow,
     * so bold is a faux-bold shadow and italics are tinted. The rules are scoped to the input (its
     * spans inherit): a bare ::highlight() costs a highlight-style pass over every element on the page. */
    /* Rendered-in-place Markdown: markers are painted transparent (the glyph box stays, so the caret
       and every column keep their exact positions) while the text itself carries the formatting —
       the input reads as rendered Markdown yet stays dsh's raw, live-editable editor. */
    const sheet = kit.sheet('composer-buttons', CSS_COMPOSER_BUTTONS)
    const mdSheet = kit.sheet('composer-markdown', CSS_COMPOSER_MARKDOWN)
    function startMarkdown() {
      if (!(window.CSS && CSS.highlights)) return () => {}
      mdSheet.ensure()
      let timer = 0
      const paint = () => {
        timer = 0
        const all = Object.fromEntries(MARK_KINDS.map((k) => [k, [] as Range[]])) as Record<MarkKind, Range[]>
        for (const input of document.querySelectorAll(SEL.input)) {
          try { const r = mdRanges(input); for (const k of MARK_KINDS) all[k].push(...r[k]) } catch (e) { console.error('[dsh-composer-buttons:md]', e) }
        }
        for (const k of MARK_KINDS) CSS.highlights.set('dcbmd-' + k, new Highlight(...all[k]))
      }
      const schedule = () => { if (!timer) timer = setTimeout(paint, 16) }
      // one shared body observer (dom-hub); only repaint when a record actually touches an input,
      // so streamed transcript tokens never trigger a highlight pass
      const offHub = kit.dom.subscribe((recs) => { if (kit.dom.touches(recs, '[data-composer-input]')) schedule() })
      document.addEventListener('input', schedule, true)
      schedule()
      return () => {
        offHub(); document.removeEventListener('input', schedule, true); if (timer) clearTimeout(timer)
        for (const k of MARK_KINDS) CSS.highlights.delete('dcbmd-' + k)
        mdSheet.remove()
      }
    }
    return {
      inject: [],
      apply(ctx) {
        ctx.effect(() => { sheet.ensure(); return sheet.remove }, 'composer-buttons: styles')
        ctx.effect(() => startMarkdown(), 'composer-buttons: markdown highlighting in the input')
      },
    }
  },
})
