# dsh-composer-display

Claude-style input box for DeepSeek Harness (web client): everything in and around the message input.

| Part | File | What it does |
| --- | --- | --- |
| `composer-buttons` | `src/parts/01-composer-buttons.ts` | Send / stop / + buttons and live Markdown highlighting |
| `composer-oneline` | `src/parts/02-composer-oneline.ts` | One-row input box |
| `composer-hints` | `src/parts/03-composer-hints.ts` | Shorter placeholder and hints |
| `queue-tray` | `src/parts/04-queue-tray.ts` | Tray for messages queued while a reply runs |
| `mode-menu` | `src/parts/05-mode-menu.ts` | Claude-style mode (preset) menu |
| `model-menu` | `src/parts/06-model-menu.ts` | Claude-style model menu |
| `smooth-caret` | `src/parts/07-smooth-caret.ts` | Rounded caret that glides and breathes |
| `to-bottom` | `src/parts/08-to-bottom.ts` | 「回到底部」 button: pinned just above the input box (same width, centred), a 32px DeepSeek-token glass circle with a ↓ arrow and three breathing blue dots while a reply runs |
| `stack-cards` | `src/parts/09-stack-cards.ts` | Goal strip above the composer, restyled as an opaque card like the queue tray |

Part of a set of independent DeepSeek Harness UI bundles: **dsh-composer-display** (the input box and what sits on it), **dsh-conversation-enhancer** (the conversation view), **dsh-claude-shell** (the app frame), **dsh-whale-theme** (background, glass, fonts and its own Settings › 主题 page) and **dsh-context-monitor** (context usage in the composer and in a 上下文透视 tab). Each one works on its own; they share one build script, vendored here as `scripts/`.

## Install

`client.js` is committed, so a checkout runs as-is — no build step is needed to use it.

- **GUI:** 插件 → 添加插件 → 安装第三方插件, enter `github:DaYangtuo247/dsh-composer-display` (or the absolute path of a local checkout), then enable the bundle in **设置 › 插件**.
- **CLI:** `dsh plugin --profile <profile> add github:DaYangtuo247/dsh-composer-display`, then enable it in **设置 › 插件**.

Built and tested against DeepSeek Harness `0.2.2-rc.3` (DSH NEXT 2.0.23).

## Develop

TypeScript in `src/`, one file per part plus a shared library, and one SCSS stylesheet per `kit.sheet()` in
`src/styles/`; `build.mjs` compiles both and concatenates the result into the single `client.js` that dsh loads.

```
src/
  types.d.ts      ambient kit / slot / part types for the bundle
  lib/            shared by every part, no part ids of their own
    dom.ts          q() / qa() — typed querySelector helpers
    selectors.ts    SEL — every selector the parts share (our data-composer-* markers, dsh's class fragments)
    markdown.ts     the in-place Markdown scanner (ranges only, it never edits dsh's editor)
    domain.d.ts     the small value types (MarkKind, ModeItem, ModelRowProps, PermissionCatalog…)
    styles.d.ts     ambient `declare const CSS_*: string` for the constants the build generates
  styles/         one SCSS file per sheet, built in filename order
    01-composer-buttons.scss    sheet composer-buttons  → CSS_COMPOSER_BUTTONS
    01-composer-markdown.scss   sheet composer-markdown → CSS_COMPOSER_MARKDOWN
    02-composer-oneline.scss    → CSS_COMPOSER_ONELINE
    03-composer-hints.scss      → CSS_COMPOSER_HINTS
    04-queue-tray.scss          → CSS_QUEUE_TRAY
    05-mode-menu.scss           → CSS_MODE_MENU
    06-model-menu.scss          → CSS_MODEL_MENU
    07-smooth-caret.scss        → CSS_SMOOTH_CARET
    08-to-bottom.scss           → CSS_TO_BOTTOM
    09-stack-cards.scss         → CSS_STACK_CARDS
  parts/          one part each, built in filename order
    00-dom-hub.ts … 09-stack-cards.ts
```

Each stylesheet is plain CSS that the shared build compiles with Sass (`style: 'expanded'`, `charset: false`) and
emits as a `const CSS_<NAME> = "…"` before the parts, so a part just calls `kit.sheet('<name>', CSS_<NAME>)`.
The selectors, glyph `url("data:image/svg+xml,…")` masks and declaration values are written out as literals: the
old template strings interpolated `SEL.*` and a few derived selectors, and those expansions now live in the SCSS
(e.g. `[data-composer-seat] [class*="_tools"]>button[class*="_add"]`). Constants a part still uses for DOM
queries (`SEL`, `SLOT`, …) stay in `src/lib`; only CSS-only locals were dropped. A genuinely dynamic value would
be a `__DCG_*__` placeholder plus a `/* @js fn */` line at the top of the sheet, but none is needed today.

