/*!
 * dom-hub — one shared, frame-coalesced MutationObserver for the composer's DOM-scanning parts.
 *
 * Before, three parts each watched document.body with their own observer (markdown highlights, the
 * context-meter panel, the to-bottom anchor), so a single streamed transcript token woke three
 * full-document passes. Here one observer collects mutations and dispatches them once per animation
 * frame to every subscriber. Subscribers stay cheap by testing the records for relevance
 * (kit.dom.touches / kit.dom.mounts) instead of re-scanning the page: pure text streaming in the
 * transcript no longer wakes the markdown repaint, the meter check or the anchor at all.
 */
part({
  id: 'dom-hub',
  factory(require, kit) {
    /** frame subscribers; each one gets the coalesced MutationRecords. */
    const subs = new Set<{ fn: (records: MutationRecord[]) => void }>()
    let mo = null
    let raf = 0
    let pending = []
    // childList + characterData cover everything the composer cares about (input typing, slot /
    // seat / dialog mounts). No attributes: the parts that need them keep their own scoped observers.
    const CONFIG = { childList: true, subtree: true, characterData: true }
    function flush() {
      raf = 0
      const recs = pending
      pending = []
      for (const s of [...subs]) { try { s.fn(recs) } catch (e) { console.error('[dsh-composer-display/dom-hub]', e) } }
    }
    function schedule() { if (!raf) raf = requestAnimationFrame(flush) }
    function ensure() {
      if (mo) return
      mo = new MutationObserver((recs) => { pending.push(...recs); schedule() })
      mo.observe(document.body, CONFIG)
    }
    const el = (n) => (n.nodeType === 1 ? n : n.parentElement)
    /** Did any record touch an element matching sel — as target, or added / removed? O(records). */
    function touches(records, sel) {
      for (const r of records) {
        const t = el(r.target)
        if (t && (t.matches(sel) || t.closest(sel))) return true
        if (r.type === 'childList') {
          for (const n of r.addedNodes) if (n.nodeType === 1 && (n.matches(sel) || n.querySelector(sel))) return true
          for (const n of r.removedNodes) if (n.nodeType === 1 && (n.matches(sel) || n.querySelector(sel))) return true
        }
      }
      return false
    }
    /** Did any record add / remove an element matching sel (a mount / unmount, not a text edit inside)? */
    function mounts(records, sel) {
      for (const r of records) {
        if (r.type !== 'childList') continue
        for (const n of r.addedNodes) if (n.nodeType === 1 && (n.matches(sel) || n.querySelector(sel))) return true
        for (const n of r.removedNodes) if (n.nodeType === 1 && (n.matches(sel) || n.querySelector(sel))) return true
      }
      return false
    }
    kit.dom = {
      /** fn(records) runs once per frame while mutations occur; returns an unsubscribe. */
      subscribe(fn) {
        const s = { fn }
        subs.add(s)
        ensure()
        return () => {
          subs.delete(s)
          if (!subs.size) {
            if (mo) { mo.disconnect(); mo = null }
            if (raf) { cancelAnimationFrame(raf); raf = 0 }
            pending = []
          }
        }
      },
      touches,
      mounts,
      /** ask for a dispatch next frame even without a mutation (manual toggles) */
      poke() { schedule() },
    }
    return { inject: [], apply() {} }
  },
})