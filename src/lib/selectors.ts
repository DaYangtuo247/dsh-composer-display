/*!
 * Selectors shared by the composer parts.
 *
 * Two kinds of selector live here, and both are fragile enough to be worth naming once:
 * - our own markers (data-composer-*): the parts that lay the composer out put them on the page and
 *   the parts that style it read them back, so a typo elsewhere would silently detach a whole rule;
 * - dsh's own class fragments: its CSS modules hash the prefix, only the suffix (_root, _row, …) is
 *   stable across releases, so these are always `[class*="_…"]` matches.
 */

const SEL = {
  /** the composer's own box, as laid out by parts 02/04 */
  seat: '[data-composer-seat]',
  /** the visual card behind the composer (a ::before painter hangs off it) */
  card: '[data-composer-card]',
  /** dsh's contenteditable input — also the scope of the markdown highlights */
  input: '[data-composer-input]',
  /** our dock below the card: hints, queue tray, stats */
  dock: '[data-composer-dock]',
  /** one entry of the token / context stat line */
  stat: '[data-composer-stat]',
  /** the placeholder element dsh renders while the input is empty */
  placeholder: '[data-composer-placeholder]',

  /** dsh: the input row's flex line */
  row: '[class*="_row"]',
  /** dsh: the composer root, inside the seat */
  root: '[class*="_root"]',
  /** dsh: the leading cluster (modes + + key) */
  tools: '[class*="_tools"]',
  /** dsh: the + key inside the leading cluster */
  add: '[class*="_add"]',
  /** dsh: the trailing cluster (send / stop) */
  trailing: '[class*="_trailing"]',
  /** dsh: the primary key — send, stop, retry and spinner all wear it */
  primary: '[class*="_primary"]',
  /** dsh: mode + model controls at the end of the trailing cluster */
  standardControls: '[class*="_standardControls"]',
  /** dsh: rendered markdown (used by the queue preview) */
  markdown: '[class*="_markdown"]',
  /** dsh: the stack wrapping every composer on the page */
  stack: '[class*="_composerStack"]',
  /** dsh: the mode chips inside the leading cluster */
  modes: '[class*="_modes"]',
  /** dsh: token / context activity readout */
  activity: '[class*="_activity"]',
} as const