```bash
pnpm install            # sass 1.108.2 + typescript 7.0.2 — the build compiles .ts and .scss
pnpm build              # tsc -p . → .build/, Sass → CSS_* constants, concatenated into client.js
pnpm typecheck          # tsc -p . --noEmit
pnpm check              # pnpm build && node scripts/verify-corner-shape.mjs .
```

There is no import/export anywhere: the sources are TypeScript **scripts**, so all ten parts share one global
program that `tsc` checks across files, and the build can still concatenate them file by file. Each part calls
`part({ id, factory(require, kit) { … return { inject, apply } } })`; the shared `kit` (from
`scripts/kit.js`) provides `React`, `h`, `portal`, `sheet(name, css)` and the shared DOM hub. The
bundle injects the union of every part's services; one part failing to load or apply is logged and does not stop
the others. Linked install: after a rebuild, reload the page — dsh loads `client.js`, never `src/`.

Three ways to check a change:

- `node .verify/render.mjs client.js` runs the bundle headless (`node:vm`, stubbed dsh shell) and prints every
  `<style>` it declares, so a refactor can be diffed against `.baseline/rendered.css`: the rendered CSS must stay
  byte-identical, and `.baseline/parts.json` must still list the same part ids. `.baseline/rendered.pre-scss.css`
  is the pre-refactor rendering; the move to SCSS changed only the formatting Sass applies (attribute-selector
  quotes dropped, numbers padded, declarations one per line), so the new baseline is that snapshot after the
  same Sass pass.
- `node scripts/verify-corner-shape.mjs` lints every bundle's built CSS for the one mistake this
  stylesheet cannot show: dsh's global `corner-shape: superellipse(1.5)` deforms any `border-radius: 50%` /
  `999px` / `100%` that does not pair `corner-shape: round`, turning circles into rounded squares, pill ends
  into flat ones and spinner rings into slanted bars. It scans the bundle's built CSS (`client.js`) — pass the
  bundle folder as its argument — names every offending rule, and `--self-test` proves the detector still
  catches a bare circle.
- `test/harness.html` is the manual browser harness (real React, mocked composer DOM) with the behaviour
  scenarios in `test/scenarios.js`.

## composer-buttons

Claude-style buttons for the DeepSeek Harness composer. CSS only.

