/*! dsh-composer-display v1.0.0 — built by build.mjs from src/lib/dom.js, src/lib/markdown.js, src/lib/selectors.js, src/styles/01-composer-buttons.scss, src/styles/01-composer-markdown.scss, src/styles/02-composer-oneline.scss, src/styles/03-composer-hints.scss, src/styles/04-queue-tray.scss, src/styles/05-mode-menu.scss, src/styles/06-model-menu.scss, src/styles/07-smooth-caret.scss, src/styles/08-to-bottom.scss, src/styles/09-stack-cards.scss, src/parts/00-dom-hub.js, src/parts/01-composer-buttons.js, src/parts/02-composer-oneline.js, src/parts/03-composer-hints.js, src/parts/04-queue-tray.js, src/parts/05-mode-menu.js, src/parts/06-model-menu.js, src/parts/07-smooth-caret.js, src/parts/08-to-bottom.js, src/parts/09-stack-cards.js. Edit src/, not this file. */
;(() => {
const BUNDLE = "dsh-composer-display"
const parts = []
const part = (m) => { parts.push(m) }
/**
 * Shared helpers for the dsh-claude-* bundles (copied into each built client.js).
 * Every part gets one kit: React and createElement, a body portal, named style sheets, and the
 * settings controls used by every 设置 row of ours (settingsUI: Row, Select, Switch matching dsh's own rows).
 */
function makeKit(require, bundle) {
  const React = require('react')
  let ReactDOM = null
  try { ReactDOM = require('react-dom') } catch {}
  return {
    React,
    h: React.createElement,
    /** Popovers render into <body> so no transformed / contained ancestor can offset position:fixed. */
    portal: (el, target = document.body) => (ReactDOM && typeof ReactDOM.createPortal === 'function' ? ReactDOM.createPortal(el, target) : el),
    /** A lazily inserted <style data-plugin="bundle/name">; ensure() is idempotent, remove() undoes it. */
    sheet(name, css) {
      let tag = null
      return {
        ensure() {
          if (tag && document.head.contains(tag)) return
          tag = document.createElement('style')
          tag.dataset.plugin = `${bundle}/${name}`
          tag.textContent = css
          document.head.appendChild(tag)
        },
        remove() { if (tag) { tag.remove(); tag = null } },
      }
    },
    /** Settings rows and controls (made once per bundle on first use). */
    settingsUI() {
      if (!this._settingsUI) this._settingsUI = makeSettingsUI(this)
      return this._settingsUI
    },
  }
}

/** Row / Select / Switch for 设置 pages, styled like dsh's own preference rows. */
function makeSettingsUI(kit) {
    const { React, h, portal } = kit
    const { useState, useEffect, useRef, useLayoutEffect } = React
    const sheet = kit.sheet('settings-ui', `
  .dcf-row{display:flex;align-items:center;gap:8px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}
  .dcf-row .txt{flex:1 1 auto;min-width:0}
  .dcf-row .lbl{font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary)}
  .dcf-row .desc{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
  .dap-sel{display:inline-flex;align-items:center;gap:12px;flex:none;height:36px;max-width:260px;padding:0 14px;border:0;border-radius:var(--dsw-radius-md,12px);
    background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;cursor:pointer;white-space:nowrap}
  .dap-sel:hover,.dap-sel[aria-expanded=true]{background:color-mix(in srgb,var(--dsw-alias-label-primary) 7%,var(--dsw-alias-bg-module-platform))}
  .dap-sel .v{overflow:hidden;text-overflow:ellipsis}
  .dap-sel svg{flex:none;width:14px;height:14px;color:var(--dsw-alias-label-secondary)}
  .dap-menu{box-sizing:border-box;position:fixed;z-index:1100;min-width:180px;max-height:min(360px,calc(100vh - 24px));overflow:auto;padding:6px;border-radius:var(--dsw-radius-lg,14px);background:var(--dsw-specific-menu,var(--dsw-alias-bg-layer-2));backdrop-filter:var(--dsw-menu-backdrop-filter);-webkit-backdrop-filter:var(--dsw-menu-backdrop-filter);box-shadow:var(--dsw-elevation-prominent,0 8px 28px rgba(0,0,0,.18));color:var(--dsw-alias-label-primary);font-size:13.5px;line-height:20px;animation:dap-in .14s cubic-bezier(.2,.8,.2,1) both}
  @keyframes dap-in{from{opacity:0;transform:translateY(-3px)}}
  .dap-menu button{display:flex;align-items:center;gap:10px;width:100%;min-height:32px;padding:6px 10px;border:0;border-radius:9px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer;white-space:nowrap}
  .dap-menu button:hover,.dap-menu button.kbd{background:var(--dsw-alias-interactive-bg-hover)}
  .dap-menu button .l{flex:1 1 auto}
  .dap-menu button svg{flex:none;width:15px;height:15px}
  .dsu-switch{position:relative;flex:none;width:36px;height:22px;padding:0;border:0;border-radius:11px;background:var(--dsw-alias-bg-module-platform);cursor:pointer;transition:background-color .18s ease}
  .dsu-switch::after{content:"";position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;corner-shape:round;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .18s cubic-bezier(.2,.8,.2,1)}
  .dsu-switch[aria-checked=true]{background:var(--dsw-alias-state-business-primary,#4d6bfe)}
  .dsu-switch[aria-checked=true]::after{transform:translateX(14px)}
  @media (prefers-reduced-motion: reduce){.dsu-switch,.dsu-switch::after{transition:none}}
  `)
    const zhUI = () => !/^en/i.test(document.documentElement.lang || '')
    const L = (o) => (zhUI() ? o.zh : o.en)
    const S = (z, e) => (zhUI() ? z : e)
    const sw = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }
    const chev = () => h('svg', { viewBox: '0 0 16 16', 'aria-hidden': true }, h('path', { d: 'M4.5 6.5 8 10l3.5-3.5', ...sw }))
    const check = () => h('svg', { viewBox: '0 0 16 16', 'aria-hidden': true }, h('path', { d: 'M3.5 8.4 6.6 11.4 12.5 4.8', ...sw, strokeWidth: 1.7 }))

    // ------------------------------------------------------------------ controls
    function Select({ value, options, onChange, box, label }) {
      const [open, setOpen] = useState(false)
      const [pos, setPos] = useState(null)
      const btn = useRef(null)
      const menu = useRef(null)
      const cur = options.find((o) => o.v === value) || options[0]
      useLayoutEffect(() => {
        if (!open) return
        const r = btn.current.getBoundingClientRect()
        const w = Math.max(r.width, 200)
        const left = Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8))
        const below = window.innerHeight - r.bottom
        setPos(below > 220 ? { left, top: r.bottom + 4, width: w } : { left, bottom: window.innerHeight - r.top + 4, width: w })
      }, [open])
      useEffect(() => {
        if (!open) return undefined
        const down = (e) => { if (!menu.current?.contains(e.target) && !btn.current?.contains(e.target)) setOpen(false) }
        const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); btn.current?.focus() } }
        const scroll = (e) => { if (!menu.current?.contains(e.target)) setOpen(false) }
        document.addEventListener('mousedown', down, true)
        document.addEventListener('keydown', key, true)
        document.addEventListener('scroll', scroll, true)
        return () => { document.removeEventListener('mousedown', down, true); document.removeEventListener('keydown', key, true); document.removeEventListener('scroll', scroll, true) }
      }, [open])
      return h(React.Fragment, null,
        h('button', { ref: btn, type: 'button', className: `dap-sel${box ? ' box' : ''}`, 'aria-haspopup': 'listbox', 'aria-expanded': open, 'aria-label': label, onClick: () => setOpen((v) => !v) },
          h('span', { className: 'v' }, cur.label || L(cur)), chev()),
        open && pos ? portal(h('div', { ref: menu, className: 'dap-menu', role: 'listbox', style: { left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width } },
          options.map((o) => h('button', {
            key: String(o.v), type: 'button', role: 'option', 'aria-selected': o.v === value,
            onClick: () => { setOpen(false); onChange(o.v); btn.current?.focus() },
          }, h('span', { className: 'l', style: o.font ? { fontFamily: o.font } : undefined }, o.label || L(o)), o.v === value ? check() : null)))) : null)
    }

    function Row({ label, desc, children }) {
      return h('div', { className: 'dcf-row' },
        h('div', { className: 'txt' }, h('div', { className: 'lbl' }, label), desc ? h('div', { className: 'desc' }, desc) : null),
        children)
    }
    function Switch({ checked, onChange, label }) {
      return h('button', { type: 'button', role: 'switch', className: 'dsu-switch', 'aria-checked': !!checked, 'aria-label': label, onClick: () => onChange(!checked) })
    }
    return { sheet, Row, Select, Switch, L, S }
}

/**
 * One feature registry per bundle (kit.js is copied into each client.js, so this singleton is
 * bundle-local): a bundle's settings surfaces list and flip only its own features, never another
 * plugin's. Each part declares itself with `feature:` metadata; gateFeature() below starts/stops
 * the part live. Choices persist in one localStorage key (feature ids are unique across bundles);
 * absent means on.
 */
let featureStoreInstance
function featureStore() {
  if (featureStoreInstance) return featureStoreInstance
  const KEY = 'dsh-claude-features.enabled'
  let enabled = {}
  try { enabled = JSON.parse(localStorage.getItem(KEY) || '{}') || {} } catch {}
  let rev = 0
  const meta = []
  const subs = new Set()
  const store = {
    declare(bundle, id, f) { if (f && !meta.some((m) => m.id === id)) meta.push({ bundle, id, ...f }) },
    list: () => meta.slice(),
    enabled: (id) => enabled[id] !== false,
    revision: () => rev,
    set(id, on) {
      enabled = { ...enabled, [id]: !!on }
      try { localStorage.setItem(KEY, JSON.stringify(enabled)) } catch {}
      rev++
      for (const fn of subs) fn(id)
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn) },
  }
  featureStoreInstance = store
  return store
}

/**
 * Run one feature part in its own cordis fiber so the settings tab can dispose and restart it.
 * Infrastructure parts (no `feature:`) stay on the plain synchronous path: dom-hub must be up
 * before anything subscribes to kit.dom. Fibers activate in declaration order (microtasks), so
 * parts that read each other's setup still see it.
 */
function gateFeature(ctx, store, mod) {
  let fiber = null
  let slotDisposers = []
  // slots.inject ties its effect to the slots service's own fiber, not ours, so a disposed feature
  // would leave its contribution mounted; collect the returned disposers and run them on stop.
  const slots = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'inject') return (key, cb) => { const d = ctx.slots.inject(key, cb); slotDisposers.push(d); return d }
      const v = ctx.slots[prop]
      return typeof v === 'function' ? v.bind(ctx.slots) : v
    },
  })
  const scope = ctx.extend({ slots })
  const start = () => {
    if (fiber || !store.enabled(mod.id)) return
    fiber = scope.plugin({ name: mod.id, inject: mod.inject, apply: (s) => mod.apply(s) })
  }
  const stop = () => {
    const f = fiber
    fiber = null
    for (const d of slotDisposers.splice(0)) { try { d() } catch {} }
    if (f) Promise.resolve(f.dispose()).catch(() => {})
  }
  start()
  const off = store.subscribe((id) => { if (id === mod.id) (store.enabled(mod.id) ? start() : stop()) })
  ctx.effect(() => () => { off(); stop() }, `feature: ${mod.id}`)
}

// ===== src/lib/dom.js
"use strict";
/*!
 * Typed DOM helpers shared by every part.
 *
 * document.querySelector() is typed `Element | null`, so reading .style / .focus / .dataset needs a
 * cast at each call site. These two wrappers put the cast in one place and default to HTMLElement,
 * which is what every selector in this bundle actually resolves to.
 */
