/*!
 * dsh-stack-cards — browser half.
 *
 * The two cards dsh docks above the composer (the plan/todo strip and the goal
 * strip) ship with its own elevated menu surface: a soft shadow, a translucent
 * menu fill and 28px round icon keys. This part gives the goal strip the same
 * look the queue tray uses — an opaque card fill with a 1px hairline (the strip
 * floats over the scrolling conversation, so a see-through fill leaks replies
 * through the label), 12px corners, square-ish 26px keys with the same wash —
 * so the stack above the input reads as one family with the plan card below.
 *
 * The todo strip is hidden by dsh-plan-checklist (it drives that card's data),
 * so only the goal strip is styled here. Session data is untouched.
 */
part({
  id: 'dsh-stack-cards',
  factory(require, kit) {
    const sheet = kit.sheet('stack-cards', CSS_STACK_CARDS)

    return {
      inject: [],
      apply(ctx) {
        sheet.ensure()
        ctx.effect(() => () => sheet.remove(), 'stack-cards: styles')
      },
    }
  },
})