- **Send:** as in Claude, a bare return (corner-down-left) glyph, no fill, the same wash the + key gets on hover; dimmed while empty; a small rounded stop square while a reply runs, washed on hover too.
- **Markdown:** syntax typed in the input is highlighted live (headings, **bold**, _italic_, ~~strike~~, `code`, links, list / quote markers, ``` fences) using the CSS Custom Highlight API, so dsh's Lexical editor DOM is never touched and the raw Markdown is what gets sent.
- **Add (+):** a borderless ghost button with a thinner plus, as in Claude; a faint 28px square appears on hover.

Override the colours with `--dcb-send-bg` (default transparent), `--dcb-send-bg-hover` and `--dcb-send-fg` on any ancestor of the composer (left unset, they fall back to dsh's own tokens), e.g. `--dcb-send-bg:#D97757;--dcb-send-fg:#fff` for a filled clay key.

Selectors live in `src/lib/selectors.ts`: dsh's stable class fragments (`[class*="_trailing"]>button[class*="_primary"]`, `[class*="_tools"]>button[class*="_add"]`) under our `[data-composer-seat]` marker. Works alongside dsh-composer-oneline, which only positions these buttons.

## composer-oneline

Claude's compact composer layout for DeepSeek Harness.

- **The card** is one row: `+`, the input, the send button. It grows upward as you type more lines.
- **Below the card**, one meta line: tok/s and cache-hit stats on the left (muted until hovered, still clickable), model, mode and context ring on the right, as plain text.
- **Narrow composers** (≤ 600px) move the stats to their own line, one at each end.

CSS only, keyed on dsh's `data-composer-*` attributes: the card, its row and the tools/trailing groups become `display: contents`, the bar root becomes a grid, and the card background is drawn by `::before`. An invisible `conversation.composer.dock` entry runs a `ResizeObserver` that sets `data-dco-narrow`; it deliberately avoids `container-type`, which would trap every `position: fixed` popover in the bar.

Works with or without dsh-mode-menu, dsh-model-menu and dsh-context-monitor; whatever sits in those seats is laid out on the meta line.

## composer-hints

Claude-style placeholder text for the DeepSeek Harness composer.

- **Idle:** `发消息，/ 调用指令，@ 引用文件或对话`.
- **While the agent runs:** `↵ 排队发送，⌘↵ 立即插话` (or the steer-first wording, depending on 繁忙时的发送行为).

It only swaps what is displayed, and only while dsh shows its default text: dsh owns the `conversation` dictionary and refuses a second registration. dsh's other hints (plan mode, steer-all-queued) are left alone. It mounts as an invisible `conversation.composer.dock` entry to reach its composer.

## queue-tray

While the agent runs, dsh queues what you send (its 繁忙时的发送行为 setting). This plugin restyles dsh's own QueueDock as a Claude-style rounded tray above the input.

- A single queued message reads "1 条消息排队中" followed by its preview.
- Send-now (插话) comes first, then edit and remove.

CSS only; dsh's queue logic is unchanged.

## mode-menu

A Claude-Code-style **Mode** menu for the DeepSeek Harness composer. It replaces the built-in permission picker and the separate Plan button with one control.

- **Trigger:** the current mode, e.g. `工作区内修改`; with plan mode on it reads `计划 · 仅可查看`. A risky preset is tinted.
- **Menu:** every permission preset from `permissionPresets.catalog()` (falling back to read-only / workspace-write / full access), each with a glyph, a description, a check mark and a number key; a **计划模式** switch below a divider.
- **Confirmation:** `完全权限` and `自动审查` ask for an inline confirmation first.
- **Keys:** `1`–`n`, `↑`/`↓` + `Enter`, `Esc`. **Shift+Tab** in the composer cycles `工作区内修改 → 计划 → 仅可查看`, never into a risky mode.

### How it works

- Registers at `conversation.input.permission` with `order: -100`, shadowing the built-in picker; CSS hides the built-in Plan button while the menu is mounted.
- Reads the `permissions` and `plan` projections and runs the same commands you would type: `/permission <preset>`, `/plan`, `/plan off`.
- Popovers render into `<body>`.

Version 0.2.0 keeps only the mode menu. The model menu, composer layout, hints, queue tray and transcript features moved to their own plugins.

## model-menu

A Claude-style model picker for the DeepSeek Harness composer, registered at `conversation.input.model` with `order: -100`.

- **Trigger:** the model name, then the effort in a muted tone.
- **Root pane:** up to five models from the current provider (check mark, number key), then **推理等级 ›** with its value, then **更多模型 ›**.
- **Effort pane:** the model's efforts with descriptions and number keys.
- **More models:** every provider group under sticky headings, fuzzy search; Enter picks the first hit.
- **Switching models** keeps the current effort if the new model supports it, otherwise its default.
- **Esc** goes back one pane, then closes.

It reads and writes `ctx.modelDirectories.directoryFor(sessionId)`, the same directory dsh's seat and `/model` use.

## smooth-caret

A calmer caret for the message input (dsh's Lexical editor, `[data-composer-input]`): a 2px rounded bar in the text colour instead of the thin blue system caret, gliding to its new place as you type or move, and breathing (fade in and out) instead of a hard blink — it stays solid while you type. It only reads the selection and never touches the editor's DOM. Whenever it cannot measure the caret (a range selection, nothing focused, an unmeasurable spot) it gets out of the way and the native caret shows again. prefers-reduced-motion: no glide, no breathing.

## to-bottom

「回到底部」 button, placed above the input box instead of dsh's right corner.

dsh renders this button as `position: sticky` inside the message scroller, so in a short conversation (nothing to scroll yet) it never sticks and instead drops right under the last message — visually a dot ring floating in the middle of the page. This module pins it to the composer instead: it measures `[data-composer-seat]` and writes the slot's bottom / left / width, so the button sits 8px above the input box card, centred and exactly as wide as it. Re-measured on scroll, resize and any DOM change, and it computes the real containing block — dsh's chat column has `container-type: inline-size`, which makes it (not the viewport) the reference for `position: fixed`.

Style is dsh's own: a 32px glass circle (`--dsw-alias-bg-layer-1` at 88%, `.5px` `--dsw-alias-border-l2` ring), a 15px `--dsw-alias-label-secondary` arrow. While a reply is still being written the arrow becomes three 3.5px dots in `--dsw-alias-state-business-primary` with a soft opacity pulse, so you can see there is more coming below. Visibility and clicking stay dsh's own logic.

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 DaYangtuo247. DeepSeek Harness and the DeepSeek name belong to their owners; this bundle is an independent add-on and ships no DeepSeek code.