/** querySelector, typed as the element kind the caller expects (HTMLElement by default). */
const q = (sel, root = document) => root.querySelector(sel);
/** querySelectorAll as a real array, so reverse()/map()/filter() are available without a spread. */
const qa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// ===== src/lib/markdown.js
"use strict";
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
const MARK_KINDS = ['hide', 'accent', 'code', 'fence', 'strong', 'em', 'head', 'link', 'strike', 'quote'];
/** Inline rules, tried in order. [regex, [[group, kind]…]] — group 0 = whole match, -1 = closing marker. */
const INLINE_RULES = [
    [/(`+)([^`\n]+?)\1/g, [[2, 'code'], [1, 'hide'], [-1, 'hide']]],
    [/(\*\*|__)(?=\S)([^\n]*?\S)\1/g, [[2, 'strong'], [1, 'hide'], [-1, 'hide']]],
    [/(~~)(?=\S)([^\n]*?\S)\1/g, [[2, 'strike'], [1, 'hide'], [-1, 'hide']]],
    [/(?<![*\w])([*_])(?=[^\s*_])([^\n*_]*?[^\s*_])\1(?![*\w])/g, [[2, 'em'], [1, 'hide'], [-1, 'hide']]],
    [/(\[)([^\]\n]+)(\]\()([^)\s]+)(\))/g, [[2, 'link'], [1, 'hide'], [3, 'hide'], [4, 'hide'], [5, 'hide']]],
    [/\bhttps?:\/\/[^\s<>()]+[^\s<>().,;:!?'"]/g, [[0, 'link']]],
];
/** Ranges per highlight layer for one composer input. */
function mdRanges(input) {
    const out = Object.fromEntries(MARK_KINDS.map((k) => [k, []]));
    let inFence = false;
    // Lexical: blocks are <p>, soft breaks are <br>, and a paste can store literal \n inside one
    // text node — split into lines on all three, keeping each segment's offset inside its node
    const lines = [];
    for (const block of input.children.length ? Array.from(input.children) : [input]) {
        let cur = { segs: [], text: '' };
        lines.push(cur);
        const newLine = () => lines.push((cur = { segs: [], text: '' }));
        const walk = document.createTreeWalker(block, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
        for (let n; (n = walk.nextNode());) {
            if (n.nodeType === 1) {
                if (n.tagName === 'BR')
                    newLine();
                continue;
            }
            const text = n;
            if (text.parentElement?.closest('[contenteditable="false"]'))
                continue; // chips
            const data = text.data;
            let pos = 0;
            let idx;
            const push = (from, to) => {
                if (to > from) {
                    cur.segs.push({ node: text, off: from, len: to - from });
                    cur.text += data.slice(from, to);
                }
            };
            while ((idx = data.indexOf('\n', pos)) !== -1) {
                push(pos, idx);
                newLine();
                pos = idx + 1;
            }
            push(pos, data.length);
        }
    }
    for (const { segs, text } of lines) {
        if (!segs.length)
            continue;
        /** [node, offset] for a character offset inside `segs` — what Range.setStart/setEnd want. */
        const at = (off) => {
            let acc = 0;
            for (const s of segs) {
                if (off <= acc + s.len)
                    return [s.node, s.off + (off - acc)];
                acc += s.len;
            }
            const last = segs[segs.length - 1];
            return [last.node, last.off + last.len];
        };
        const add = (kind, a, b) => {
            if (b <= a)
                return;
            const r = new Range();
            r.setStart(...at(a));
            r.setEnd(...at(b));
            out[kind].push(r);
        };
        const t = text.replace(/\u200b/g, ' ');
        if (/^\s*(```|~~~)/.test(t)) {
            add('hide', 0, t.length);
            inFence = !inFence;
            continue;
        }
        if (inFence) {
            add('fence', 0, t.length);
            continue;
        }
        let m;
        if ((m = /^(#{1,6})(\s+)(.*)$/.exec(t))) {
            add('hide', 0, m[1].length + m[2].length);
            add('head', m[1].length + m[2].length, t.length);
        }
        else if ((m = /^(\s*)([-*+]|\d+[.)])(\s+)(\[[ xX]\]\s)?/.exec(t)))
            add('accent', m[1].length, m[0].length);
        else if ((m = /^(\s*>+\s?)/.exec(t))) {
            add('accent', 0, m[1].length);
            add('quote', m[1].length, t.length);
        }
        else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(t)) {
            add('accent', 0, t.length);
            continue;
        }
        const taken = []; // inline code wins over everything inside it
        for (const [re, groups] of INLINE_RULES) {
            re.lastIndex = 0;
            while ((m = re.exec(t))) {
                const s0 = m.index;
                const e0 = s0 + m[0].length;
                if (taken.some(([a, b]) => s0 < b && e0 > a))
                    continue;
                if (re === INLINE_RULES[0][0] || re === INLINE_RULES[4][0])
                    taken.push([s0, e0]);
                for (const [g, kind] of groups) {
                    if (g === 0) {
                        add(kind, s0, e0);
                    }
                    else if (g === -1) {
                        add(kind, e0 - m[1].length, e0);
                    }
                    else {
                        // offset of group g = start + length of the preceding groups
                        let off = s0;
                        for (let k = 1; k < g; k++)
                            off += (m[k] || '').length;
                        add(kind, off, off + (m[g] || '').length);
                    }
                }
            }
        }
    }
    return out;
}

// ===== src/lib/selectors.js
"use strict";
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
};

// ===== src/styles/01-composer-buttons.scss
/* compiled from src/styles/01-composer-buttons.scss by build.mjs — edit the .scss, not this file */
const CSS_COMPOSER_BUTTONS = "/* no :root defaults: each rule falls back to the dsh token itself, resolved where it is used */\n/* ---- the + key: unchanged, declaration for declaration -------------------------------------\n * This block is the reference the send key is written against, not the other way round: leave it\n * alone unless the + key itself is meant to change. */\n[data-composer-seat] [class*=_tools] > button[class*=_add] {\n  width: 28px !important;\n  height: 28px !important;\n  border-radius: 8px !important;\n  corner-shape: round;\n  background: transparent !important;\n  border: 0 !important;\n  color: var(--dsw-alias-label-secondary) !important;\n  transition: background-color 0.12s ease, color 0.12s ease, border-color 0.12s ease;\n}\n\n@media (hover: hover) {\n  [data-composer-seat] [class*=_tools] > button[class*=_add]:hover:not(:disabled) {\n    background: var(--dsw-alias-interactive-bg-hover) !important;\n    color: var(--dsw-alias-label-primary) !important;\n  }\n}\n[data-composer-seat] [class*=_tools] > button[class*=_add] > svg {\n  display: none !important;\n}\n\n[data-composer-seat] [class*=_tools] > button[class*=_add]::before {\n  content: \"\";\n  width: 15px;\n  height: 15px;\n  background: currentColor;\n  -webkit-mask: url(\"data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'black'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20stroke-width%3D'1.4'%20d%3D'M8%203v10M3%208h10'%2F%3E%3C%2Fsvg%3E\") center/15px 15px no-repeat;\n  mask: url(\"data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'black'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20stroke-width%3D'1.4'%20d%3D'M8%203v10M3%208h10'%2F%3E%3C%2Fsvg%3E\") center/15px 15px no-repeat;\n}\n\n/* ---- the send / stop key: the + key's twin -------------------------------------------------\n * Same 28px box, same 8px corner, same transparent rest state, same 15px masked glyph (a 15px\n * RETURN on its 24 viewBox at stroke 2.1 draws the + glyph's 1.3px), same wash on hover, so the\n * two keys read and behave as one pair. Three deliberate differences: the hover carries no\n * :not(:disabled) (an empty composer leaves this key disabled, and that was exactly the state in\n * which the wash used to vanish), the transform is pinned because dsh lifts this key 2px with\n * translateY(-2px) — alone enough to put it off the + key's line — and a disabled key is dimmed. */\n[data-composer-seat] [class*=_trailing] > button[class*=_primary] {\n  width: 28px !important;\n  height: 28px !important;\n  min-width: 28px !important;\n  padding: 0 !important;\n  border: 0 !important;\n  border-radius: 8px !important;\n  corner-shape: round;\n  background: var(--dcb-send-bg, transparent) !important;\n  color: var(--dcb-send-fg, var(--dsw-alias-label-secondary)) !important;\n  box-shadow: none !important;\n  transform: none !important;\n  transition: background-color 0.12s ease, color 0.12s ease, opacity 0.12s ease;\n}\n\n@media (hover: hover) {\n  [data-composer-seat] [class*=_trailing] > button[class*=_primary]:hover:not(:disabled) {\n    background: var(--dcb-send-bg-hover, var(--dsw-alias-interactive-bg-hover)) !important;\n    color: var(--dsw-alias-label-primary) !important;\n  }\n}\n/* :hover:not(:disabled), exactly as on the + key: an empty composer leaves this key disabled and\n   nothing to press, so it must stay mute — the browser still matches :hover on a disabled control. */\n[data-composer-seat] [class*=_trailing] > button[class*=_primary]:disabled:not([data-sending]) {\n  opacity: 0.45 !important;\n}\n\n[data-composer-seat] [class*=_trailing] > button[class*=_primary] > svg {\n  color: inherit !important;\n}\n\n[data-composer-seat] [class*=_trailing] > button[class*=_primary]:has(> svg path[d^=\"M8.3125 0.98\"]) > svg {\n  display: none !important;\n}\n\n[data-composer-seat] [class*=_trailing] > button[class*=_primary]:has(> svg path[d^=\"M8.3125 0.98\"])::before {\n  content: \"\";\n  width: 15px;\n  height: 15px;\n  background: currentColor;\n  -webkit-mask: url(\"data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2024%2024'%20fill%3D'none'%20stroke%3D'black'%20stroke-width%3D'2.1'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20d%3D'M18.5%205.5v6a3%203%200%200%201-3%203H5.5'%2F%3E%3Cpath%20d%3D'M9.5%2010.5l-4%204%204%204'%2F%3E%3C%2Fsvg%3E\") center/15px 15px no-repeat;\n  mask: url(\"data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2024%2024'%20fill%3D'none'%20stroke%3D'black'%20stroke-width%3D'2.1'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20d%3D'M18.5%205.5v6a3%203%200%200%201-3%203H5.5'%2F%3E%3Cpath%20d%3D'M9.5%2010.5l-4%204%204%204'%2F%3E%3C%2Fsvg%3E\") center/15px 15px no-repeat;\n}\n\n/* running: the same key, in the same slot, turned into a small rounded stop square */\n/* the stop key gets the + key's treatment too: no fill at rest, the same wash on hover */\n[data-composer-seat] [class*=_trailing] > button[class*=_primary]:is([aria-label*=停止], [aria-label*=Stop i]) > svg {\n  display: none !important;\n}\n\n[data-composer-seat] [class*=_trailing] > button[class*=_primary]:is([aria-label*=停止], [aria-label*=Stop i])::before {\n  content: \"\";\n  width: 9px;\n  height: 9px;\n  border-radius: 2.5px;\n  background: currentColor;\n}"

// ===== src/styles/01-composer-markdown.scss
/* compiled from src/styles/01-composer-markdown.scss by build.mjs — edit the .scss, not this file */
const CSS_COMPOSER_MARKDOWN = "[data-composer-input]::highlight(dcbmd-hide) {\n  color: transparent;\n  text-shadow: none;\n}\n\n[data-composer-input]::highlight(dcbmd-accent) {\n  color: var(--dsw-alias-label-tertiary);\n}\n\n[data-composer-input]::highlight(dcbmd-code) {\n  color: #c6613f;\n  background-color: color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent);\n}\n\n[data-composer-input]::highlight(dcbmd-fence) {\n  color: var(--dsw-alias-label-secondary);\n  background-color: color-mix(in srgb, var(--dsw-alias-label-primary) 5%, transparent);\n}\n\n[data-composer-input]::highlight(dcbmd-strong) {\n  color: var(--dsw-alias-label-primary);\n  text-shadow: 0.35px 0 0 currentColor, -0.2px 0 0 currentColor;\n}\n\n[data-composer-input]::highlight(dcbmd-em) {\n  color: color-mix(in srgb, var(--dsw-alias-label-primary) 72%, #c6613f);\n}\n\n[data-composer-input]::highlight(dcbmd-head) {\n  color: var(--dsw-alias-label-primary);\n  text-shadow: 0.4px 0 0 currentColor, -0.2px 0 0 currentColor;\n}\n\n[data-composer-input]::highlight(dcbmd-link) {\n  color: var(--dsw-alias-link, #2f6fdd);\n  text-decoration: underline;\n  text-decoration-color: color-mix(in srgb, var(--dsw-alias-link, #2f6fdd) 40%, transparent);\n}\n\n[data-composer-input]::highlight(dcbmd-strike) {\n  color: var(--dsw-alias-label-tertiary);\n  text-decoration: line-through;\n}\n\n[data-composer-input]::highlight(dcbmd-quote) {\n  color: var(--dsw-alias-label-secondary);\n}"

// ===== src/styles/02-composer-oneline.scss
/* compiled from src/styles/02-composer-oneline.scss by build.mjs — edit the .scss, not this file */
const CSS_COMPOSER_ONELINE = "/* one-row composer (Claude style): [+] [input] [send] in the card, mode / model / stats on one line below */\n[class*=_root]:has(> [data-composer-card]) {\n  display: grid !important;\n  grid-template-columns: auto auto minmax(0, 1fr) auto auto auto;\n  grid-template-rows: auto auto auto auto;\n  align-items: center;\n  column-gap: 10px;\n  width: 100%;\n  max-width: calc(var(--dsh-composer-card-max-width, 672px) + 32px);\n  margin-inline: auto;\n  box-sizing: border-box;\n  position: relative;\n  isolation: isolate;\n  --dsw-elevation-stroke-color:var(--dsw-alias-border-l2);\n}\n\n[class*=_root]:has(> [data-composer-card])::before {\n  content: \"\";\n  grid-row: 1/4;\n  grid-column: 1/-1;\n  align-self: stretch;\n  z-index: -1;\n  border-radius: var(--dsw-radius-lg, 16px);\n  background: var(--dsw-specific-input-major);\n  box-shadow: var(--dsw-elevation-soft);\n}\n\n[class*=_root]:has(> [data-composer-card]) > [data-composer-card], [class*=_root]:has(> [data-composer-card]) > [data-composer-card] > [class*=_row], [class*=_root]:has(> [data-composer-card]) > [data-composer-card] > [class*=_row] > [class*=_tools], [class*=_root]:has(> [data-composer-card]) > [data-composer-card] > [class*=_row] > [class*=_trailing] {\n  display: contents !important;\n}\n\n[class*=_root]:has(> [data-composer-card]) > [data-composer-card] > [data-composer-overlay] {\n  grid-row: 1;\n  grid-column: 1/-1;\n  position: relative;\n  align-self: start;\n}\n\n[class*=_root]:has(> [data-composer-card]) > [data-composer-card] > [data-slot=\"conversation.input.attachments\"] > * {\n  grid-row: 2;\n  grid-column: 1/-1;\n  padding: 8px 12px 0;\n}\n\n[class*=_root]:has(> [data-composer-card]) > [data-composer-card] > [data-input-scroll] {\n  grid-row: 3;\n  grid-column: 1/-1;\n  margin: 0 !important;\n  padding: 0 50px 0 46px;\n  box-sizing: border-box;\n}\n\n[class*=_root]:has(> [data-composer-card]) > [data-composer-card] [data-composer-input] {\n  padding: 10px 0 !important;\n  min-height: 44px !important;\n  box-sizing: border-box;\n}\n\n[class*=_root]:has(> [data-composer-card]) > [data-composer-card] [data-composer-placeholder] {\n  top: 10px !important;\n  left: 0 !important;\n  right: 0;\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n}\n\n[class*=_root]:has(> [data-composer-card]) > [data-composer-card] > [class*=_row] > [class*=_tools] > [class*=_add] {\n  grid-row: 3;\n  grid-column: 1/-1;\n  justify-self: start;\n  align-self: end;\n  margin: 0 0 8px 9px;\n}\n\n[class*=_root]:has(> [data-composer-card]) > [data-composer-card] > [class*=_row] > [class*=_trailing] > [class*=_primary] {\n  grid-row: 3;\n  grid-column: 1/-1;\n  justify-self: end;\n  align-self: end;\n  margin: 0 9px 8px 0;\n}\n\n/* While a reply runs the trailing primary key becomes the stop one (aria-label 停止): it keeps the\n   send key's slot, mirrored with + around the card's centre. Only if dsh renders both at once does\n   the stop step one button to the left, so it stays visible beside the send. */\n[class*=_root]:has(> [data-composer-card]) > [data-composer-card] > [class*=_row] > [class*=_trailing]:has(> button[class*=_primary]:is([aria-label*=停止], [aria-label*=Stop i])):has(> button[class*=_primary]:not(:is([aria-label*=停止], [aria-label*=Stop i]))) > button[class*=_primary]:is([aria-label*=停止], [aria-label*=Stop i]) {\n  margin-right: 43px;\n}\n\n[class*=_root]:has(> [data-composer-card]) > [data-composer-card] > [class*=_row] > [class*=_trailing] > [class*=_activity] {\n  grid-row: 3;\n  grid-column: 1/-1;\n  justify-self: end;\n  align-self: end;\n  margin: 0 50px 12px 0;\n}\n\n[class*=_root]:has(> [data-composer-card]) > [data-composer-card] > [class*=_row] > [class*=_tools] > [class*=_modes] {\n  grid-row: 4;\n  grid-column: 5;\n  justify-self: end;\n  margin-top: 6px;\n}\n\n[class*=_root]:has(> [data-composer-card]) > [data-composer-card] > [class*=_row] > [class*=_tools] > [data-slot=\"conversation.input.left\"] > * {\n  grid-row: 4;\n  grid-column: 3;\n  justify-self: start;\n  margin-top: 6px;\n}\n\n[class*=_root]:has(> [data-composer-card]) > [data-composer-card] > [class*=_row] > [class*=_trailing] > [class*=_standardControls] {\n  grid-row: 4;\n  grid-column: 4;\n  justify-self: end;\n  margin-top: 6px;\n}\n\n[class*=_root]:has(> [data-composer-card]) > [data-composer-dock] {\n  display: contents !important;\n}\n\n/* marker for other plugins (dsh-claude-theme): this root is laid out by us, its card is display:contents */\n[class*=_root]:has(> [data-composer-card]) {\n  --dco-on:1;\n}\n\n/* the input dock (queue tray, goal strip, notices) is a row in dsh: every entry sizes to its content and\n   they end up side by side, squeezed, each showing the page through its own fill. Stack them instead —\n   one full-width card per row, above the composer, like the tray was when it was the only entry. */\n[data-slot=\"conversation.input.dock\"] {\n  display: flex !important;\n  flex-direction: column !important;\n  align-items: stretch !important;\n  gap: 6px !important;\n  width: 100% !important;\n  max-width: var(--dsh-composer-card-max-width, 672px) !important;\n  margin: 0 auto !important;\n}\n\n[data-slot=\"conversation.input.dock\"] > * {\n  width: 100% !important;\n  min-width: 0 !important;\n  flex: none !important;\n}\n\n[class*=_root]:has(> [data-composer-card]) > [data-composer-dock] > [data-slot=\"conversation.composer.dock\"] > * {\n  grid-row: 4;\n  margin-top: 6px;\n}\n\n[class*=_root]:has(> [data-composer-card]) > [data-composer-dock] [data-composer-stat=activity] {\n  grid-column: 1;\n  justify-self: start;\n  margin-left: 6px;\n}\n\n[class*=_root]:has(> [data-composer-card]) > [data-composer-dock] [data-composer-stat=usage] {\n  grid-column: 2;\n  justify-self: start;\n}\n\n/* context usage ring at the right end of the meta line: dsh-claude-context's ring, or, when that plugin is off,\n   dsh's own meter (a direct child of the dock, not a slot entry; without a place it fell into the flexible column) */\n[class*=_root]:has(> [data-composer-card]) > [data-composer-dock] .clx-dock-ring {\n  grid-column: 6;\n  justify-self: end;\n  margin-right: 4px;\n}\n\n[class*=_root]:has(> [data-composer-card]) > [data-composer-dock] > :not([data-slot]) {\n  grid-row: 4;\n  grid-column: 6;\n  justify-self: end;\n  align-self: center;\n  margin: 6px 4px 0 0;\n}\n\n/* its panel stays invisible until it has been lined up with the ring (no frame at dsh's own spot) */\nbody:has([data-composer-dock] > :not([data-slot]) button[aria-haspopup=dialog][aria-expanded=true]) [role=dialog][style*=\"--dsh-anchored-max-width\"]:not([data-dco-placed]) {\n  visibility: hidden !important;\n}\n\n/* …then opens like the mode and model menus beside it (dsh's panel has no animation of its own) */\n[role=dialog][data-dco-placed] {\n  animation: dco-in 0.16s cubic-bezier(0.2, 0.8, 0.2, 1) both;\n  transform-origin: bottom right;\n}\n\n@keyframes dco-in {\n  from {\n    opacity: 0;\n    transform: translateY(4px) scale(0.98);\n  }\n}\n@media (prefers-reduced-motion: reduce) {\n  [role=dialog][data-dco-placed] {\n    animation: none;\n  }\n}\n[class*=_root]:has(> [data-composer-card]) > [data-composer-dock] [data-composer-stat] {\n  opacity: 0.72;\n  transition: opacity 0.15s ease;\n}\n\n[class*=_root]:has(> [data-composer-card]) > [data-composer-dock] [data-composer-stat]:hover, [class*=_root]:has(> [data-composer-card]) > [data-composer-dock] [data-composer-stat]:focus-within {\n  opacity: 1;\n}\n\n[class*=_root]:has(> [data-composer-card]) > [data-composer-dock] [data-composer-stat] svg {\n  display: none;\n}\n\n[class*=_root]:has(> [data-composer-card]) > [data-composer-card] > [class*=_row][data-model-compact] {\n  --dsh-composer-model-text-display:block;\n  --dsh-composer-model-icon-display:none;\n}\n\n[class*=_root][data-dco-narrow]:has(> [data-composer-card]) > [data-composer-card] > [class*=_row][data-model-compact] {\n  --dsh-composer-model-text-display:none;\n  --dsh-composer-model-icon-display:block;\n}\n\n[class*=_root][data-dco-narrow]:has(> [data-composer-card]) > [data-composer-dock] [data-composer-stat] {\n  grid-row: 5;\n  margin-top: 2px;\n}\n\n[class*=_root][data-dco-narrow]:has(> [data-composer-card]) > [data-composer-dock] [data-composer-stat=activity] {\n  grid-column: 1/-1;\n  justify-self: start;\n}\n\n[class*=_root][data-dco-narrow]:has(> [data-composer-card]) > [data-composer-dock] [data-composer-stat=usage] {\n  grid-column: 1/-1;\n  justify-self: end;\n  margin-right: 4px;\n}"

// ===== src/styles/03-composer-hints.scss
/* compiled from src/styles/03-composer-hints.scss by build.mjs — edit the .scss, not this file */
const CSS_COMPOSER_HINTS = "[class*=_root]:has(> [data-composer-card])[data-dch-ph] [data-composer-placeholder] {\n  font-size: 0 !important;\n}\n\n[class*=_root]:has(> [data-composer-card])[data-dch-ph] [data-composer-placeholder]::before {\n  content: var(--dch-ph);\n  font-size: 14px;\n}"

// ===== src/styles/04-queue-tray.scss
/* compiled from src/styles/04-queue-tray.scss by build.mjs — edit the .scss, not this file */
const CSS_QUEUE_TRAY = "[data-queue-dock] {\n  display: none !important;\n}\n\n.dqt {\n  margin: 0 auto 8px;\n  width: 100%;\n  max-width: var(--dsh-composer-card-max-width, 672px);\n  box-sizing: border-box;\n  border-radius: 12px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  background: var(--dsw-specific-input-major, #fff);\n  padding: 4px 6px 4px 12px;\n  overflow: hidden;\n  animation: dqt-in 0.16s cubic-bezier(0.2, 0.8, 0.2, 1) both;\n}\n\n@keyframes dqt-in {\n  from {\n    opacity: 0;\n    transform: translateY(4px);\n  }\n}\n@media (prefers-reduced-motion: reduce) {\n  .dqt {\n    animation: none;\n  }\n}\n.dqt-head {\n  display: flex;\n  align-items: center;\n  gap: 2px;\n  padding: 0 0 2px;\n}\n\n.dqt-toggle {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  flex: 1;\n  min-width: 0;\n  border: 0;\n  background: none;\n  cursor: pointer;\n  padding: 2px 4px;\n  border-radius: 6px;\n  color: var(--dsw-alias-label-primary);\n  font: inherit;\n  font-size: 13px;\n  font-weight: 500;\n  text-align: left;\n}\n\n.dqt-toggle:hover {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n.dqt-toggle svg {\n  width: 14px;\n  height: 14px;\n  color: var(--dsw-alias-label-tertiary);\n  flex: none;\n}\n\n.dqt-chev {\n  display: flex;\n  margin-left: 1px;\n  color: var(--dsw-alias-label-tertiary);\n  transition: transform 0.16s ease;\n}\n\n.dqt-chev svg {\n  width: 14px;\n  height: 14px;\n}\n\n.dqt[data-open=\"0\"] .dqt-chev {\n  transform: rotate(-90deg);\n}\n\n.dqt-all {\n  flex: none;\n}\n\n.dqt-list {\n  list-style: none;\n  margin: 0;\n  padding: 0;\n  max-height: 264px;\n  overflow-y: auto;\n  overscroll-behavior: contain;\n  scrollbar-width: thin;\n  scrollbar-color: var(--dsw-alias-border-l2) transparent;\n}\n\n.dqt-list::-webkit-scrollbar {\n  width: 8px;\n}\n\n.dqt-list::-webkit-scrollbar-thumb {\n  background: var(--dsw-alias-border-l2);\n  border-radius: 4px;\n  border: 2px solid transparent;\n  background-clip: content-box;\n}\n\n.dqt-list::-webkit-scrollbar-thumb:hover {\n  background: var(--dsw-alias-label-tertiary);\n  border: 2px solid transparent;\n  background-clip: content-box;\n}\n\n.dqt-list::-webkit-scrollbar-track {\n  background: transparent;\n}\n\n.dqt-row {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  min-height: 28px;\n  padding: 0;\n  border-radius: 8px;\n}\n\n.dqt-row[data-busy=\"1\"] {\n  opacity: 0.6;\n}\n\n.dqt-idx {\n  flex: none;\n  font-size: 11px;\n  font-variant-numeric: tabular-nums;\n  color: var(--dsw-alias-label-tertiary);\n  min-width: 14px;\n  text-align: right;\n}\n\n.dqt-preview {\n  flex: 1;\n  min-width: 0;\n  font-size: 13px;\n  line-height: 20px;\n  color: var(--dsw-alias-label-secondary);\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.dqt-preview [class*=_markdown] {\n  display: inline;\n}\n\n.dqt-thumbs {\n  display: flex;\n  gap: 4px;\n  flex: none;\n  align-self: center;\n}\n\n.dqt-thumbs img {\n  width: 24px;\n  height: 24px;\n  object-fit: cover;\n  border-radius: 6px;\n}\n\n.dqt-file {\n  display: flex;\n  align-items: center;\n  gap: 4px;\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n  max-width: 120px;\n  overflow: hidden;\n  white-space: nowrap;\n  text-overflow: ellipsis;\n}\n\n.dqt-status {\n  flex: none;\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  font-size: 12px;\n  line-height: 20px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.dqt-spin {\n  width: 12px;\n  height: 12px;\n  border-radius: 50%;\n  corner-shape: round;\n  border: 1.5px solid var(--dsw-alias-border-l2);\n  border-top-color: var(--dsw-alias-label-secondary);\n  animation: dqt-spin 0.8s linear infinite;\n}\n\n@keyframes dqt-spin {\n  to {\n    transform: rotate(360deg);\n  }\n}\n.dqt-actions {\n  display: flex;\n  align-items: center;\n  gap: 2px;\n  flex: none;\n  margin-left: 2px;\n}\n\n.dqt-btn {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  width: 26px;\n  height: 26px;\n  border: 0;\n  border-radius: 8px;\n  background: none;\n  color: var(--dsw-alias-label-tertiary);\n  cursor: pointer;\n  padding: 0;\n  align-self: center;\n  transition: background-color 0.12s ease, color 0.12s ease;\n}\n\n.dqt-btn svg {\n  width: 14px;\n  height: 14px;\n}\n\n.dqt-btn:hover:not(:disabled) {\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-primary);\n}\n\n.dqt-btn:focus-visible {\n  outline: 2px solid var(--dsw-alias-border-l2);\n  outline-offset: 1px;\n}\n\n.dqt-btn:disabled {\n  opacity: 0.4;\n  cursor: default;\n}\n\n.dqt-btn[data-kind=steer] {\n  color: var(--dsw-alias-label-secondary);\n}\n\n.dqt-btn[data-kind=steer]:hover:not(:disabled) {\n  color: #2f6fdd;\n  background: color-mix(in srgb, #2f6fdd 10%, transparent);\n}\n\n.dqt-btn[data-kind=remove]:hover:not(:disabled) {\n  color: #c4453c;\n  background: color-mix(in srgb, #c4453c 10%, transparent);\n}\n\n.dqt-btn[data-kind=save] {\n  color: #2f6fdd;\n}\n\n.dqt-all {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  border: 0;\n  border-radius: 6px;\n  background: none;\n  cursor: pointer;\n  padding: 2px 6px;\n  font: inherit;\n  font-size: 12px;\n  font-weight: 500;\n  color: var(--dsw-alias-label-secondary);\n  transition: background-color 0.12s ease, color 0.12s ease;\n}\n\n.dqt-all svg {\n  width: 13px;\n  height: 13px;\n}\n\n.dqt-all:hover:not(:disabled) {\n  background: color-mix(in srgb, #2f6fdd 10%, transparent);\n  color: #2f6fdd;\n}\n\n.dqt-all:disabled {\n  opacity: 0.4;\n  cursor: default;\n}\n\n/* editing in place: dsh's InlineEditor brings its own heavy input chrome; keep a frame — it marks the\n   editable field — but make it the tray's own hairline box, and give its two keys the row's wash. */\n.dqt-edit {\n  flex: 1;\n  min-width: 0;\n  display: flex;\n  align-items: center;\n  gap: 2px;\n}\n\n.dqt-edit input, .dqt-edit textarea, [data-composer-card] .dqt-edit input, [data-composer-card] .dqt-edit textarea {\n  flex: 1;\n  min-width: 0;\n  height: 30px;\n  padding: 0 8px !important;\n  border: 1px solid var(--dsw-alias-border-l2) !important;\n  border-radius: 8px !important;\n  background: transparent !important;\n  box-shadow: none !important;\n  outline: none !important;\n  font: inherit !important;\n  font-size: 13px !important;\n  line-height: 20px !important;\n  color: var(--dsw-alias-label-primary) !important;\n  transition: border-color 0.12s ease;\n}\n\n.dqt-edit input:hover, .dqt-edit textarea:hover {\n  border-color: var(--dsw-alias-border-l3) !important;\n}\n\n.dqt-edit input:focus, .dqt-edit textarea:focus, .dqt-edit input:focus-visible, .dqt-edit textarea:focus-visible {\n  border-color: var(--dsw-alias-border-l4) !important;\n  box-shadow: none !important;\n  outline: none !important;\n}\n\n.dqt-edit button {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  flex: none;\n  width: 26px;\n  height: 26px;\n  padding: 0;\n  border: 0;\n  border-radius: 8px;\n  background: none;\n  cursor: pointer;\n  color: var(--dsw-alias-label-tertiary);\n  transition: background-color 0.12s ease, color 0.12s ease;\n}\n\n.dqt-edit button:hover:not(:disabled) {\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-primary);\n}\n\n.dqt-edit button:disabled {\n  opacity: 0.4;\n  cursor: default;\n}\n\n.dqt-edit button svg {\n  width: 14px;\n  height: 14px;\n}"

// ===== src/styles/05-mode-menu.scss
/* compiled from src/styles/05-mode-menu.scss by build.mjs — edit the .scss, not this file */
const CSS_MODE_MENU = ".dmm-trigger {\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  height: 28px;\n  padding: 0 8px 0 7px;\n  border: 0;\n  border-radius: 8px;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  font: inherit;\n  font-size: 13px;\n  cursor: pointer;\n  white-space: nowrap;\n  transition: background-color 0.15s ease, color 0.15s ease;\n}\n\n.dmm-trigger:hover, .dmm-trigger[aria-expanded=true] {\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-primary);\n}\n\n.dmm-trigger:disabled {\n  opacity: 0.55;\n  cursor: default;\n}\n\n.dmm-trigger .sep {\n  opacity: 0.5;\n}\n\n.dmm-chev {\n  transition: transform 0.18s ease;\n  opacity: 0.7;\n}\n\n.dmm-trigger[aria-expanded=true] .dmm-chev {\n  transform: rotate(180deg);\n}\n\n.dmm-pop {\n  box-sizing: border-box;\n  position: fixed;\n  z-index: 1000;\n  min-width: 0;\n  max-width: calc(100vw - 24px);\n  padding: 6px;\n  border: 0;\n  border-radius: var(--dsw-radius-lg, 16px);\n  background: var(--dsw-specific-menu, var(--dsw-alias-bg-layer-2));\n  backdrop-filter: var(--dsw-menu-backdrop-filter);\n  -webkit-backdrop-filter: var(--dsw-menu-backdrop-filter);\n  --dsw-elevation-stroke-color:var(--dsw-alias-border-l1);\n  box-shadow: var(--dsw-elevation-prominent, 0 8px 28px rgba(0, 0, 0, 0.18));\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-secondary);\n  animation: dmm-in 0.16s cubic-bezier(0.2, 0.8, 0.2, 1) both;\n  transform-origin: bottom right;\n}\n\n@keyframes dmm-in {\n  from {\n    opacity: 0;\n    transform: translateY(4px) scale(0.98);\n  }\n}\n@media (prefers-reduced-motion: reduce) {\n  .dmm-pop {\n    animation: none;\n  }\n  .dmm-chev {\n    transition: none;\n  }\n}\n.dmm-head {\n  display: flex;\n  align-items: baseline;\n  justify-content: space-between;\n  gap: 16px;\n  padding: 4px 8px 8px;\n  margin-bottom: 6px;\n  border-bottom: 0.5px solid var(--dsw-alias-border-l2);\n}\n\n.dmm-head b {\n  font-weight: 500;\n  font-size: 12px;\n  color: var(--dsw-alias-label-primary);\n}\n\n.dmm-head span {\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.dmm-item {\n  display: grid;\n  grid-template-columns: 18px minmax(0, 1fr) 16px;\n  align-items: center;\n  column-gap: 10px;\n  width: 100%;\n  padding: 6px 8px;\n  border: 0;\n  border-radius: 10px;\n  background: transparent;\n  color: inherit;\n  font: inherit;\n  text-align: left;\n  cursor: pointer;\n}\n\n.dmm-item:hover, .dmm-item.kbd {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n.dmm-item.on {\n  background: transparent;\n}\n\n.dmm-item.on:hover, .dmm-item.on.kbd {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n.dmm-item:disabled {\n  cursor: default;\n  opacity: 0.6;\n}\n\n.dmm-item .dmm-glyph {\n  color: var(--dsw-alias-label-secondary);\n}\n\n.dmm-item.on .dmm-glyph {\n  color: var(--dsw-alias-state-business-primary);\n}\n\n.dmm-item .txt {\n  min-width: 0;\n  display: flex;\n  flex-direction: column;\n  gap: 1px;\n}\n\n.dmm-item .lbl {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  font-size: 13px;\n  line-height: 20px;\n  color: var(--dsw-alias-label-primary);\n}\n\n.dmm-item .desc {\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.dmm-item .chk {\n  color: var(--dsw-alias-state-business-primary);\n  display: inline-flex;\n  justify-content: center;\n}\n\n.dmm-item .num {\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n  text-align: right;\n  font-variant-numeric: tabular-nums;\n}\n\n.dmm-div {\n  height: 0;\n  margin: 6px 8px;\n  border-top: 0.5px solid var(--dsw-alias-border-l2);\n}\n\n.dmm-note {\n  padding: 6px 8px 4px;\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.dmm-note.err {\n  color: var(--dsw-alias-state-error-primary);\n}\n\n[data-slot=\"conversation.input.permission\"]:has(.dmm-trigger) > :not(.dmm-trigger):not(.dmm-pop):not(:has(.dmm-trigger)) {\n  display: none !important;\n}\n\n[data-slot=\"conversation.input.permission\"]:has(.dmm-trigger) ~ [data-slot=\"conversation.input.plan\"], [data-slot=\"conversation.input.plan\"]:has(~ [data-slot=\"conversation.input.permission\"] .dmm-trigger) {\n  display: none !important;\n}\n\n.dmm-trigger.plan {\n  color: var(--dsw-alias-state-business-primary);\n  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, transparent);\n}\n\n.dmm-trigger.risky {\n  color: var(--dsw-alias-state-warning-primary, #C98A1E);\n}\n\n.dmm-badge {\n  font-size: 10px;\n  line-height: 15px;\n  padding: 0 5px;\n  border-radius: 999px;\n  corner-shape: round;\n  background: color-mix(in srgb, var(--dsw-alias-state-warning-primary, #C98A1E) 16%, transparent);\n  color: var(--dsw-alias-state-warning-primary, #C98A1E);\n  font-weight: 600;\n}\n\n.dmm-sw {\n  position: relative;\n  width: 26px;\n  height: 15px;\n  border-radius: 999px;\n  corner-shape: round;\n  background: var(--dsw-alias-border-l3, var(--dsw-alias-border-l2));\n  transition: background-color 0.15s ease;\n}\n\n.dmm-sw::after {\n  content: \"\";\n  position: absolute;\n  top: 2px;\n  left: 2px;\n  width: 11px;\n  height: 11px;\n  border-radius: 50%;\n  corner-shape: round;\n  background: #fff;\n  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);\n  transition: transform 0.15s ease;\n}\n\n.dmm-sw.on {\n  background: var(--dsw-alias-state-business-primary);\n}\n\n.dmm-sw.on::after {\n  transform: translateX(11px);\n}\n\n.dmm-item.plan {\n  grid-template-columns: 18px minmax(0, 1fr) 26px;\n}\n\n.dmm-confirm {\n  margin: 4px 4px 2px;\n  padding: 10px 12px;\n  border-radius: 10px;\n  background: color-mix(in srgb, var(--dsw-alias-state-warning-primary, #C98A1E) 10%, transparent);\n}\n\n.dmm-confirm b {\n  display: block;\n  font-size: 13px;\n  font-weight: 600;\n  margin-bottom: 3px;\n}\n\n.dmm-confirm p {\n  margin: 0 0 9px;\n  font-size: 12px;\n  line-height: 1.45;\n  color: var(--dsw-alias-label-secondary);\n}\n\n.dmm-confirm .row {\n  display: flex;\n  justify-content: flex-end;\n  gap: 6px;\n}\n\n.dmm-btn {\n  height: 26px;\n  padding: 0 12px;\n  border-radius: 7px;\n  border: 1px solid var(--dsw-alias-border-l2);\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  font: inherit;\n  font-size: 12.5px;\n  cursor: pointer;\n}\n\n.dmm-btn.warn {\n  border-color: transparent;\n  background: var(--dsw-alias-state-warning-primary, #C98A1E);\n  color: #fff;\n}\n\n[class*=_root]:has(> [data-composer-card]) .dmm-trigger:not(.dmm-mtrigger):not(.plan):not(.risky) .dmm-glyph {\n  display: none;\n}\n\n[class*=_root]:has(> [data-composer-card]) .dmm-trigger {\n  padding-left: 8px;\n}\n\n[class*=_root]:has(> [data-composer-card]) .dmm-trigger .dmm-chev {\n  display: none;\n}\n\n[class*=_root]:has(> [data-composer-card]) .dmm-trigger {\n  padding-right: 8px;\n}"

// ===== src/styles/06-model-menu.scss
/* compiled from src/styles/06-model-menu.scss by build.mjs — edit the .scss, not this file */
const CSS_MODEL_MENU = ".dmd-trigger {\n  display: inline-flex;\n  align-items: center;\n  gap: 5px;\n  height: 28px;\n  padding: 0 8px 0 7px;\n  border: 0;\n  border-radius: 8px;\n  background: transparent;\n  color: var(--dsw-alias-label-secondary);\n  font: inherit;\n  font-size: 13px;\n  cursor: pointer;\n  white-space: nowrap;\n  transition: background-color 0.15s ease, color 0.15s ease;\n}\n\n.dmd-trigger:hover, .dmd-trigger[aria-expanded=true] {\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-primary);\n}\n\n.dmd-trigger:disabled {\n  opacity: 0.55;\n  cursor: default;\n}\n\n.dmd-trigger .sep {\n  opacity: 0.5;\n}\n\n.dmd-chev {\n  transition: transform 0.18s ease;\n  opacity: 0.7;\n}\n\n.dmd-trigger[aria-expanded=true] .dmd-chev {\n  transform: rotate(180deg);\n}\n\n.dmd-pop {\n  box-sizing: border-box;\n  position: fixed;\n  z-index: 1000;\n  min-width: 0;\n  max-width: calc(100vw - 24px);\n  padding: 6px;\n  border: 0;\n  border-radius: var(--dsw-radius-lg, 16px);\n  background: var(--dsw-specific-menu, var(--dsw-alias-bg-layer-2));\n  backdrop-filter: var(--dsw-menu-backdrop-filter);\n  -webkit-backdrop-filter: var(--dsw-menu-backdrop-filter);\n  --dsw-elevation-stroke-color:var(--dsw-alias-border-l1);\n  box-shadow: var(--dsw-elevation-prominent, 0 8px 28px rgba(0, 0, 0, 0.18));\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-secondary);\n  animation: dmd-in 0.16s cubic-bezier(0.2, 0.8, 0.2, 1) both;\n  transform-origin: bottom left;\n}\n\n@keyframes dmd-in {\n  from {\n    opacity: 0;\n    transform: translateY(4px) scale(0.98);\n  }\n}\n@media (prefers-reduced-motion: reduce) {\n  .dmd-pop {\n    animation: none;\n  }\n  .dmd-chev {\n    transition: none;\n  }\n}\n.dmd-head {\n  display: flex;\n  align-items: baseline;\n  justify-content: space-between;\n  gap: 16px;\n  padding: 4px 8px 8px;\n  margin-bottom: 6px;\n  border-bottom: 0.5px solid var(--dsw-alias-border-l2);\n}\n\n.dmd-head b {\n  font-weight: 500;\n  font-size: 12px;\n  color: var(--dsw-alias-label-primary);\n}\n\n.dmd-head span {\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.dmd-item {\n  display: grid;\n  grid-template-columns: 18px minmax(0, 1fr) 16px 14px;\n  align-items: center;\n  column-gap: 10px;\n  width: 100%;\n  padding: 6px 8px;\n  border: 0;\n  border-radius: 10px;\n  background: transparent;\n  color: inherit;\n  font: inherit;\n  text-align: left;\n  cursor: pointer;\n}\n\n.dmd-item:hover, .dmd-item.kbd {\n  background: var(--dsw-alias-interactive-bg-hover);\n}\n\n.dmd-item.on {\n  background: var(--dsw-alias-interactive-bg-active, var(--dsw-alias-interactive-bg-hover));\n}\n\n.dmd-item:disabled {\n  cursor: default;\n  opacity: 0.6;\n}\n\n.dmd-item .dmd-glyph {\n  color: var(--dsw-alias-label-secondary);\n}\n\n.dmd-item.on .dmd-glyph {\n  color: var(--dsw-alias-state-business-primary);\n}\n\n.dmd-item .txt {\n  min-width: 0;\n  display: flex;\n  flex-direction: column;\n  gap: 1px;\n}\n\n.dmd-item .lbl {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  font-size: 13px;\n  line-height: 20px;\n  color: var(--dsw-alias-label-primary);\n}\n\n.dmd-item .desc {\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.dmd-item .chk {\n  color: var(--dsw-alias-state-business-primary);\n  display: inline-flex;\n  justify-content: center;\n}\n\n.dmd-item .num {\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n  text-align: right;\n  font-variant-numeric: tabular-nums;\n}\n\n.dmd-div {\n  height: 0;\n  margin: 6px 8px;\n  border-top: 0.5px solid var(--dsw-alias-border-l2);\n}\n\n.dmd-note {\n  padding: 6px 8px 4px;\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.dmd-note.err {\n  color: var(--dsw-alias-state-error-primary);\n}\n\n.dmd-mtrigger .nm {\n  max-width: 220px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  color: var(--dsw-alias-label-primary);\n}\n\n.dmd-mtrigger .eff {\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.dmd-mpop {\n  display: flex;\n  flex-direction: column;\n  overflow: hidden;\n  transform-origin: bottom right;\n}\n\n.dmd-mrow {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr) auto 16px;\n  grid-template-areas: \"l v c\" \"s s c\";\n  align-items: center;\n  column-gap: 10px;\n  width: 100%;\n  min-height: 32px;\n  padding: 6px 8px;\n  border: 0;\n  border-radius: 10px;\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  font: inherit;\n  font-size: 13px;\n  text-align: left;\n  cursor: pointer;\n  flex: none;\n}\n\n.dmd-mrow:hover, .dmd-mrow:focus-visible {\n  background: var(--dsw-alias-interactive-bg-hover);\n  outline: none;\n}\n\n.dmd-mrow:disabled {\n  cursor: default;\n  opacity: 0.6;\n}\n\n.dmd-mrow .lbl {\n  grid-area: l;\n  min-width: 0;\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}\n\n.dmd-mrow .lbl .nm {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.dmd-mrow .sub {\n  grid-area: s;\n  font-size: 12px;\n  line-height: 18px;\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.dmd-mrow .chk {\n  grid-area: c;\n  color: var(--dsw-alias-state-business-primary);\n  display: inline-flex;\n  justify-content: center;\n}\n\n.dmd-mrow .num {\n  grid-area: n;\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n  text-align: right;\n  font-variant-numeric: tabular-nums;\n}\n\n.dmd-mrow.nav {\n  grid-template-columns: minmax(0, 1fr) auto 14px;\n  grid-template-areas: \"l v x\";\n}\n\n.dmd-mrow .val {\n  grid-area: v;\n  font-size: 12px;\n  color: var(--dsw-alias-label-tertiary);\n  white-space: nowrap;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  max-width: 100px;\n}\n\n.dmd-mrow.nav > svg {\n  grid-area: x;\n  color: var(--dsw-alias-menu-icon, var(--dsw-alias-label-tertiary));\n}\n\n.dmd-mback {\n  display: flex;\n  align-items: center;\n  gap: 6px;\n  width: 100%;\n  padding: 4px 8px 6px;\n  margin: 0;\n  border: 0;\n  background: transparent;\n  color: var(--dsw-alias-label-primary);\n  font: inherit;\n  font-size: 13px;\n  font-weight: 500;\n  line-height: 20px;\n  cursor: pointer;\n  text-align: left;\n  flex: none;\n  border-radius: 8px;\n}\n\n.dmd-mback svg {\n  color: var(--dsw-alias-label-tertiary);\n  transition: transform 0.12s ease;\n}\n\n.dmd-mback:hover svg {\n  color: var(--dsw-alias-label-primary);\n  transform: translateX(-1px);\n}\n\n/* search: a soft filled field with a magnifier, no blue ring */\n.dmd-msearch {\n  flex: none;\n  box-sizing: border-box;\n  width: auto;\n  margin: 2px 4px 6px;\n  height: 32px;\n  padding: 0 10px 0 30px;\n  border: 0;\n  border-radius: 8px;\n  background: color-mix(in srgb, var(--dsw-alias-label-primary) 5%, transparent) url(\"data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'%23888'%20stroke-width%3D'1.5'%20stroke-linecap%3D'round'%3E%3Ccircle%20cx%3D'7'%20cy%3D'7'%20r%3D'4.5'%2F%3E%3Cpath%20d%3D'm10.5%2010.5%203%203'%2F%3E%3C%2Fsvg%3E\") no-repeat 10px center/14px 14px;\n  color: var(--dsw-alias-label-primary);\n  font: inherit;\n  font-size: 13px;\n  outline: none;\n  transition: background-color 0.12s ease, box-shadow 0.12s ease;\n}\n\n.dmd-msearch::placeholder {\n  color: var(--dsw-alias-label-tertiary);\n}\n\n.dmd-msearch:hover {\n  background-color: color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent);\n}\n\n.dmd-msearch:focus {\n  background-color: color-mix(in srgb, var(--dsw-alias-label-primary) 7%, transparent);\n  box-shadow: inset 0 0 0 0.5px var(--dsw-alias-border-l2);\n}\n\n.dmd-mscroll {\n  min-height: 0;\n  overflow: auto;\n  max-height: 340px;\n  margin: 0 -2px;\n  padding: 0 2px;\n  scrollbar-width: thin;\n  scrollbar-color: transparent transparent;\n  -webkit-mask: linear-gradient(#000 calc(100% - 14px), transparent);\n  mask: linear-gradient(#000 calc(100% - 14px), transparent);\n  padding-bottom: 10px;\n}\n\n.dmd-mscroll:hover {\n  scrollbar-color: var(--dsw-alias-border-l2) transparent;\n}\n\n.dmd-mgroup {\n  position: static;\n  padding: 10px 8px 3px;\n  font-size: 11.5px;\n  line-height: 16px;\n  font-weight: 500;\n  letter-spacing: 0.01em;\n  color: var(--dsw-alias-label-tertiary);\n  background: transparent;\n}\n\n.dmd-mgroup:first-child {\n  padding-top: 4px;\n}\n\n.dmd-mscroll .dmd-mrow {\n  min-height: 30px;\n  padding: 5px 8px;\n}\n\n.dmd-mbadge {\n  flex: none;\n  font-size: 11px;\n  line-height: 17px;\n  padding: 0 7px;\n  border-radius: 999px;\n  corner-shape: round;\n  border: 1px solid var(--dsw-alias-border-l2);\n  color: var(--dsw-alias-label-secondary);\n  font-weight: 400;\n}\n\n.dmd-mbadge.info {\n  color: var(--dsw-alias-state-business-primary);\n  border-color: color-mix(in srgb, var(--dsw-alias-state-business-primary) 35%, transparent);\n}\n\n.dmd-mbadge.success {\n  color: var(--dsw-alias-state-success-primary, #2f9e5b);\n  border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary, #2f9e5b) 35%, transparent);\n}\n\n.dmd-mbadge.warning {\n  color: var(--dsw-alias-state-warning-primary, #C98A1E);\n  border-color: color-mix(in srgb, var(--dsw-alias-state-warning-primary, #C98A1E) 35%, transparent);\n}\n\n[class*=_root]:has(> [data-composer-card]) .dmd-trigger {\n  padding-left: 8px;\n}\n\n[class*=_root]:has(> [data-composer-card]) .dmd-trigger .dmd-chev {\n  display: none;\n}\n\n[class*=_root]:has(> [data-composer-card]) .dmd-trigger {\n  padding-right: 8px;\n}"

// ===== src/styles/07-smooth-caret.scss
/* compiled from src/styles/07-smooth-caret.scss by build.mjs — edit the .scss, not this file */
const CSS_SMOOTH_CARET = "html[data-dsc-caret] [data-composer-input][contenteditable=true] {\n  caret-color: transparent !important;\n}\n\n.dsc-caret {\n  position: fixed;\n  left: 0;\n  top: 0;\n  z-index: 20;\n  width: 2px;\n  border-radius: 1px;\n  pointer-events: none;\n  background: var(--dsw-alias-label-primary);\n  opacity: 0;\n  will-change: transform, opacity;\n  transition: transform 0.09s cubic-bezier(0.2, 0.8, 0.2, 1), height 0.09s ease;\n}\n\n.dsc-caret.on {\n  opacity: 0.92;\n  animation: dsc-breathe 1.15s ease-in-out 0.5s infinite;\n}\n\n.dsc-caret.jump {\n  transition: none;\n}\n\n@keyframes dsc-breathe {\n  0%, 45% {\n    opacity: 0.92;\n  }\n  62%, 85% {\n    opacity: 0;\n  }\n  100% {\n    opacity: 0.92;\n  }\n}\n@media (prefers-reduced-motion: reduce) {\n  .dsc-caret {\n    transition: none;\n  }\n  .dsc-caret.on {\n    animation: none;\n  }\n}"

// ===== src/styles/08-to-bottom.scss
/* compiled from src/styles/08-to-bottom.scss by build.mjs — edit the .scss, not this file */
const CSS_TO_BOTTOM = "[class*=_toBottomSlot] {\n  position: fixed !important;\n  right: auto !important;\n  margin: 0 !important;\n  height: 32px !important;\n  min-height: 32px !important;\n  padding: 0 !important;\n  z-index: 8;\n  display: flex !important;\n  align-items: center;\n  justify-content: center !important;\n  pointer-events: none;\n  visibility: hidden;\n}\n\n[class*=_toBottomSlot] > button {\n  width: 32px !important;\n  height: 32px !important;\n  min-width: 32px !important;\n  margin: 0 !important;\n  padding: 0 !important;\n  border: 0 !important;\n  border-radius: 50% !important;\n  corner-shape: round !important;\n  display: grid !important;\n  place-items: center;\n  position: relative;\n  cursor: pointer;\n  pointer-events: auto !important;\n  color: var(--dsw-alias-label-primary) !important;\n  /* 磨砂：只留一层薄玻璃，让后面那团粒子/极光的颜色透上来，再靠 blur + saturate 磨平细节 */\n  --dtb-glass:color-mix(in srgb,var(--dsw-alias-bg-layer-1,var(--dsw-alias-bg-base,#10151c)) 42%,transparent);\n  --dtb-edge:color-mix(in srgb,var(--dsw-alias-label-primary,#fff) 13%,transparent);\n  background: var(--dtb-glass) !important;\n  -webkit-backdrop-filter: blur(26px) saturate(1.9) brightness(1.06);\n  backdrop-filter: blur(26px) saturate(1.9) brightness(1.06);\n  box-shadow: inset 0 0.5px 0 color-mix(in srgb, #fff 17%, transparent), inset 0 0 0 0.5px var(--dtb-edge), 0 5px 16px rgba(0, 0, 0, 0.2), 0 1px 3px rgba(0, 0, 0, 0.12) !important;\n  transition: background-color 0.16s ease, color 0.16s ease, box-shadow 0.16s ease, transform 0.16s ease;\n}\n\n@media (hover: hover) {\n  [class*=_toBottomSlot] > button:hover {\n    color: var(--dsw-alias-label-primary) !important;\n    background: color-mix(in srgb, var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-base, #10151c)) 58%, transparent) !important;\n    box-shadow: inset 0 0.5px 0 color-mix(in srgb, #fff 20%, transparent), inset 0 0 0 0.5px var(--dsw-alias-border-l3), 0 7px 20px rgba(0, 0, 0, 0.26), 0 1px 3px rgba(0, 0, 0, 0.14) !important;\n  }\n}\n[class*=_toBottomSlot] > button:active {\n  transform: scale(0.96);\n}\n\n/* 关掉透明效果的系统偏好：换成实心，别让字/点糊在背景上 */\n@media (prefers-reduced-transparency: reduce) {\n  [class*=_toBottomSlot] > button {\n    background: var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-base, #10151c)) !important;\n    -webkit-backdrop-filter: none;\n    backdrop-filter: none;\n  }\n}\n[class*=_toBottomSlot] > button > svg {\n  display: none !important;\n}\n\n[class*=_toBottomSlot] > button::before {\n  content: \"\";\n  width: 15px;\n  height: 15px;\n  background: currentColor;\n  -webkit-mask: url(\"data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'black'%20stroke-width%3D'1.6'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20d%3D'M8%202.75v10.5M3.5%208.75%208%2013.25l4.5-4.5'%2F%3E%3C%2Fsvg%3E\") center/15px 15px no-repeat;\n  mask: url(\"data:image/svg+xml,%3Csvg%20xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg'%20viewBox%3D'0%200%2016%2016'%20fill%3D'none'%20stroke%3D'black'%20stroke-width%3D'1.6'%20stroke-linecap%3D'round'%20stroke-linejoin%3D'round'%3E%3Cpath%20d%3D'M8%202.75v10.5M3.5%208.75%208%2013.25l4.5-4.5'%2F%3E%3C%2Fsvg%3E\") center/15px 15px no-repeat;\n}\n\n/* streaming: three dots in the harness accent instead of the arrow */\nhtml:has([data-composer-seat] button:is([aria-label*=停止], [aria-label*=Stop i])) [class*=_toBottomSlot] > button {\n  color: var(--dsw-alias-state-business-primary, #4d6bfe) !important;\n}\n\nhtml:has([data-composer-seat] button:is([aria-label*=停止], [aria-label*=Stop i])) [class*=_toBottomSlot] > button::before {\n  width: 3.5px;\n  height: 3.5px;\n  border-radius: 50%;\n  corner-shape: round;\n  -webkit-mask: none;\n  mask: none;\n  background: currentColor;\n  box-shadow: -6.5px 0 0 currentColor, 6.5px 0 0 currentColor;\n  animation: dtb-pulse 1.15s ease-in-out infinite;\n}\n\n@keyframes dtb-pulse {\n  0%, 100% {\n    opacity: 0.4;\n  }\n  50% {\n    opacity: 1;\n  }\n}\n@media (prefers-reduced-motion: reduce) {\n  html:has([data-composer-seat] button:is([aria-label*=停止], [aria-label*=Stop i])) [class*=_toBottomSlot] > button::before {\n    animation: none;\n    opacity: 0.9;\n  }\n}"

// ===== src/styles/09-stack-cards.scss
/* compiled from src/styles/09-stack-cards.scss by build.mjs — edit the .scss, not this file */
const CSS_STACK_CARDS = "/* the strip itself: same box as the plan card under the newest reply */\n[data-goal-bar] [class*=_bar] {\n  border-radius: 12px !important;\n  box-shadow: none !important;\n  border: 1px solid var(--dsw-alias-border-l2) !important;\n  background: var(--dsw-specific-input-major, #fff) !important;\n  padding: 4px 6px 4px 12px !important;\n  max-width: var(--dsh-composer-card-max-width, 672px) !important;\n}\n\n/* dsh paints the menu surface (fill + backdrop blur) on a ::before layer; the bar carries the fill\n   itself instead, because the strip floats over the scrolling conversation and a see-through fill\n   lets replies show through the label. */\n[data-goal-bar] [class*=_bar]::before {\n  display: none !important;\n}\n\n/* phase label and objective, as in the plan card header */\n[data-goal-bar] [class*=_label] {\n  font-size: 13px;\n  line-height: 22px;\n  font-weight: 500;\n}\n\n[data-goal-bar] [class*=_objective] {\n  font-size: 13px;\n  line-height: 22px;\n  color: var(--dsw-alias-label-secondary);\n}\n\n[data-goal-bar] [class*=_error] {\n  font-size: 12px;\n  line-height: 22px;\n}\n\n[data-goal-bar] [class*=_goalGlyph] {\n  color: var(--dsw-alias-label-tertiary);\n}\n\n/* keys: the queue tray's 26px square wash, not dsh's 28px circle */\n[data-goal-bar] [class*=_iconBtn] {\n  width: 26px;\n  height: 26px;\n  border-radius: 8px;\n  corner-shape: round;\n  color: var(--dsw-alias-label-tertiary);\n  transition: background-color 0.12s ease, color 0.12s ease;\n}\n\n@media (hover: hover) {\n  [data-goal-bar] [class*=_iconBtn]:hover:not(:disabled) {\n    background: var(--dsw-alias-interactive-bg-hover);\n    color: var(--dsw-alias-label-primary);\n  }\n}\n[data-goal-bar] [class*=_iconBtn]:focus-visible {\n  outline: 2px solid var(--dsw-alias-border-l2);\n  outline-offset: 1px;\n}\n\n[data-goal-bar] [class*=_iconBtn]:disabled {\n  opacity: 0.4;\n}\n\n/* the inline edit strip keeps the same box, it just grows with the editor; its field wears the same\n   hairline frame as the queue tray's editor so the two editing surfaces read as one family */\n[data-goal-bar] [class*=_editBar] {\n  height: auto !important;\n  min-height: 36px;\n  gap: 2px;\n}\n\n[data-goal-bar] [class*=_editBar] input, [data-goal-bar] [class*=_editBar] textarea {\n  height: 30px !important;\n  padding: 0 8px !important;\n  border: 1px solid var(--dsw-alias-border-l2) !important;\n  border-radius: 8px !important;\n  background: transparent !important;\n  box-shadow: none !important;\n  outline: none !important;\n  font-family: inherit !important;\n  font-size: 13px !important;\n  line-height: 20px !important;\n  color: var(--dsw-alias-label-primary) !important;\n  transition: border-color 0.12s ease;\n}\n\n[data-goal-bar] [class*=_editBar] input:hover, [data-goal-bar] [class*=_editBar] textarea:hover {\n  border-color: var(--dsw-alias-border-l3) !important;\n}\n\n[data-goal-bar] [class*=_editBar] input:focus, [data-goal-bar] [class*=_editBar] textarea:focus,\n[data-goal-bar] [class*=_editBar] input:focus-visible, [data-goal-bar] [class*=_editBar] textarea:focus-visible {\n  border-color: var(--dsw-alias-border-l4) !important;\n  box-shadow: none !important;\n  outline: none !important;\n}\n\n[data-goal-bar] [class*=_editBar] button {\n  display: flex;\n  align-items: center;\n  justify-content: center;\n  flex: none;\n  width: 26px;\n  height: 26px;\n  padding: 0;\n  border: 0;\n  border-radius: 8px;\n  background: none;\n  cursor: pointer;\n  color: var(--dsw-alias-label-tertiary);\n  transition: background-color 0.12s ease, color 0.12s ease;\n}\n\n[data-goal-bar] [class*=_editBar] button:hover:not(:disabled) {\n  background: var(--dsw-alias-interactive-bg-hover);\n  color: var(--dsw-alias-label-primary);\n}\n\n[data-goal-bar] [class*=_editBar] button svg {\n  width: 14px;\n  height: 14px;\n}"

// ===== src/parts/00-dom-hub.js
"use strict";
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
        const subs = new Set();
        let mo = null;
        let raf = 0;
        let pending = [];
        // childList + characterData cover everything the composer cares about (input typing, slot /
        // seat / dialog mounts). No attributes: the parts that need them keep their own scoped observers.
        const CONFIG = { childList: true, subtree: true, characterData: true };
        function flush() {
            raf = 0;
            const recs = pending;
            pending = [];
            for (const s of [...subs]) {
                try {
                    s.fn(recs);
                }
                catch (e) {
                    console.error('[dsh-composer-display/dom-hub]', e);
                }
            }
        }
        function schedule() { if (!raf)
            raf = requestAnimationFrame(flush); }
        function ensure() {
            if (mo)
                return;
            mo = new MutationObserver((recs) => { pending.push(...recs); schedule(); });
            mo.observe(document.body, CONFIG);
        }
        const el = (n) => (n.nodeType === 1 ? n : n.parentElement);
        /** Did any record touch an element matching sel — as target, or added / removed? O(records). */
        function touches(records, sel) {
            for (const r of records) {
                const t = el(r.target);
                if (t && (t.matches(sel) || t.closest(sel)))
                    return true;
                if (r.type === 'childList') {
                    for (const n of r.addedNodes)
                        if (n.nodeType === 1 && (n.matches(sel) || n.querySelector(sel)))
                            return true;
                    for (const n of r.removedNodes)
                        if (n.nodeType === 1 && (n.matches(sel) || n.querySelector(sel)))
                            return true;
                }
            }
            return false;
        }
        /** Did any record add / remove an element matching sel (a mount / unmount, not a text edit inside)? */
        function mounts(records, sel) {
            for (const r of records) {
                if (r.type !== 'childList')
                    continue;
                for (const n of r.addedNodes)
                    if (n.nodeType === 1 && (n.matches(sel) || n.querySelector(sel)))
                        return true;
                for (const n of r.removedNodes)
                    if (n.nodeType === 1 && (n.matches(sel) || n.querySelector(sel)))
                        return true;
            }
            return false;
        }
        kit.dom = {
            /** fn(records) runs once per frame while mutations occur; returns an unsubscribe. */
            subscribe(fn) {
                const s = { fn };
                subs.add(s);
                ensure();
                return () => {
                    subs.delete(s);
                    if (!subs.size) {
                        if (mo) {
                            mo.disconnect();
                            mo = null;
                        }
                        if (raf) {
                            cancelAnimationFrame(raf);
                            raf = 0;
                        }
                        pending = [];
                    }
                };
            },
            touches,
            mounts,
            /** ask for a dispatch next frame even without a mutation (manual toggles) */
            poke() { schedule(); },
        };
        return { inject: [], apply() { } };
    },
});

// ===== src/parts/01-composer-buttons.js
"use strict";
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
        const sheet = kit.sheet('composer-buttons', CSS_COMPOSER_BUTTONS);
        const mdSheet = kit.sheet('composer-markdown', CSS_COMPOSER_MARKDOWN);
        function startMarkdown() {
            if (!(window.CSS && CSS.highlights))
                return () => { };
            mdSheet.ensure();
            let timer = 0;
            const paint = () => {
                timer = 0;
                const all = Object.fromEntries(MARK_KINDS.map((k) => [k, []]));
                for (const input of document.querySelectorAll(SEL.input)) {
                    try {
                        const r = mdRanges(input);
                        for (const k of MARK_KINDS)
                            all[k].push(...r[k]);
                    }
                    catch (e) {
                        console.error('[dsh-composer-buttons:md]', e);
                    }
                }
                for (const k of MARK_KINDS)
                    CSS.highlights.set('dcbmd-' + k, new Highlight(...all[k]));
            };
            const schedule = () => { if (!timer)
                timer = setTimeout(paint, 16); };
            // one shared body observer (dom-hub); only repaint when a record actually touches an input,
            // so streamed transcript tokens never trigger a highlight pass
            const offHub = kit.dom.subscribe((recs) => { if (kit.dom.touches(recs, '[data-composer-input]'))
                schedule(); });
            document.addEventListener('input', schedule, true);
            schedule();
            return () => {
                offHub();
                document.removeEventListener('input', schedule, true);
                if (timer)
                    clearTimeout(timer);
                for (const k of MARK_KINDS)
                    CSS.highlights.delete('dcbmd-' + k);
                mdSheet.remove();
            };
        }
        return {
            inject: [],
            apply(ctx) {
                ctx.effect(() => { sheet.ensure(); return sheet.remove; }, 'composer-buttons: styles');
                ctx.effect(() => startMarkdown(), 'composer-buttons: markdown highlighting in the input');
            },
        };
    },
});

// ===== src/parts/02-composer-oneline.js
"use strict";
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
        const { React, h } = kit;
        const { useEffect, useRef } = React;
        // ------------------------------------------------------------------ styles
        const { ensure: ensureStyle, remove: removeStyle } = kit.sheet('composer-oneline', CSS_COMPOSER_ONELINE);
        /**
         * dsh's own context meter (shown when dsh-claude-context is off) opens its panel from the ring's left edge.
         * The ring now sits at the right end of the meta line, so the panel ran off to the right: while it is open,
         * its right edge is lined up with the ring's instead (dsh keeps the fixed top; the left is re-applied
         * if dsh re-places the panel).
         */
        function alignMeterPanel(root) {
            let panel = null;
            let pmo = null;
            const trigger = () => root.querySelector(':scope>[data-composer-dock]>:not([data-slot]) button[aria-haspopup="dialog"]');
            const place = () => {
                const t = trigger();
                if (!panel || !panel.isConnected || !t)
                    return;
                const tr = t.getBoundingClientRect();
                const left = Math.max(8, Math.round(tr.right - panel.offsetWidth));
                if (panel.style.left !== `${left}px`)
                    panel.style.left = `${left}px`;
                panel.setAttribute('data-dco-placed', '');
            };
            const release = () => { if (pmo) {
                pmo.disconnect();
                pmo = null;
            } if (hubOff) {
                hubOff();
                hubOff = null;
            } panel = null; };
            let hubOff = null;
            const check = () => {
                const t = trigger();
                if (!t || t.getAttribute('aria-expanded') !== 'true') {
                    release();
                    return;
                }
                // while open, catch the panel the moment it mounts (it is portaled to body) through the shared
                // hub, gated to dialog mounts so streamed transcript tokens never run this check
                if (!hubOff)
                    hubOff = kit.dom.subscribe((recs) => { if (kit.dom.mounts(recs, '[role="dialog"]'))
                        check(); });
                // the newest anchored dialog (dsh's anchored popovers carry --dsh-anchored-max-width inline)
                const found = [...document.querySelectorAll('[role="dialog"]')].reverse()
                    .find((d) => d.style.getPropertyValue('--dsh-anchored-max-width'));
                if (!found || found === panel) {
                    place();
                    return;
                }
                if (pmo)
                    pmo.disconnect();
                panel = found;
                pmo = new MutationObserver(place);
                pmo.observe(panel, { attributes: true, attributeFilter: ['style'] });
                place();
            };
            // MutationObserver callbacks run before the next paint, so the panel is first drawn already in place
            const mo = new MutationObserver(check);
            mo.observe(root, { subtree: true, attributes: true, attributeFilter: ['aria-expanded'] });
            window.addEventListener('resize', place);
            return () => { mo.disconnect(); release(); window.removeEventListener('resize', place); };
        }
        /**
         * An invisible dock entry: it gives the plugin a foothold inside each composer so a
         * ResizeObserver can flag narrow bars (data-dco-narrow). A JS observer rather than
         * container-type: a CSS container would become the containing block of every
         * position:fixed popover inside the bar.
         */
        function NarrowProbe() {
            const ref = useRef(null);
            useEffect(() => {
                const root = ref.current?.closest('[data-composer-dock]')?.parentElement;
                if (!root || typeof ResizeObserver !== 'function')
                    return undefined;
                const ro = new ResizeObserver(() => { root.toggleAttribute('data-dco-narrow', root.clientWidth <= 600); });
                ro.observe(root);
                const stopMeter = alignMeterPanel(root);
                return () => { ro.disconnect(); stopMeter(); root.removeAttribute('data-dco-narrow'); };
            }, []);
            return h('span', { ref, hidden: true, 'data-dco-probe': '' });
        }
        return {
            inject: ['slots'],
            apply(ctx) {
                ensureStyle();
                ctx.effect(() => () => removeStyle(), 'composer-oneline: styles');
                ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
                    name: 'conversation.composer.dock',
                    id: 'composer-oneline-probe',
                    order: 999,
                }, NarrowProbe));
            },
        };
    },
});

// ===== src/parts/03-composer-hints.js
"use strict";
/*!
 * dsh-composer-display-hints — browser half.
 *
 * Claude-style input hints that always describe the keys that actually work:
 *   - idle: a short placeholder;
 *   - running, nothing queued: Enter / ⌘Enter delivery, resolved against the LIVE busy-Enter
 *     preference read from the `ui-conversation` config form — the very store dsh's own submission
 *     policy adopts from, so the hint names the keys that actually fire even with an empty draft and
 *     even for anyone who switched Enter to "steer" (the settings selector / send label are only a
 *     fallback for the brief window before the form serves);
 *   - running, empty draft, messages queued: the empty-draft accelerated chord that steers the
 *     whole queue, with the live count. dsh's own wording for this state names the chord but not
 *     the count and ignores that plain Enter does nothing here.
 * Display only: dsh's plan / unavailable / workspace placeholders are left alone.
 */
part({
    id: 'dsh-composer-hints',
    factory(require, kit) {
        const { React, h } = kit;
        const { useEffect, useRef } = React;
        const NS = 'composer-hints';
        const zh = {
            'ph.idle': '发消息，/ 调用指令，@ 引用文件或对话',
            'ph.queue': '{enter} 排队发送，{mod}{enter} 立即插话',
            'ph.steer': '{enter} 立即插话，{mod}{enter} 排队稍后发送',
            'ph.steerAll': '{mod}{enter} 立即发送全部 {n} 条排队',
        };
        const en = {
            'ph.idle': 'Message, / for commands, @ for files or sessions',
            'ph.queue': '{enter} to queue, {mod}{enter} to steer now',
            'ph.steer': '{enter} to steer now, {mod}{enter} to queue for later',
            'ph.steerAll': '{mod}{enter} sends all {n} queued now',
        };
        const fmt = (s, p) => String(s).replace(/\{(\w+)\}/g, (_, k) => (p && p[k] !== undefined ? String(p[k]) : `{${k}}`));
        const { ensure: ensureStyle, remove: removeStyle } = kit.sheet('composer-hints', CSS_COMPOSER_HINTS);
        let liveBusy = null; // busy-Enter from the ui-conversation config form dsh itself adopts from
        let rpcBusy = null; // Host setting seed, fallback until the form serves
        let poke = null;
        function Hints(props) {
            const { ctx, t } = props;
            const ref = useRef(null);
            useEffect(() => {
                const root = ref.current?.closest(SEL.dock)?.parentElement;
                const card = root?.querySelector(`:scope>${SEL.card}`);
                // the tray (input.dock) and the composer (composer.dock) are siblings under composerStack;
                // observing that common ancestor lets the hint see the live queue count.
                const stack = root?.closest(SEL.stack) || root?.parentElement;
                if (!card || !stack || typeof MutationObserver !== 'function')
                    return undefined;
                const conv = ctx.locale.bind('conversation');
                const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
                const mod = mac ? '⌘' : 'Ctrl+';
                let cached = null;
                const sync = () => {
                    const input = card.querySelector(SEL.input);
                    const ph = input?.getAttribute('data-placeholder');
                    const ours = ph === conv('placeholder.default') || ph === conv('placeholder.steerQueue');
                    if (!input || !ours) {
                        if (root.hasAttribute('data-dch-ph')) {
                            root.removeAttribute('data-dch-ph');
                            root.style.removeProperty('--dch-ph');
                        }
                        return;
                    }
                    const running = !!card.querySelector('[class*="_primary"][aria-label*="停止"], [class*="_primary"][aria-label*="Stop" i], [class*="_primary"] svg rect');
                    const draftEmpty = !(input.textContent || '').trim();
                    const tray = stack.querySelector('[data-dqt]');
                    let n = tray ? parseInt(tray.getAttribute('data-dqt-count') || '0', 10) || 0 : 0;
                    if (!tray) {
                        const dock = stack.querySelector('[data-queue-dock]');
                        if (dock)
                            n = dock.querySelectorAll('li').length;
                    }
                    // live busy-Enter: the ui-conversation config form is authoritative (dsh adopts from it and
                    // it reads even with an empty draft); the settings selector / send label only cover the
                    // brief window before the form serves.
                    let be = liveBusy;
                    if (be == null) {
                        const sel = [...document.querySelectorAll('select')].find((s) => [...s.options].some((o) => o.value === 'steer') && [...s.options].some((o) => o.value === 'queue'));
                        if (sel && (sel.value === 'queue' || sel.value === 'steer'))
                            be = cached = sel.value;
                        else if (running && !draftEmpty) {
                            const label = [...card.querySelectorAll('button')].map((b) => b.getAttribute('aria-label')).find((l) => l === conv('input.send.steer') || l === conv('input.send.queue'));
                            if (label === conv('input.send.steer'))
                                be = cached = 'steer';
                            else if (label === conv('input.send.queue'))
                                be = cached = 'queue';
                        }
                        if (be == null)
                            be = cached ?? rpcBusy ?? 'queue';
                    }
                    const text = !running ? t('ph.idle')
                        : draftEmpty && n > 0 ? fmt(t('ph.steerAll'), { enter: '↵', mod, n })
                            : fmt(t(be === 'steer' ? 'ph.steer' : 'ph.queue'), { enter: '↵', mod });
                    const v = JSON.stringify(text);
                    if (root.style.getPropertyValue('--dch-ph') !== v)
                        root.style.setProperty('--dch-ph', v);
                    // the observer watches the stack that contains root: writing an unchanged attribute
                    // would re-trigger it forever, so only write on an actual change
                    const state = !running ? 'idle' : n > 0 ? 'queue' : 'running';
                    if (root.getAttribute('data-dch-ph') !== state)
                        root.setAttribute('data-dch-ph', state);
                };
                poke = sync;
                sync();
                const mo = new MutationObserver(sync);
                mo.observe(stack, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-placeholder', 'aria-label', 'data-dqt-count'] });
                const offLocale = ctx.locale.subscribe(sync);
                return () => { mo.disconnect(); try {
                    offLocale();
                }
                catch { } ; if (poke === sync)
                    poke = null; root.removeAttribute('data-dch-ph'); root.style.removeProperty('--dch-ph'); };
            }, [ctx, t]);
            return h('span', { ref, hidden: true, 'data-dch-probe': '' });
        }
        return {
            inject: ['slots', 'locale'],
            apply(ctx) {
                ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'composer-hints: dictionaries');
                const t = ctx.locale.bind(NS);
                ensureStyle();
                ctx.effect(() => () => removeStyle(), 'composer-hints: styles');
                ctx.effect(() => {
                    try {
                        const svc = ctx.remote?.settingsController || ctx.remote?.settings;
                        const p = svc?.describe?.();
                        p?.then?.((d) => {
                            const ns = (d?.namespaces || []).find((x) => x.ns === 'ui-conversation');
                            const v = ns?.value?.busyEnter;
                            if (v === 'queue' || v === 'steer') {
                                rpcBusy = v;
                                poke?.();
                            }
                        }, () => { });
                    }
                    catch { }
                    return () => { rpcBusy = null; };
                }, 'composer-hints: busy-Enter seed');
                ctx.inject(['configForms'], (scope) => {
                    ctx.effect(() => {
                        const form = scope.configForms.get('ui-conversation');
                        if (!form?.subscribe)
                            return undefined;
                        const read = () => {
                            const v = form.getSnapshot?.()?.value?.busyEnter;
                            if (v === 'queue' || v === 'steer') {
                                liveBusy = v;
                                poke?.();
                            }
                        };
                        read();
                        const off = form.subscribe(read);
                        return () => { try {
                            off?.();
                        }
                        catch { } ; liveBusy = null; };
                    }, 'composer-hints: busy-Enter form');
                });
                function Slot(props) { return h(Hints, { ...props, ctx, t }); }
                ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
                    name: 'conversation.composer.dock',
                    id: 'composer-hints-probe',
                    order: 998,
                }, Slot));
            },
        };
    },
});

// ===== src/parts/04-queue-tray.js
"use strict";
/*!
 * dsh-queue-tray — browser half.
 *
 * Claude-style queued-message tray above the input, owned end to end: dsh's own dock is hidden and
 * this entry renders the same inbox projection with dsh's own queue operations (steer / edit /
 * remove), so nothing about delivery changes — only the presentation and the affordances:
 *   - every row is visible by default (dsh collapses >1 behind a count header); the header still
 *     collapses on demand and carries a "send all now" action, the gesture the empty-draft
 *     Cmd/Ctrl+Enter chord performs, made visible;
 *   - send-now leads each row and is the only accent control; edit and delete stay quiet until
 *     hovered, delete warms to danger;
 *   - editing reuses dsh's InlineEditor (Enter saves, Esc cancels) and hands focus back to the
 *     composer afterwards, so a corrected message can be sent without reaching for the mouse;
 *   - rows still in flight show a spinner and locked actions until the Host queue row arrives.
 */
part({
    id: 'dsh-queue-tray',
    factory(require, kit) {
        const { React, h } = kit;
        const { useState, useEffect, useMemo, useCallback, useSyncExternalStore } = React;
        let UI = null;
        try {
            UI = require('@deepseek-ai/dsh-client-ui-primitives');
        }
        catch {
            UI = null;
        }
        const NS = 'queue-tray';
        const zh = {
            'q.count': '{n} 条消息排队中',
            'q.steer': '立即发送',
            'q.steerAll': '全部立即发送',
            'q.steer.off': '仅运行中可立即发送',
            'q.edit': '编辑排队消息',
            'q.edit.off': '包含非文本内容，暂不支持编辑',
            'q.remove': '删除排队消息',
            'q.save': '保存',
            'q.cancel': '取消编辑',
            'q.sending': '发送中…',
            'q.failed': '操作失败：这条消息可能已经开始发送。',
            'q.expand': '展开排队消息',
            'q.collapse': '收起排队消息',
        };
        const en = {
            'q.count': '{n} messages queued',
            'q.steer': 'Send now',
            'q.steerAll': 'Send all now',
            'q.steer.off': 'Send-now is available only while the agent runs',
            'q.edit': 'Edit queued message',
            'q.edit.off': 'Contains non-text content; editing is not supported yet',
            'q.remove': 'Remove queued message',
            'q.save': 'Save',
            'q.cancel': 'Cancel editing',
            'q.sending': 'Sending…',
            'q.failed': 'Failed: this message may have already started sending.',
            'q.expand': 'Expand queued messages',
            'q.collapse': 'Collapse queued messages',
        };
        const fmt = (s, p) => String(s).replace(/\{(\w+)\}/g, (_, k) => (p && p[k] !== undefined ? String(p[k]) : `{${k}}`));
        const sheet = kit.sheet('queue-tray', CSS_QUEUE_TRAY);
        const textOf = (content) => {
            const texts = (content || []).filter((b) => b.type === 'text').map((b) => b.text);
            return texts.length ? texts.join('') : null;
        };
        /* dsh wraps each attachment in the block: { type: 'image' | 'file', attachment }. Handing the block
           itself to loadImage() loses attachmentId, so the resolve rejects and the thumb spins forever. */
        const attachmentsOf = (content) => {
            const out = [];
            for (const block of content || []) {
                if ((block.type === 'image' || block.type === 'file') && block.attachment !== undefined) {
                    out.push({ type: block.type, attachment: block.attachment });
                }
            }
            return out;
        };
        function Tip({ label, disabled, children }) {
            if (!UI?.Tooltip || disabled)
                return children;
            return h(UI.Tooltip, { portal: true, label, side: 'bottom', delayMs: 400 }, children);
        }
        const Icon = (name, size) => (UI?.[name] ? h(UI[name], { size }) : null);
        function Action({ kind, label, title, disabled, onClick, icon }) {
            return h(Tip, { label, disabled: !!title }, h('button', {
                type: 'button', className: 'dqt-btn', 'data-kind': kind,
                'aria-label': label, title: title || undefined, disabled: !!disabled, onClick,
            }, Icon(icon, 14)));
        }
        function QueueTray(props) {
            const { ctx, t, useSession, useProjection, updateQueue, notify, loadImage, renderFactorySlot } = props;
            useSyncExternalStore(useCallback((fn) => ctx.locale.subscribe(fn), [ctx]), () => ctx.locale.getSnapshot());
            const inbox = useProjection('inbox');
            const pendingSubmissions = useSession((s) => s.pendingSubmissions);
            const running = useSession((s) => s.running);
            const mutable = useSession((s) => s.subagent === null || s.subagent.address.mode === 'continuable');
            const queue = useMemo(() => {
                const rows = inbox?.['next-turn'] ?? [];
                const inChat = new Set(pendingSubmissions.filter((i) => i.placement === 'transcript').map((i) => i.requestId));
                return inChat.size === 0 ? rows : rows.filter(({ source }) => source.kind !== 'user' || !('rpcId' in source) || !inChat.has(source.rpcId));
            }, [inbox, pendingSubmissions]);
            const pending = useMemo(() => {
                const admitted = new Set(queue.flatMap(({ source }) => (source.kind === 'user' && 'rpcId' in source ? [source.rpcId] : [])));
                return pendingSubmissions.filter((s) => s.placement === 'queued' && !admitted.has(s.requestId));
            }, [pendingSubmissions, queue]);
            const rowCount = queue.length + pending.length;
            const [editing, setEditing] = useState(null);
            const [busy, setBusy] = useState(null);
            const [open, setOpen] = useState(true);
            const [allBusy, setAllBusy] = useState(false);
            useEffect(() => {
                if (rowCount === 0) {
                    setEditing(null);
                    setOpen(true);
                }
                if (editing && !queue.some((r) => r.id === editing.id))
                    setEditing(null);
            }, [rowCount, queue, editing]);
            const focusComposer = useCallback(() => {
                const stack = document.querySelector('.dqt')?.closest(SEL.stack);
                const input = stack?.querySelector(SEL.input) || document.querySelector(SEL.input);
                input?.focus({ preventScroll: true });
            }, []);
            const apply = useCallback(async (id, action) => {
                setBusy(id);
                try {
                    await updateQueue(id, action);
                    return true;
                }
                catch (e) {
                    const code = e?.code || e?.error?.code;
                    if (code === 'session/steer-unavailable' || code === 'session/queue-item-not-found')
                        return false;
                    notify('error', t('q.failed'));
                    return false;
                }
                finally {
                    setBusy((b) => (b === id ? null : b));
                }
            }, [updateQueue, notify, t]);
            const steerAll = useCallback(async () => {
                setAllBusy(true);
                try {
                    for (const row of queue) {
                        const ok = await apply(row.id, { kind: 'steer' });
                        if (!ok)
                            break;
                    }
                }
                finally {
                    setAllBusy(false);
                }
            }, [queue, apply]);
            if (rowCount === 0)
                return null;
            const interact = mutable && (editing !== null || busy !== null || allBusy);
            const listVisible = rowCount === 1 || open || interact;
            const count = fmt(t('q.count'), { n: rowCount });
            const saveEdit = async () => {
                if (!editing || editing.text.trim() === '')
                    return;
                if (await apply(editing.id, { kind: 'edit', content: [{ type: 'text', text: editing.text }] })) {
                    setEditing(null);
                    focusComposer();
                }
            };
            const cancelEdit = () => { setEditing(null); focusComposer(); };
            const rowActions = (row, text) => editing?.id === row.id
                ? h('div', { className: 'dqt-actions' }, h(Action, { kind: 'save', label: t('q.save'), disabled: busy !== null || editing.text.trim() === '', onClick: saveEdit, icon: 'IconCheckOutlineRegular' }), h(Action, { kind: 'cancel', label: t('q.cancel'), disabled: busy !== null, onClick: cancelEdit, icon: 'IconCloseOutlineRegular' }))
                : h('div', { className: 'dqt-actions' }, h(Action, { kind: 'steer', label: t('q.steer'), title: running ? undefined : t('q.steer.off'), disabled: busy !== null || allBusy || !running || !mutable, onClick: () => apply(row.id, { kind: 'steer' }), icon: 'IconSendOutlineRegular' }), h(Action, { kind: 'edit', label: t('q.edit'), title: text === null ? t('q.edit.off') : undefined, disabled: busy !== null || allBusy || text === null || !mutable, onClick: () => setEditing({ id: row.id, text }), icon: 'IconEditOutlineRegular' }), h(Action, { kind: 'remove', label: t('q.remove'), disabled: busy !== null || allBusy || !mutable, onClick: () => apply(row.id, { kind: 'remove' }), icon: 'IconTrashOutlineRegular' }));
            const thumbs = (content) => {
                const atts = attachmentsOf(content);
                if (!atts.length)
                    return null;
                return h('span', { className: 'dqt-thumbs' }, atts.map((a, i) => a.type === 'image'
                    ? h(QueueImage, { key: i, attachment: a.attachment, loadImage })
                    : h('span', { className: 'dqt-file', key: i, title: a.attachment.name }, Icon('IconDocumentOutlineRegular', 12), a.attachment.name)));
            };
            /* pending submissions carry a ready-made preview url, no resolve needed */
            const pendingThumbs = (atts) => {
                const list = (atts || []).filter((a) => a !== undefined && a.value !== undefined);
                if (!list.length)
                    return null;
                return h('span', { className: 'dqt-thumbs' }, list.map((a, i) => a.type === 'image'
                    ? h('img', { key: i, src: a.value.previewUrl, alt: '' })
                    : h('span', { className: 'dqt-file', key: i, title: a.value.name }, Icon('IconDocumentOutlineRegular', 12), a.value.name)));
            };
            return h('div', { className: 'dqt', 'data-dqt': '', 'data-dqt-count': rowCount, 'data-open': listVisible ? '1' : '0' }, rowCount > 1 && h('div', { className: 'dqt-head' }, h('button', {
                type: 'button', className: 'dqt-toggle', 'aria-expanded': listVisible, disabled: interact,
                'aria-label': listVisible ? t('q.collapse') : t('q.expand'), onClick: () => setOpen((v) => !v),
            }, Icon('IconQueueOutlineRegular', 14), h('span', null, count), h('span', { className: 'dqt-chev' }, Icon('IconChevronDownOutlineRegular', 14))), mutable && h(Tip, { label: running ? t('q.steerAll') : t('q.steer.off'), disabled: false }, h('button', { type: 'button', className: 'dqt-all', disabled: !running || allBusy || busy !== null, onClick: steerAll }, Icon('IconSendOutlineRegular', 13), t('q.steerAll')))), h('ul', { className: 'dqt-list', hidden: !listVisible }, listVisible && queue.map((row, i) => {
                const text = textOf(row.content);
                return h('li', { className: 'dqt-row', key: row.id, 'data-busy': busy === row.id ? '1' : '0' }, rowCount > 1 && h('span', { className: 'dqt-idx', 'aria-hidden': true }, i + 1), editing?.id === row.id
                    ? h('div', { className: 'dqt-edit' }, UI?.InlineEditor
                        ? h(UI.InlineEditor, { value: editing.text, label: t('q.edit'), onChange: (text2) => setEditing({ id: row.id, text: text2 }), onSave: saveEdit, onCancel: cancelEdit })
                        : h('textarea', { value: editing.text, rows: 2, autoFocus: true, onChange: (e) => setEditing({ id: row.id, text: e.target.value }) }))
                    : h(React.Fragment, null, thumbs(row.content), h('span', { className: 'dqt-preview' }, renderFactorySlot
                        ? renderFactorySlot('conversation.user.text', { text: text ?? '', facts: { collapseWhitespace: true, trimWhitespace: true }, interactive: false, ellipsis: true })
                        : (text ?? ''))), rowActions(row, text));
            }), listVisible && pending.map((s) => h('li', { className: 'dqt-row', key: s.requestId, 'data-busy': '1' }, pendingThumbs(s.attachments), h('span', { className: 'dqt-preview' }, s.text), h('span', { className: 'dqt-status', role: 'status' }, h('span', { className: 'dqt-spin' }), t('q.sending')), h('div', { className: 'dqt-actions' }, h(Action, { kind: 'steer', label: t('q.steer'), title: t('q.sending'), disabled: true, icon: 'IconSendOutlineRegular' }), h(Action, { kind: 'edit', label: t('q.edit'), title: t('q.sending'), disabled: true, icon: 'IconEditOutlineRegular' }), h(Action, { kind: 'remove', label: t('q.remove'), title: t('q.sending'), disabled: true, icon: 'IconTrashOutlineRegular' }))))));
        }
        function QueueImage({ attachment, loadImage }) {
            const [url, setUrl] = useState(null);
            useEffect(() => {
                let alive = true;
                loadImage(attachment).then((u) => { if (alive)
                    setUrl(u); }, () => { });
                return () => { alive = false; };
            }, [attachment, loadImage]);
            return url ? h('img', { src: url, alt: '' }) : h('span', { className: 'dqt-spin', 'aria-hidden': true });
        }
        return {
            inject: ['slots', 'locale'],
            apply(ctx) {
                ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'queue-tray: dictionaries');
                const t = ctx.locale.bind(NS);
                ctx.effect(() => { sheet.ensure(); return sheet.remove; }, 'queue-tray: styles');
                function Slot(props) { return h(QueueTray, { ...props, ctx, t }); }
                ctx.inject(['conversation', 'sessions', 'uiConversation'], (scope) => {
                    ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
                        name: 'conversation.input.dock',
                        id: 'claude-queue-tray',
                        order: 19,
                        locale: NS,
                        inject: (sessionId) => {
                            const actx = scope.sessions.scope(sessionId);
                            const conversation = actx?.get('conversation');
                            if (!conversation)
                                return {};
                            return {
                                updateQueue: (itemId, action) => conversation.updateQueue(itemId, action),
                                notify: (level, text) => conversation.input.for(actx).notify(level, text),
                                loadImage: (attachment) => scope.uiConversation.imageUrl(sessionId, attachment),
                            };
                        },
                    }, Slot));
                });
            },
        };
    },
});

// ===== src/parts/05-mode-menu.js
"use strict";
/*!
 * dsh-mode-menu — browser half.
 *
 * A Claude-Code-style "Mode" menu in the composer: the session's permission
 * presets and Plan mode in one list, each with a description, a number key
 * and a check mark; Shift+Tab in the composer cycles the everyday modes.
 *
 * It only drives the host's own commands (`/permission <preset>`, `/plan`,
 * `/plan off`) and reads the `permissions` / `plan` projections. While mounted
 * it hides dsh's built-in access-mode control and plan chip; disable the
 * plugin and both come back. Composer layout, hints, the model menu and the
 * transcript view live in their own plugins now.
 */
part({
    id: 'dsh-mode-menu',
    factory(require, kit) {
        const { React, h, portal } = kit;
        const { useState, useEffect, useRef, useCallback, useLayoutEffect, useSyncExternalStore } = React;
        const NS = 'mode-menu';
        const PLAN = 'plan';
        const RISKY = new Set(['danger-full-access', 'auto']);
        const zh = {
            'title': '模式',
            'cycle': 'Shift+Tab 切换',
            'trigger': '模式：{name}（点击切换，Shift+Tab 循环）',
            'p.read-only': '仅可查看',
            'p.read-only.d': '只读取和分析，不修改任何文件',
            'p.workspace-write': '工作区内修改',
            'p.workspace-write.d': '可以修改工作区里的文件；越界操作会先问你',
            'p.danger-full-access': '完全权限',
            'p.danger-full-access.d': '不受沙箱限制，可修改任意文件、运行任意命令',
            'p.auto': '自动审查',
            'p.auto.d': '安全操作自动放行，危险或模糊的操作交给你确认',
            'p.custom': '自定义',
            'p.custom.d': '当前的沙箱和审批组合不对应任何预设',
            'plan': '计划模式',
            'plan.d': '先调研并写出计划，你批准后再动手',
            'plan.on': '计划',
            'exp': 'EXP',
            'confirm': '确认开启「{name}」？',
            'confirm.full': '智能体将能修改任意文件、运行任意命令，不再受工作区限制。',
            'confirm.auto': '实验功能：由审查器决定大部分操作是否放行。',
            'confirm.ok': '开启',
            'confirm.cancel': '取消',
            'failed': '切换失败：{msg}',
            'busy': '正在切换…',
        };
        const en = {
            'title': 'Mode',
            'cycle': 'Shift+Tab to cycle',
            'trigger': 'Mode: {name} (click to change, Shift+Tab to cycle)',
            'p.read-only': 'Read only',
            'p.read-only.d': 'Reads and analyses; never changes files',
            'p.workspace-write': 'Workspace write',
            'p.workspace-write.d': 'Edits files in the workspace; asks before going outside it',
            'p.danger-full-access': 'Full access',
            'p.danger-full-access.d': 'No sandbox: any file, any command',
            'p.auto': 'Auto review',
            'p.auto.d': 'Safe actions run on their own; risky or unclear ones ask you',
            'p.custom': 'Custom',
            'p.custom.d': 'The current sandbox and approval mix matches no preset',
            'plan': 'Plan mode',
            'plan.d': 'Research and write a plan first; act after you approve it',
            'plan.on': 'Plan',
            'exp': 'EXP',
            'confirm': 'Turn on "{name}"?',
            'confirm.full': 'The agent can change any file and run any command, outside the workspace too.',
            'confirm.auto': 'Experimental: a reviewer decides whether most actions may run.',
            'confirm.ok': 'Turn on',
            'confirm.cancel': 'Cancel',
            'failed': 'Could not switch: {msg}',
            'busy': 'Switching…',
        };
        const fmt = (s, p) => String(s).replace(/\{(\w+)\}/g, (_, k) => (p && p[k] !== undefined ? String(p[k]) : `{${k}}`));
        const FALLBACK = ['read-only', 'workspace-write', 'danger-full-access'];
        // ------------------------------------------------------------------ glyphs
        const GLYPH = {
            'read-only': 'M8 2.2 13.4 4.2v3.4c0 3.3-2.3 5.3-5.4 6.3C4.9 12.9 2.6 10.9 2.6 7.6V4.2zM5.4 7.9h5.2M8 5.3v.01',
            'workspace-write': 'M8 2.2 13.4 4.2v3.4c0 3.3-2.3 5.3-5.4 6.3C4.9 12.9 2.6 10.9 2.6 7.6V4.2zM5.6 8.1l1.7 1.7 3.1-3.3',
            'danger-full-access': 'M8 2.2 13.4 4.2v3.4c0 3.3-2.3 5.3-5.4 6.3C4.9 12.9 2.6 10.9 2.6 7.6V4.2zM8 5.2v3.4M8 10.6v.01',
            'auto': 'M8 2.2 13.4 4.2v3.4c0 3.3-2.3 5.3-5.4 6.3C4.9 12.9 2.6 10.9 2.6 7.6V4.2zM5.6 9.6 8 5.4l2.4 4.2z',
            [PLAN]: 'M3.5 3.5h9v9h-9zM5.8 6.3h4.4M5.8 8.3h4.4M5.8 10.3h2.6',
            custom: 'M8 2.2 13.4 4.2v3.4c0 3.3-2.3 5.3-5.4 6.3C4.9 12.9 2.6 10.9 2.6 7.6V4.2z',
        };
        function Glyph({ id, size = 15 }) {
            return h('svg', { viewBox: '0 0 16 16', width: size, height: size, 'aria-hidden': true, className: 'dmm-glyph' }, h('path', { d: GLYPH[id] || GLYPH.custom, fill: 'none', stroke: 'currentColor', strokeWidth: 1.25, strokeLinecap: 'round', strokeLinejoin: 'round' }));
        }
        // ------------------------------------------------------------------ styles
        const { ensure: ensureStyle, remove: removeStyle } = kit.sheet('mode-menu', CSS_MODE_MENU);
        // ------------------------------------------------------------------ catalog
        /** Process-wide permission catalog (the presets the host offers), refreshed on change. */
        function createCatalog(ctx) {
            let value = null;
            const subs = new Set();
            const emit = () => { for (const fn of subs)
                fn(); };
            let seq = 0;
            const load = () => {
                const mine = ++seq;
                let p;
                try {
                    p = ctx.remote?.permissionPresets?.catalog?.();
                }
                catch {
                    p = undefined;
                }
                if (!p || typeof p.then !== 'function')
                    return;
                p.then((r) => {
                    if (mine !== seq)
                        return;
                    if (r && r.ok && r.value && Array.isArray(r.value.options)) {
                        value = r.value;
                        emit();
                    }
                }, () => { });
            };
            load();
            let off = null;
            try {
                off = ctx.remote?.$on?.('permission-presets/catalog-changed', load);
            }
            catch { }
            return {
                subscribe: (fn) => { subs.add(fn); return () => subs.delete(fn); },
                get: () => value,
                dispose: () => { try {
                    typeof off === 'function' && off();
                }
                catch { } },
            };
        }
        function safeProjection(props, name) {
            try {
                return typeof props.useProjection === 'function' ? props.useProjection(name) : undefined;
            }
            catch {
                return undefined;
            }
        }
        // ------------------------------------------------------------------ the menu
        function ModeMenu(props) {
            const { ctx, t, catalog } = props;
            useSyncExternalStore(useCallback((fn) => ctx.locale.subscribe(fn), [ctx]), () => ctx.locale.getSnapshot());
            const cat = useSyncExternalStore(catalog.subscribe, catalog.get);
            const perm = safeProjection(props, 'permissions');
            const plan = safeProjection(props, 'plan');
            const sessionId = typeof props.sessionId === 'string' ? props.sessionId : '';
            const [open, setOpen] = useState(false);
            const [pos, setPos] = useState(null);
            const [confirm, setConfirm] = useState(null);
            const [busy, setBusy] = useState(false);
            const [error, setError] = useState(null);
            const [kbd, setKbd] = useState(-1);
            const btnRef = useRef(null);
            const popRef = useRef(null);
            useLayoutEffect(ensureStyle, []);
            const planOn = !!plan && (plan.pending ? !plan.active : !!plan.active);
            const current = perm?.currentValue;
            const presets = (cat?.options?.length ? cat.options.map((o) => ({ id: o.value, name: o.name, hostDesc: o.description })) : FALLBACK.map((id) => ({ id })));
            const label = (p) => {
                const k = `p.${p.id}`;
                const v = t(k);
                return v === k ? (p.name || p.id.replace(/(^|-)(\w)/g, (_, s, c) => `${s ? ' ' : ''}${c.toUpperCase()}`)) : v;
            };
            const desc = (p) => {
                const k = `p.${p.id}.d`;
                const v = t(k);
                return v === k ? (p.hostDesc || '') : v;
            };
            const currentPreset = presets.find((p) => p.id === current) || (current ? { id: current } : null);
            const items = [...presets.map((p) => ({ kind: 'perm', ...p })), { kind: 'plan', id: PLAN }];
            const run = useCallback(async (line) => {
                const res = await ctx.remote.commands.execute(sessionId, line, []);
                if (!res || !res.ok)
                    throw new Error(res?.error ? `${res.error.message} (${res.error.code})` : 'unknown error');
                if (res.value === undefined)
                    throw new Error(`unknown command: ${line}`);
            }, [ctx, sessionId]);
            const act = useCallback(async (fn) => {
                setBusy(true);
                setError(null);
                try {
                    await fn();
                    return true;
                }
                catch (e) {
                    setError(String(e?.message || e));
                    return false;
                }
                finally {
                    setBusy(false);
                }
            }, []);
            const choose = (item, confirmed = false) => {
                if (busy)
                    return;
                if (item.kind === 'plan') {
                    act(() => run(planOn ? '/plan off' : '/plan'));
                    return;
                }
                if (item.id === current) {
                    setOpen(false);
                    return;
                }
                if (RISKY.has(item.id) && !confirmed) {
                    setConfirm(item);
                    return;
                }
                setConfirm(null);
                act(() => run(`/permission ${item.id}`)).then((ok) => { if (ok)
                    setOpen(false); });
            };
            // Shift+Tab in this composer cycles the everyday modes (never into a risky one):
            // workspace write → plan → read only → workspace write …
            useEffect(() => {
                if (!sessionId || !perm)
                    return undefined;
                const onKey = (e) => {
                    if (e.key !== 'Tab' || !e.shiftKey || e.altKey || e.metaKey || e.ctrlKey || e.isComposing)
                        return;
                    const seat = btnRef.current?.closest(SEL.seat) || btnRef.current?.closest('[data-slot="conversation.composer"]');
                    if (!seat || !seat.contains(document.activeElement))
                        return;
                    e.preventDefault();
                    e.stopPropagation();
                    if (busy)
                        return;
                    const has = (id) => presets.some((p) => p.id === id);
                    if (planOn)
                        act(async () => { await run('/plan off'); if (has('read-only') && current !== 'read-only')
                            await run('/permission read-only'); });
                    else if (current === 'read-only')
                        act(() => run(has('workspace-write') ? '/permission workspace-write' : '/plan'));
                    else
                        act(() => run('/plan'));
                };
                document.addEventListener('keydown', onKey, true);
                return () => document.removeEventListener('keydown', onKey, true);
            }, [sessionId, perm, planOn, current, busy, presets.length, act, run]);
            const place = useCallback(() => {
                const el = btnRef.current;
                if (!el)
                    return;
                const r = el.getBoundingClientRect();
                const width = Math.min(350, window.innerWidth - 24);
                const left = Math.max(12, Math.min(r.right - width + 4, window.innerWidth - width - 12));
                const bottom = Math.max(12, window.innerHeight - r.top + 8);
                setPos((o) => (o && o.left === left && o.bottom === bottom && o.width === width ? o : { left, bottom, width }));
            }, []);
            useLayoutEffect(() => { if (open)
                place(); }, [open, place]);
            // latest menu state for the open-menu listeners, so they subscribe once per open / close
            // instead of on every render (the handlers read live.current rather than a stale closure)
            const live = useRef(null);
            live.current = { confirm, kbd, items, choose };
            useLayoutEffect(() => {
                if (!open) {
                    if (confirm)
                        setConfirm(null);
                    if (kbd !== -1)
                        setKbd(-1);
                    return undefined;
                }
                const onDown = (e) => {
                    if (popRef.current?.contains(e.target) || btnRef.current?.contains(e.target))
                        return;
                    setOpen(false);
                };
                const onKey = (e) => {
                    const { confirm, kbd, items, choose } = live.current;
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        if (confirm)
                            setConfirm(null);
                        else {
                            setOpen(false);
                            btnRef.current?.focus();
                        }
                        return;
                    }
                    if (confirm) {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            choose(confirm, true);
                        }
                        return;
                    }
                    const n = Number(e.key);
                    if (n >= 1 && n <= items.length && !e.metaKey && !e.ctrlKey && !e.altKey) {
                        e.preventDefault();
                        choose(items[n - 1]);
                        return;
                    }
                    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                        e.preventDefault();
                        setKbd((k) => (k + (e.key === 'ArrowDown' ? 1 : items.length - 1) + (k < 0 && e.key === 'ArrowUp' ? 1 : 0)) % items.length);
                        return;
                    }
                    if (e.key === 'Enter' && kbd >= 0) {
                        e.preventDefault();
                        choose(items[kbd]);
                    }
                };
                window.addEventListener('resize', place);
                document.addEventListener('mousedown', onDown, true);
                document.addEventListener('keydown', onKey, true);
                return () => {
                    window.removeEventListener('resize', place);
                    document.removeEventListener('mousedown', onDown, true);
                    document.removeEventListener('keydown', onKey, true);
                };
            }, [open, place]);
            if (!sessionId || !perm)
                return null;
            const curLabel = currentPreset ? label(currentPreset) : '—';
            const trigLabel = planOn ? h(React.Fragment, null, h('span', null, t('plan.on')), h('span', { className: 'sep' }, '·'), h('span', null, curLabel)) : h('span', null, curLabel);
            const locked = !!props.locked;
            return h(React.Fragment, null, h('button', {
                ref: btnRef, type: 'button',
                className: `dmm-trigger${planOn ? ' plan' : ''}${RISKY.has(current) ? ' risky' : ''}`,
                'aria-haspopup': 'menu', 'aria-expanded': open,
                'aria-label': fmt(t('trigger'), { name: planOn ? `${t('plan')} · ${curLabel}` : curLabel }),
                title: fmt(t('trigger'), { name: planOn ? `${t('plan')} · ${curLabel}` : curLabel }),
                disabled: locked,
                onClick: () => setOpen((v) => !v),
            }, h(Glyph, { id: planOn ? PLAN : current }), trigLabel, h('svg', { className: 'dmm-chev', viewBox: '0 0 16 16', width: 12, height: 12, 'aria-hidden': true }, h('path', { d: 'M4.5 6.5 8 10l3.5-3.5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' }))), open && pos ? portal(h('div', {
                ref: popRef, className: 'dmm-pop notranslate', translate: 'no', role: 'menu',
                style: { left: pos.left, bottom: pos.bottom, width: pos.width },
            }, 
            // no 「模式 · Shift+Tab 切换」 header: the shortcut lives in the trigger's tooltip
            items.map((it, i) => {
                const isPlan = it.kind === 'plan';
                const on = isPlan ? planOn : it.id === current;
                const row = h('button', {
                    key: it.id, type: 'button', role: isPlan ? 'menuitemcheckbox' : 'menuitemradio', 'aria-checked': on,
                    className: `dmm-item${isPlan ? ' plan' : ''}${on ? ' on' : ''}${kbd === i ? ' kbd' : ''}`,
                    disabled: busy, onMouseEnter: () => setKbd(-1),
                    onClick: () => choose(it),
                }, h(Glyph, { id: it.id }), h('span', { className: 'txt' }, h('span', { className: 'lbl' }, isPlan ? t('plan') : label(it), it.id === 'auto' ? h('span', { className: 'dmm-badge' }, t('exp')) : null), h('span', { className: 'desc' }, isPlan ? t('plan.d') : desc(it))), isPlan ? h('span', { className: `dmm-sw${on ? ' on' : ''}`, 'aria-hidden': true })
                    : h('span', { className: 'chk' }, on ? h('svg', { viewBox: '0 0 16 16', width: 15, height: 15, 'aria-hidden': true }, h('path', { d: 'M3.5 8.4 6.6 11.4 12.5 4.8', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' })) : null));
                return h(React.Fragment, { key: it.id }, isPlan ? h('div', { className: 'dmm-div' }) : null, row, confirm && confirm.id === it.id ? h('div', { className: 'dmm-confirm', role: 'alertdialog' }, h('b', null, fmt(t('confirm'), { name: label(it) })), h('p', null, it.id === 'auto' ? t('confirm.auto') : t('confirm.full')), h('div', { className: 'row' }, h('button', { type: 'button', className: 'dmm-btn', onClick: () => setConfirm(null) }, t('confirm.cancel')), h('button', { type: 'button', className: 'dmm-btn warn', autoFocus: true, onClick: () => choose(it, true) }, t('confirm.ok')))) : null);
            }), busy ? h('div', { className: 'dmm-note' }, t('busy')) : null, error ? h('div', { className: 'dmm-note err' }, fmt(t('failed'), { msg: error })) : null)) : null);
        }
        // ------------------------------------------------------------------ registration
        return {
            inject: ['slots', 'locale', 'remote', 'remote.commands', 'remote.permissionPresets'],
            apply(ctx) {
                ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'mode-menu: dictionaries');
                const t = ctx.locale.bind(NS);
                const catalog = createCatalog(ctx);
                ctx.effect(() => () => { catalog.dispose(); removeStyle(); }, 'mode-menu: catalog and styles');
                function Slot(props) {
                    return h(ModeMenu, { ...props, ctx, t, catalog });
                }
                ctx.slots.inject('conversation.input.permission', () => ctx.slots.register({
                    name: 'conversation.input.permission',
                    id: 'mode-menu',
                    priority: -100,
                    order: -100,
                    label: () => t('title'),
                }, Slot));
            },
        };
    },
});

// ===== src/parts/06-model-menu.js
"use strict";
/*!
 * dsh-model-menu — browser half.
 *
 * A Claude-style model menu in the composer: the current provider's top five
 * models (number keys), an Effort pane with descriptions, and a searchable
 * "More models" pane. Reads and writes the per-session model directory that
 * dsh's own seat and /model use, so either place reflects the other.
 */
part({
    id: 'dsh-model-menu',
    factory(require, kit) {
        const { React, h, portal } = kit;
        const { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo, useSyncExternalStore } = React;
        const NS = 'model-menu';
        const zh = {
            'm.title': '模型',
            'm.effort': '推理等级',
            'm.more': '更多模型',
            'm.search': '搜索模型',
            'm.none': '没有匹配的模型',
            'm.empty': '没有可用的模型',
            'm.loading': '加载中…',
            'm.pick': '选择模型',
            'm.trigger': '模型：{name}',
            'm.account': 'DeepSeek 账号',
            'm.failed': '切换失败：{msg}',
            'm.inUse': '会话被另一个 DSH 实例占用，请先退出其它实例再试',
        };
        const en = {
            'm.title': 'Model',
            'm.effort': 'Effort',
            'm.more': 'More models',
            'm.search': 'Search models',
            'm.none': 'No matching models',
            'm.empty': 'No models available',
            'm.loading': 'Loading…',
            'm.pick': 'Select model',
            'm.trigger': 'Model: {name}',
            'm.account': 'DeepSeek Account',
            'm.failed': 'Could not switch: {msg}',
            'm.inUse': 'Another DSH instance holds this session — quit it and retry',
        };
        zh.busy = '正在切换…';
        en.busy = 'Switching…';
        const fmt = (s, p) => String(s).replace(/\{(\w+)\}/g, (_, k) => (p && p[k] !== undefined ? String(p[k]) : `{${k}}`));
        // ------------------------------------------------------------------ styles
        const { ensure: ensureStyle, remove: removeStyle } = kit.sheet('model-menu', CSS_MODEL_MENU);
        const TOP_N = 5;
        const Check = () => h('svg', { viewBox: '0 0 16 16', width: 15, height: 15, 'aria-hidden': true }, h('path', { d: 'M3.5 8.4 6.6 11.4 12.5 4.8', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round' }));
        const Chevron = ({ dir = 'right' }) => h('svg', { viewBox: '0 0 16 16', width: 13, height: 13, 'aria-hidden': true, className: `dmd-mchev ${dir}` }, h('path', { d: dir === 'left' ? 'M9.5 4 5.5 8l4 4' : 'M6.5 4l4 4-4 4', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }));
        const fuzzy = (name, q) => {
            if (!q)
                return true;
            const s = name.toLowerCase();
            let i = 0;
            for (const ch of q.toLowerCase()) {
                i = s.indexOf(ch, i);
                if (i < 0)
                    return false;
                i++;
            }
            return true;
        };
        function ModelMenu(props) {
            const { ctx, t, models, sessions } = props;
            useSyncExternalStore(useCallback((fn) => ctx.locale.subscribe(fn), [ctx]), () => ctx.locale.getSnapshot());
            const sessionId = typeof props.sessionId === 'string' ? props.sessionId : '';
            const dir = useMemo(() => {
                if (!sessionId)
                    return null;
                try {
                    return models.directoryFor(sessionId);
                }
                catch {
                    return null;
                }
            }, [models, sessionId]);
            const available = useMemo(() => { try {
                return !sessions || sessions.subagentAddress(sessionId) === undefined;
            }
            catch {
                return true;
            } }, [sessions, sessionId]);
            const nostore = useMemo(() => ({ subscribe: () => () => { }, getSnapshot: () => null }), []);
            const store = dir ? dir.store : nostore;
            const st = useSyncExternalStore(useCallback((fn) => store.subscribe(fn), [store]), () => store.getSnapshot());
            const [open, setOpen] = useState(false);
            const [pane, setPane] = useState('root');
            const [query, setQuery] = useState('');
            const [pos, setPos] = useState(null);
            const [err, setErr] = useState(null);
            const btnRef = useRef(null);
            const popRef = useRef(null);
            const searchRef = useRef(null);
            useLayoutEffect(ensureStyle, []);
            useEffect(() => { if (dir && available)
                dir.load().catch(() => { }); }, [dir, available]);
            useEffect(() => { if (open && dir && available)
                dir.load().catch(() => { }); }, [open, dir, available]);
            const groups = useMemo(() => {
                const gs = (st?.groups || []).map((g) => ({ ...g, label: g.id === 'deepseek-account' ? t('m.account') : g.name }));
                const rank = (g) => (g.id === 'deepseek-account' ? 0 : g.id === 'deepseek-official' || g.id === 'deepseek' ? 1 : 2);
                return gs.map((g, i) => [g, i]).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map((x) => x[0]);
            }, [st?.groups, t]);
            const cur = st?.pending || st?.current || null;
            const curGroup = cur ? groups.find((g) => g.id === cur.provider) : null;
            const curModel = curGroup ? curGroup.models.find((m) => m.id === cur.model) : null;
            const topGroup = curGroup || groups[0] || null;
            const top = topGroup ? topGroup.models.slice(0, TOP_N) : [];
            if (curModel && !top.includes(curModel))
                top[top.length - 1] = curModel;
            const total = groups.reduce((n, g) => n + g.models.length, 0);
            const efforts = curModel?.reasoning?.efforts || [];
            const curEffort = cur?.reasoningEffort || curModel?.reasoning?.defaultEffort;
            const effortName = efforts.find((e) => e.id === curEffort)?.name || st?.retainedEffort || curEffort || '';
            const busy = st?.status === 'selecting';
            const badge = (m) => (m.badge ? h('span', { className: `dmd-mbadge ${m.badge.tone || 'neutral'}` }, (() => { try {
                return ctx.locale.resolveText(m.badge.text);
            }
            catch {
                return typeof m.badge.text === 'string' ? m.badge.text : '';
            } })()) : null);
            const pick = async (sel) => {
                if (!dir || busy)
                    return;
                setErr(null);
                try {
                    const r = await dir.select(sel);
                    if (r && !r.ok) {
                        setErr(r.error?.code === 'session/writer-held' ? t('m.inUse') : String(r.error?.message || r.error));
                        return;
                    }
                    setOpen(false);
                    btnRef.current?.focus();
                }
                catch (e) {
                    setErr(String(e?.message || e));
                }
            };
            const pickModel = (g, m) => {
                if (cur && g.id === cur.provider && m.id === cur.model) {
                    setOpen(false);
                    return;
                }
                const effs = m.reasoning?.efforts || [];
                const keep = curEffort && effs.some((e) => e.id === curEffort) ? curEffort : m.reasoning?.defaultEffort;
                pick({ provider: g.id, model: m.id, ...(keep ? { reasoningEffort: keep } : {}) });
            };
            const pickEffort = (e) => {
                if (!cur || e.id === curEffort) {
                    setPane('root');
                    return;
                }
                pick({ provider: cur.provider, model: cur.model, reasoningEffort: e.id });
            };
            const place = useCallback(() => {
                const el = btnRef.current;
                const pop = popRef.current;
                if (!el)
                    return;
                const r = el.getBoundingClientRect();
                const width = Math.min(240, window.innerWidth - 24);
                const left = Math.max(12, Math.min(r.right - width + 4, window.innerWidth - width - 12));
                const bottom = Math.max(12, window.innerHeight - r.top + 6);
                const maxH = Math.max(160, r.top - 18);
                setPos((o) => (o && o.left === left && o.bottom === bottom && o.width === width && o.maxH === maxH ? o : { left, bottom, width, maxH }));
                void pop;
            }, []);
            useLayoutEffect(() => { if (open)
                place();
            else {
                setPane('root');
                setQuery('');
                setErr(null);
            } }, [open, place]);
            useEffect(() => { if (open && pane === 'more')
                searchRef.current?.focus(); }, [open, pane]);
            const moreGroups = useMemo(() => groups.map((g) => ({ ...g, models: g.models.filter((m) => fuzzy(m.name, query.trim())) })).filter((g) => g.models.length), [groups, query]);
            // latest pane state for the open-menu listeners: subscribe once per open / close, not per render
            const live = useRef(null);
            live.current = { pane, moreGroups, pickModel };
            useEffect(() => {
                if (!open)
                    return undefined;
                const onDown = (e) => { if (popRef.current?.contains(e.target) || btnRef.current?.contains(e.target))
                    return; setOpen(false); };
                const onKey = (e) => {
                    const { pane, moreGroups, pickModel } = live.current;
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        e.stopPropagation();
                        if (pane !== 'root')
                            setPane('root');
                        else {
                            setOpen(false);
                            btnRef.current?.focus();
                        }
                        return;
                    }
                    if (pane === 'more') {
                        if (e.key === 'Enter' && document.activeElement === searchRef.current) {
                            const g = moreGroups[0];
                            if (g) {
                                e.preventDefault();
                                pickModel(g, g.models[0]);
                            }
                        }
                        return;
                    }
                    // (no 1–9 shortcuts: the numbers are no longer shown, so a stray digit must not switch models)
                };
                window.addEventListener('resize', place);
                document.addEventListener('mousedown', onDown, true);
                document.addEventListener('keydown', onKey, true);
                return () => { window.removeEventListener('resize', place); document.removeEventListener('mousedown', onDown, true); document.removeEventListener('keydown', onKey, true); };
            }, [open, place]);
            if (!sessionId || !dir || !available)
                return null;
            const name = curModel ? curModel.name : (cur ? cur.model : t('m.pick'));
            const full = effortName && curModel ? `${name} · ${effortName}` : name;
            const row = (key, { on, onClick, label, sub = null, right = null, num = 0, cls = '' }) => h('button', {
                key, type: 'button', role: 'menuitemradio', 'aria-checked': !!on, disabled: busy,
                className: `dmd-mrow${on ? ' on' : ''} ${cls}`, onClick,
            }, h('span', { className: 'lbl' }, label), sub ? h('span', { className: 'sub' }, sub) : null, h('span', { className: 'chk' }, on ? h(Check) : null), right !== undefined ? h('span', { className: 'val' }, right) : null);
            let body;
            if (pane === 'effort') {
                body = h(React.Fragment, null, h('button', { type: 'button', className: 'dmd-mback', onClick: () => setPane('root') }, h(Chevron, { dir: 'left' }), t('m.effort')), efforts.map((e, i) => row(e.id, { on: e.id === curEffort, onClick: () => pickEffort(e), label: e.name, sub: e.description, num: i + 1 })));
            }
            else if (pane === 'more') {
                body = h(React.Fragment, null, h('button', { type: 'button', className: 'dmd-mback', onClick: () => setPane('root') }, h(Chevron, { dir: 'left' }), t('m.more')), h('input', { ref: searchRef, className: 'dmd-msearch', placeholder: t('m.search'), value: query, onChange: (e) => setQuery(e.target.value), spellCheck: false, autoComplete: 'off' }), h('div', { className: 'dmd-mscroll' }, moreGroups.length ? moreGroups.map((g) => h('div', { key: g.id, role: 'group', 'aria-label': g.label }, h('div', { className: 'dmd-mgroup' }, g.label), g.models.map((m) => row(`${g.id}/${m.id}`, { on: !!cur && cur.provider === g.id && cur.model === m.id, onClick: () => pickModel(g, m), label: h(React.Fragment, null, h('span', { className: 'nm' }, m.name), badge(m)) }))))
                    : h('div', { className: 'dmd-note' }, total ? t('m.none') : (st?.status === 'loading' ? t('m.loading') : t('m.empty')))));
            }
            else {
                body = h(React.Fragment, null, top.length ? top.map((m, i) => row(m.id, { on: !!curModel && m === curModel, onClick: () => pickModel(topGroup, m), label: h(React.Fragment, null, h('span', { className: 'nm' }, m.name), badge(m)), num: i + 1 }))
                    : h('div', { className: 'dmd-note' }, st?.status === 'loading' || !st ? t('m.loading') : t('m.empty')), efforts.length || total > top.length ? h('div', { className: 'dmd-div' }) : null, efforts.length ? h('button', { type: 'button', className: 'dmd-mrow nav', disabled: busy, onClick: () => setPane('effort') }, h('span', { className: 'lbl' }, t('m.effort')), h('span', { className: 'val' }, effortName), h(Chevron)) : null, efforts.length && total > top.length ? h('div', { className: 'dmd-div' }) : null, total > top.length ? h('button', { type: 'button', className: 'dmd-mrow nav', disabled: busy, onClick: () => setPane('more') }, h('span', { className: 'lbl' }, t('m.more')), h('span', { className: 'val' }, ''), h(Chevron)) : null);
            }
            return h(React.Fragment, null, h('button', {
                ref: btnRef, type: 'button', className: 'dmd-trigger dmd-mtrigger', disabled: !!props.locked,
                'aria-haspopup': 'menu', 'aria-expanded': open, 'aria-label': fmt(t('m.trigger'), { name: full }), title: full,
                onClick: () => setOpen((v) => !v),
            }, h('span', { className: 'nm' }, name), effortName && curModel ? h('span', { className: 'eff' }, effortName) : null, h('svg', { className: 'dmd-chev', viewBox: '0 0 16 16', width: 12, height: 12, 'aria-hidden': true }, h('path', { d: 'M4.5 6.5 8 10l3.5-3.5', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' }))), open && pos ? portal(h('div', {
                ref: popRef, className: 'dmd-pop dmd-mpop notranslate', translate: 'no', role: 'menu', 'aria-label': t('m.title'),
                style: { left: pos.left, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxH },
            }, body, busy ? h('div', { className: 'dmd-note' }, t('busy')) : null, err || st?.error ? h('div', { className: 'dmd-note err' }, fmt(t('m.failed'), { msg: err || st.error })) : null)) : null);
        }
        // ------------------------------------------------------------------ registration
        return {
            inject: ['slots', 'locale'],
            apply(ctx) {
                ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'model-menu: dictionaries');
                const t = ctx.locale.bind(NS);
                ctx.effect(() => () => removeStyle(), 'model-menu: styles');
                // Claude-style model menu over the same per-session directory the built-in seat and /model use.
                ctx.inject(['slots', 'modelDirectories'], (scope) => {
                    const models = scope.modelDirectories;
                    let sessions = null;
                    try {
                        sessions = scope.sessions || null;
                    }
                    catch { }
                    function ModelSlot(props) {
                        return h(ModelMenu, { ...props, ctx, t, models, sessions });
                    }
                    scope.slots.inject('conversation.input.model', () => scope.slots.register({
                        name: 'conversation.input.model',
                        id: 'model-menu',
                        priority: -100,
                        order: -100,
                        label: () => t('m.title'),
                    }, ModelSlot));
                });
            },
        };
    },
});

// ===== src/parts/07-smooth-caret.js
"use strict";
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
        const EDITOR = `${SEL.input}[contenteditable="true"]`;
        const sheet = kit.sheet('smooth-caret', CSS_SMOOTH_CARET);
        /** The caret rectangle of a collapsed selection inside `ed`, or null. Read-only. */
        function caretRect(ed) {
            const sel = document.getSelection();
            if (!sel || !sel.rangeCount || !sel.isCollapsed)
                return null;
            const range = sel.getRangeAt(0);
            if (!ed.contains(range.startContainer))
                return null;
            const cs = getComputedStyle(ed);
            const fs = parseFloat(cs.fontSize) || 15;
            const lh = parseFloat(cs.lineHeight) || fs * 1.6;
            const h = Math.round(Math.min(lh, fs * 1.3));
            const rects = range.getClientRects();
            let r = rects.length ? rects[rects.length - 1] : null;
            if (r && r.height > 0)
                return { x: r.left, y: r.top + (r.height - h) / 2, h };
            // empty line / empty editor: measure the element the caret sits in
            let node = range.startContainer;
            if (node.nodeType === Node.TEXT_NODE)
                node = node.parentElement;
            else if (node.childNodes[range.startOffset]?.nodeType === Node.ELEMENT_NODE)
                node = node.childNodes[range.startOffset];
            if (!node || (!ed.contains(node) && node !== ed))
                return null;
            if (node.nodeType !== Node.ELEMENT_NODE)
                return null;
            const box = node;
            r = box.getBoundingClientRect();
            if (!r || (r.width === 0 && r.height === 0))
                return null;
            const ncs = getComputedStyle(box);
            const padL = parseFloat(ncs.paddingLeft) || 0;
            const padT = parseFloat(ncs.paddingTop) || 0;
            const lineH = parseFloat(ncs.lineHeight) || lh;
            const left = ncs.textAlign === 'center' ? r.left + r.width / 2 : r.left + padL;
            // a <br> (empty line) has its own one-line box: centre in it; a block: its first line
            if (box.tagName === 'BR' && r.height > 0)
                return { x: r.left, y: r.top + (r.height - h) / 2, h };
            return { x: left, y: r.top + padT + (lineH - h) / 2, h };
        }
        function start() {
            const html = document.documentElement;
            const el = document.createElement('div');
            el.className = 'dsc-caret';
            el.setAttribute('aria-hidden', 'true');
            document.body.appendChild(el);
            let shown = false;
            let raf = 0;
            let lastX = NaN;
            let lastY = NaN;
            // the editor can move without a selection change (composer growing, layout shifts)
            const ro = new ResizeObserver(() => schedule());
            let watched = null;
            // Follow scroll only on the editor's own scroll container. A document-wide capture listener
            // would also fire for the transcript's auto-follow scroll while a reply streams, re-measuring
            // the caret (forced layout) every frame even though the pinned composer never moves.
            let scrollTargets = [];
            const onScroll = () => schedule();
            function watch(ed) {
                ro.disconnect();
                watched = ed;
                ro.observe(ed);
                const card = ed.closest(SEL.card);
                if (card)
                    ro.observe(card);
                for (const t of scrollTargets)
                    t.removeEventListener('scroll', onScroll);
                scrollTargets = [];
                const sc = ed.closest('[data-input-scroll]');
                for (const t of [ed, sc])
                    if (t && !scrollTargets.includes(t)) {
                        t.addEventListener('scroll', onScroll, { passive: true });
                        scrollTargets.push(t);
                    }
            }
            const hide = () => {
                if (!shown)
                    return;
                shown = false;
                el.classList.remove('on');
                el.style.opacity = '0';
                html.removeAttribute('data-dsc-caret');
            };
            const place = () => {
                raf = 0;
                const ed = document.activeElement && document.activeElement.matches && document.activeElement.matches(EDITOR) ? document.activeElement : null;
                if (!ed || !document.hasFocus()) {
                    hide();
                    return;
                }
                if (ed !== watched)
                    watch(ed);
                const c = caretRect(ed);
                const box = ed.getBoundingClientRect();
                const clip = ed.closest('[data-input-scroll]')?.getBoundingClientRect() || box;
                if (!c || c.y + c.h < clip.top - 1 || c.y > clip.bottom + 1 || c.x < clip.left - 4 || c.x > clip.right + 4) {
                    hide();
                    return;
                }
                const x = Math.round(c.x * 2) / 2 - 1;
                const y = Math.round(c.y);
                const far = !shown || Math.abs(y - lastY) > 2 * c.h || Math.abs(x - lastX) > 240;
                el.classList.toggle('jump', far);
                el.style.height = `${c.h}px`;
                el.style.transform = `translate(${x}px,${y}px)`;
                if (x !== lastX || y !== lastY || !shown) {
                    // moved: solid now, breathe again after a pause. Restart the breathe animation through the
                    // Web Animations API rather than remove-class / force-reflow / add-class, so a caret move
                    // never forces a synchronous layout. Only the breathe animation — leave the glide transition.
                    el.classList.add('on');
                    for (const a of el.getAnimations())
                        if (a.animationName === 'dsc-breathe') {
                            try {
                                a.currentTime = 0;
                            }
                            catch { }
                        }
                }
                el.style.opacity = '';
                lastX = x;
                lastY = y;
                if (!shown) {
                    shown = true;
                    html.setAttribute('data-dsc-caret', '');
                }
            };
            const schedule = () => { if (!raf)
                raf = requestAnimationFrame(place); };
            document.addEventListener('selectionchange', schedule);
            document.addEventListener('focusin', schedule);
            let outTimer = 0;
            const onOut = () => { if (outTimer)
                clearTimeout(outTimer); outTimer = setTimeout(() => { outTimer = 0; schedule(); }, 0); };
            document.addEventListener('focusout', onOut);
            document.addEventListener('input', schedule, true);
            document.addEventListener('keydown', schedule, true);
            document.addEventListener('compositionupdate', schedule, true);
            window.addEventListener('blur', hide);
            window.addEventListener('focus', schedule);
            window.addEventListener('resize', schedule);
            // the editor can move without a selection change (composer growing, layout shifts)
            schedule();
            return () => {
                document.removeEventListener('selectionchange', schedule);
                document.removeEventListener('focusin', schedule);
                document.removeEventListener('focusout', onOut);
                document.removeEventListener('input', schedule, true);
                document.removeEventListener('keydown', schedule, true);
                document.removeEventListener('compositionupdate', schedule, true);
                window.removeEventListener('blur', hide);
                window.removeEventListener('focus', schedule);
                window.removeEventListener('resize', schedule);
                for (const t of scrollTargets)
                    t.removeEventListener('scroll', onScroll);
                scrollTargets = [];
                ro.disconnect();
                if (raf)
                    cancelAnimationFrame(raf);
                if (outTimer)
                    clearTimeout(outTimer);
                el.remove();
                html.removeAttribute('data-dsc-caret');
            };
        }
        return {
            inject: [],
            apply(ctx) {
                ctx.effect(() => { sheet.ensure(); const stop = start(); return () => { stop(); sheet.remove(); }; }, 'smooth-caret');
            },
        };
    },
});

// ===== src/parts/08-to-bottom.js
"use strict";
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
        const SLOT = '[class*="_toBottomSlot"]';
        const SCROLL = '[data-conversation-scroll]';
        const SEAT = SEL.seat;
        /* the box (left / width / bottom) is written inline by place(); here only what never changes:
           fixed instead of dsh's sticky, no padding, one line high, and the face itself */
        const sheet = kit.sheet('to-bottom', CSS_TO_BOTTOM);
        /* Sit the slot one line above the composer card, as wide as the card (so centring is the
           input box's centre) — recomputed whenever the layout can have moved.
    
           Don't assume where `fixed` resolves: the chat column (and its scrollport) carry
           `container-type:inline-size`, i.e. layout containment, so a fixed child is measured against
           that box rather than the viewport, and that box is not necessarily the window. dsh assigns no
           stable marker we could rely on. So: write a first guess from the viewport, read back where the
           button actually landed, and correct by the difference — one extra layout read, right either way. */
        const GAP = 8;
        function place() {
            const slot = q(SLOT);
            if (slot === null)
                return;
            const composer = q(`${SCROLL} ${SEAT}`) ?? q(SEAT);
            const seat = composer === null ? null : composer.getBoundingClientRect();
            if (seat === null || seat.height === 0) {
                slot.style.display = 'none';
                return;
            }
            if (slot.style.display === 'none')
                slot.style.display = 'flex';
            const targetBottom = seat.top - GAP;
            const targetLeft = seat.left;
            const width = `${Math.round(seat.width)}px`;
            if (slot.style.width !== width)
                slot.style.width = width;
            // first pass: treat the window as the containing block
            let bottom = window.innerHeight - targetBottom;
            let left = targetLeft;
            slot.style.bottom = `${Math.round(bottom)}px`;
            slot.style.left = `${Math.round(left)}px`;
            const landed = slot.getBoundingClientRect();
            // second pass: whatever box `fixed` really resolved against, shift by the measured miss
            const dy = landed.bottom - targetBottom;
            const dx = landed.left - targetLeft;
            if (Math.abs(dy) > 1) {
                bottom += dy;
                slot.style.bottom = `${Math.round(bottom)}px`;
            }
            if (Math.abs(dx) > 1) {
                left += dx;
                slot.style.left = `${Math.round(left)}px`;
            }
            // shown only once it is where it belongs: a first paint in dsh's own spot would flash mid-thread
            if (slot.style.visibility !== 'visible')
                slot.style.visibility = 'visible';
        }
        function startAnchoring() {
            let timer = 0;
            let watched = [];
            const ro = new ResizeObserver(() => schedule());
            // the scroller and the composer card come and go with the session; re-target only when the
            // pair actually changed, so observing itself never feeds another round
            function watch() {
                const next = qa(`${SCROLL}, ${SEAT}`);
                if (next.length === watched.length && next.every((el, i) => el === watched[i]))
                    return;
                ro.disconnect();
                for (const el of next)
                    ro.observe(el);
                watched = next;
            }
            function schedule() {
                // setTimeout, not rAF: rAF stops in a hidden pane or background window
                if (timer !== 0)
                    return;
                timer = setTimeout(() => { timer = 0; place(); }, 16);
            }
            // One shared body observer (dom-hub). Re-target the ResizeObserver only when a scroller / seat
            // mounts or unmounts, and re-place only while dsh has the slot mounted (the tail is off screen).
            // Streamed transcript tokens touch neither, so neither pass runs during ordinary streaming.
            const offHub = kit.dom.subscribe((recs) => {
                if (kit.dom.mounts(recs, `${SCROLL}, ${SEAT}`))
                    watch();
                if (q(SLOT) !== null)
                    schedule();
            });
            const onScroll = () => { if (q(SLOT) !== null)
                schedule(); };
            document.addEventListener('scroll', onScroll, { capture: true, passive: true });
            window.addEventListener('resize', schedule);
            watch();
            schedule();
            return () => {
                offHub();
                ro.disconnect();
                document.removeEventListener('scroll', onScroll, { capture: true });
                window.removeEventListener('resize', schedule);
                if (timer !== 0)
                    clearTimeout(timer);
                const slot = q(SLOT);
                if (slot !== null) {
                    slot.style.display = '';
                    slot.style.bottom = '';
                    slot.style.left = '';
                    slot.style.width = '';
                    slot.style.visibility = '';
                }
            };
        }
        return {
            inject: [],
            apply(ctx) {
                ctx.effect(() => { sheet.ensure(); return sheet.remove; }, 'to-bottom: styles');
                ctx.effect(() => startAnchoring(), 'to-bottom: above the composer');
            },
        };
    },
});

// ===== src/parts/09-stack-cards.js
"use strict";
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
        const sheet = kit.sheet('stack-cards', CSS_STACK_CARDS);
        return {
            inject: [],
            apply(ctx) {
                sheet.ensure();
                ctx.effect(() => () => sheet.remove(), 'stack-cards: styles');
            },
        };
    },
});

window.__ModuleLoader__.load({
  id: BUNDLE,
  factory(require) {
    const kit = makeKit(require, BUNDLE)
    const store = featureStore()
    const mods = []
    for (const p of parts) {
      try {
        store.declare(BUNDLE, p.id, p.feature)
        mods.push({ id: p.id, feature: p.feature, ...p.factory(require, kit) })
      } catch (e) { console.error(`[${BUNDLE}] ${p.id} failed to load`, e) }
    }
    return {
      inject: [...new Set(mods.flatMap((m) => m.inject || []))],
      apply(ctx) {
        // one part failing must not take the others down
        for (const m of mods) {
          try {
            if (m.feature) gateFeature(ctx, store, m)
            else m.apply(ctx)
          } catch (e) { console.error(`[${BUNDLE}] ${m.id}`, e) }
        }
      },
    }
  },
})
})()
