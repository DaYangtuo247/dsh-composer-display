/*!
 * Typed DOM helpers shared by every part.
 *
 * document.querySelector() is typed `Element | null`, so reading .style / .focus / .dataset needs a
 * cast at each call site. These two wrappers put the cast in one place and default to HTMLElement,
 * which is what every selector in this bundle actually resolves to.
 */

/** querySelector, typed as the element kind the caller expects (HTMLElement by default). */
const q = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T | null => root.querySelector<T>(sel)

/** querySelectorAll as a real array, so reverse()/map()/filter() are available without a spread. */
const qa = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document): T[] => Array.from(root.querySelectorAll<T>(sel))
