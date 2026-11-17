/*!
 * Domain types shared by the composer parts.
 *
 * Type-only: this file is never emitted, the build only concatenates .build/lib/*.js and
 * .build/parts/*.js, so declarations here cost nothing at runtime.
 */

/** The CSS Highlight names the markdown painter uses for one composer input. */
type MarkKind = 'hide' | 'accent' | 'code' | 'fence' | 'strong' | 'em' | 'head' | 'link' | 'strike' | 'quote'

/** [regex, [[group, kind]…]] — group 0 = whole match, -1 = closing marker. */
type InlineRule = [RegExp, Array<[number, MarkKind]>]

/** One preset from ctx.remote.permissionPresets.catalog(). */
interface PermissionCatalog {
  currentValue?: string
  options?: Array<{ value: string; name: string; description?: string }>
}

/** One row of the model menu (a model or an effort level). */
interface ModelRowProps {
  on: boolean
  onClick: () => void
  label: any
  sub?: any
  /** right-hand slot (a check mark, a badge, …) */
  right?: any
  /** the ⌘/Ctrl-1…9 accelerator shown on the right */
  num?: number
  cls?: string
}

/** One entry of the mode menu: an everyday mode, or the plan toggle. */
interface ModeItem {
  id: string
  /** 'perm' = an everyday permission preset, 'plan' = the plan-mode toggle. */
  kind?: 'perm' | 'plan'
  name?: string
}
