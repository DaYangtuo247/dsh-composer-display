/*!
 * Rendered-in-place Markdown for the composer input.
 *
 * The input is dsh's own contenteditable (its model owns the DOM), so nothing here rewrites it: this
 * file only computes Range objects over the existing text, and the part paints them through the CSS
 * Custom Highlight API. What you send is still the raw Markdown, and the editor stays live-editable.
 *
 * Markers are painted transparent rather than removed — their glyph boxes stay, so the caret and
 * every column keep their exact positions while the text itself carries the formatting.
 *
 * Pure apart from reading the editor DOM, so it can be exercised on its own.
 */

/** The ten highlight layers, in the order the CSS declares them. */
const MARK_KINDS: MarkKind[] = ['hide', 'accent', 'code', 'fence', 'strong', 'em', 'head', 'link', 'strike', 'quote']

/** Inline rules, tried in order. [regex, [[group, kind]…]] — group 0 = whole match, -1 = closing marker. */
const INLINE_RULES: InlineRule[] = [
  [/(`+)([^`\n]+?)\1/g, [[2, 'code'], [1, 'hide'], [-1, 'hide']]],
  [/(\*\*|__)(?=\S)([^\n]*?\S)\1/g, [[2, 'strong'], [1, 'hide'], [-1, 'hide']]],
  [/(~~)(?=\S)([^\n]*?\S)\1/g, [[2, 'strike'], [1, 'hide'], [-1, 'hide']]],
  [/(?<![*\w])([*_])(?=[^\s*_])([^\n*_]*?[^\s*_])\1(?![*\w])/g, [[2, 'em'], [1, 'hide'], [-1, 'hide']]],
  [/(\[)([^\]\n]+)(\]\()([^)\s]+)(\))/g, [[2, 'link'], [1, 'hide'], [3, 'hide'], [4, 'hide'], [5, 'hide']]],
  [/\bhttps?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/g, [[0, 'link']]],
]

/** One run of text inside a single text node, so a character offset can be mapped back to a DOM point. */
interface MdSegment {
  node: Text
  /** offset of this run inside its node */
  off: number
  len: number
}

/** Ranges per highlight layer for one composer input. */
function mdRanges(input: Element): Record<MarkKind, Range[]> {
  const out = Object.fromEntries(MARK_KINDS.map((k) => [k, [] as Range[]])) as Record<MarkKind, Range[]>
  let inFence = false
  // Lexical: blocks are <p>, soft breaks are <br>, and a paste can store literal \n inside one
  // text node — split into lines on all three, keeping each segment's offset inside its node
  const lines: Array<{ segs: MdSegment[]; text: string }> = []
  for (const block of input.children.length ? Array.from(input.children) : [input]) {
    let cur = { segs: [] as MdSegment[], text: '' }
    lines.push(cur)
    const newLine = () => lines.push((cur = { segs: [], text: '' }))
    const walk = document.createTreeWalker(block, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
    for (let n: Node | null; (n = walk.nextNode());) {
      if (n.nodeType === 1) {
        if ((n as Element).tagName === 'BR') newLine()
        continue
      }
      const text = n as Text
      if (text.parentElement?.closest('[contenteditable="false"]')) continue // chips
      const data = text.data
      let pos = 0
      let idx: number
      const push = (from: number, to: number) => {
        if (to > from) {
          cur.segs.push({ node: text, off: from, len: to - from })
          cur.text += data.slice(from, to)
        }
      }
      while ((idx = data.indexOf('\n', pos)) !== -1) {
        push(pos, idx)
        newLine()
        pos = idx + 1
      }
      push(pos, data.length)
    }
  }
  for (const { segs, text } of lines) {
    if (!segs.length) continue
    /** [node, offset] for a character offset inside `segs` — what Range.setStart/setEnd want. */
    const at = (off: number): [Node, number] => {
      let acc = 0
      for (const s of segs) {
        if (off <= acc + s.len) return [s.node, s.off + (off - acc)]
        acc += s.len
      }
      const last = segs[segs.length - 1]
      return [last.node, last.off + last.len]
    }
    const add = (kind: MarkKind, a: number, b: number) => {
      if (b <= a) return
      const r = new Range()
      r.setStart(...at(a))
      r.setEnd(...at(b))
      out[kind].push(r)
    }
    const t = text.replace(/\u200b/g, ' ')
    if (/^\s*(```|~~~)/.test(t)) {
      add('hide', 0, t.length)
      inFence = !inFence
      continue
    }
    if (inFence) {
      add('fence', 0, t.length)
      continue
    }
    let m: RegExpExecArray | null
    if ((m = /^(#{1,6})(\s+)(.*)$/.exec(t))) {
      add('hide', 0, m[1].length + m[2].length)
      add('head', m[1].length + m[2].length, t.length)
    } else if ((m = /^(\s*)([-*+]|\d+[.)])(\s+)(\[[ xX]\]\s)?/.exec(t))) add('accent', m[1].length, m[0].length)
    else if ((m = /^(\s*>+\s?)/.exec(t))) {
      add('accent', 0, m[1].length)
      add('quote', m[1].length, t.length)
    } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(t)) {
      add('accent', 0, t.length)
      continue
    }
    const taken: Array<[number, number]> = [] // inline code wins over everything inside it
    for (const [re, groups] of INLINE_RULES) {
      re.lastIndex = 0
      while ((m = re.exec(t))) {
        const s0 = m.index
        const e0 = s0 + m[0].length
        if (taken.some(([a, b]) => s0 < b && e0 > a)) continue
        if (re === INLINE_RULES[0][0] || re === INLINE_RULES[4][0]) taken.push([s0, e0])
        for (const [g, kind] of groups) {
          if (g === 0) {
            add(kind, s0, e0)
          } else if (g === -1) {
            add(kind, e0 - m[1].length, e0)
          } else {
            // offset of group g = start + length of the preceding groups
            let off = s0
            for (let k = 1; k < g; k++) off += (m[k] || '').length
            add(kind, off, off + (m[g] || '').length)
          }
        }
      }
    }
  }
  return out
}
