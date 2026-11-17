/* Scenarios for the dsh-composer-display harness. Each runs the plugin's real code against the mock
 * shell and returns { pass, ...detail }. runAll() boots once, runs them in order and stores the
 * aggregate on window.__results (progress on window.__prog) so a host can poll without blocking. */
;(() => {
  const H = window.H
  const { $, $$, wait, raf, setInput, focusInput, setRunning, mountToBottom, unmountToBottom, openMeter, closeMeter } = H
  const ok = (...c) => c.every(Boolean)
  const byText = (sel, txt) => $$(sel).find((el) => el.textContent.includes(txt))
  const click = (el) => el && el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  const key = (k, opts = {}) => document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...opts }))
  const setValue = (input, v) => { const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(input, v); input.dispatchEvent(new Event('input', { bubbles: true })) }
  const ensureBoot = () => { if (!H.booted) H.boot() }
  const hl = (k) => { try { return CSS.highlights.get('dcbmd-' + k)?.size || 0 } catch { return -1 } }

  async function scenarioMarkdown() {
    ensureBoot()
    setInput('<p># Title</p><p>some **bold** and _em_ and ~~strike~~ and `code` and [link](https://x.com) plus https://auto.link</p><p>```js</p><p>let a = 1</p><p>```</p><p>- item</p><p>&gt; quote</p>')
    await wait(50); await raf()
    const kinds = { mark: hl('mark'), code: hl('code'), fence: hl('fence'), strong: hl('strong'), em: hl('em'), head: hl('head'), link: hl('link'), strike: hl('strike') }
    const painted = ok(kinds.code > 0, kinds.strong > 0, kinds.em > 0, kinds.strike > 0, kinds.head > 0, kinds.link > 0, kinds.fence > 0, kinds.mark > 0)
    setInput('<p>plain text only</p>')
    await wait(50); await raf()
    const cleared = ok(hl('code') === 0, hl('strong') === 0, hl('head') === 0, hl('link') === 0)
    return { pass: ok(painted, cleared), kinds, painted, cleared }
  }

  async function scenarioCaret() {
    ensureBoot()
    setInput('<p>hello world</p>')
    focusInput(); await raf(); await raf()
    const caret = $('.dsc-caret')
    const shown = !!caret && caret.classList.contains('on') && document.documentElement.hasAttribute('data-dsc-caret')
    const transform = caret ? caret.style.transform : ''
    // a few moves must not throw and must keep the caret solid (animation restart via WAAPI, no reflow)
    let threw = null
    try { for (let i = 0; i < 8; i++) { const el = $('#input'); el.querySelector('p').firstChild.appendData('x'); const r = document.createRange(); r.selectNodeContents(el); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.dispatchEvent(new Event('selectionchange')); await raf() } } catch (e) { threw = String(e) }
    const stillOn = !!$('.dsc-caret.on')
    document.activeElement && document.activeElement.blur()
    document.dispatchEvent(new Event('focusout', { bubbles: true }))
    await wait(20); await raf()
    const hidden = !document.documentElement.hasAttribute('data-dsc-caret')
    return { pass: ok(shown, transform.includes('translate'), !threw, stillOn, hidden), shown, transform, threw, stillOn, hidden }
  }

  async function scenarioOneline() {
    ensureBoot()
    const root = $('#root')
    const grid = getComputedStyle(root).display === 'grid'
    const dcoOn = getComputedStyle(root).getPropertyValue('--dco-on').trim() === '1'
    root.style.width = '500px'; await wait(30); await raf()
    const narrow = root.hasAttribute('data-dco-narrow')
    root.style.width = ''; await wait(30); await raf()
    const wide = !root.hasAttribute('data-dco-narrow')
    const panel = openMeter(); await raf(); await raf(); await wait(20)
    const placed = panel.hasAttribute('data-dco-placed')
    const tr = $('#meterBtn').getBoundingClientRect()
    const expectedLeft = Math.max(8, Math.round(tr.right - panel.offsetWidth))
    const aligned = Math.abs(parseFloat(panel.style.left) - expectedLeft) <= 1
    closeMeter(); await wait(20); await raf()
    const closed = !$('#meterPanel')
    return { pass: ok(grid, dcoOn, narrow, wide, placed, aligned, closed), grid, dcoOn, narrow, wide, placed, aligned, closed }
  }

  async function scenarioHints() {
    ensureBoot()
    H.locale.setLang('zh')
    $('#input').setAttribute('data-placeholder', '发消息，/ 调用指令，@ 引用文件或对话')
    await wait(20); await raf()
    const root = $('#root')
    const idle = root.getAttribute('data-dch-ph') === 'idle' && (root.style.getPropertyValue('--dch-ph') || '').includes('发消息')
    setRunning(true); await wait(20); await raf()
    const running = root.getAttribute('data-dch-ph') === 'running' && (root.style.getPropertyValue('--dch-ph') || '').includes('排队')
    setRunning(false); await wait(20); await raf()
    const backIdle = root.getAttribute('data-dch-ph') === 'idle'
    H.locale.setLang('en')
    $('#input').setAttribute('data-placeholder', 'Message, / for commands, @ for files or sessions')
    await wait(20); await raf()
    const en = (root.style.getPropertyValue('--dch-ph') || '').includes('Message')
    H.locale.setLang('zh')
    $('#input').setAttribute('data-placeholder', '发消息，/ 调用指令，@ 引用文件或对话')
    await wait(20); await raf()
    return { pass: ok(idle, running, backIdle, en), idle, running, backIdle, en }
  }

  async function scenarioQueue() {
    ensureBoot()
    H.locale.setLang('zh'); await wait(10)
    const sheet = !!$('style[data-plugin="dsh-composer-display/queue-tray"]')
    const zh = document.documentElement.style.getPropertyValue('--dqt-q1').includes('排队')
    H.locale.setLang('en'); await wait(10)
    const en = document.documentElement.style.getPropertyValue('--dqt-q1').includes('queued')
    H.locale.setLang('zh'); await wait(10)
    return { pass: ok(sheet, zh, en), sheet, zh, en }
  }

  async function scenarioMode() {
    ensureBoot()
    H.locale.setLang('zh')
    H.proj.set('permissions', { currentValue: 'workspace-write', pending: null })
    H.proj.set('plan', { active: false, pending: false })
    H.commandLog.length = 0
    await wait(20); await raf()
    const trigger = $('.dmm-trigger')
    const hasTrigger = !!trigger && trigger.textContent.includes('工作区内修改')
    click(trigger); await raf(); await raf()
    const items = $$('.dmm-pop .dmm-item')
    const five = items.length === 5
    key('3'); await wait(20); await raf()
    const confirm = !!$('.dmm-confirm')
    click(byText('.dmm-btn.warn', '开启')); await wait(40); await raf()
    const riskyApplied = H.proj.get('permissions').currentValue === 'danger-full-access' && H.commandLog.includes('/permission danger-full-access')
    const closedAfter = !$('.dmm-pop')
    focusInput(); await raf()
    key('Tab', { shiftKey: true }); await wait(40); await raf()
    const cyclePlan = H.proj.get('plan').active === true && H.commandLog.includes('/plan')
    key('Tab', { shiftKey: true }); await wait(50); await raf()
    const cycleReadOnly = H.proj.get('plan').active === false && H.proj.get('permissions').currentValue === 'read-only'
    click($('.dmm-trigger')); await raf(); await raf()
    key('Escape'); await wait(20); await raf()
    const escClosed = !$('.dmm-pop')
    return { pass: ok(hasTrigger, five, confirm, riskyApplied, closedAfter, cyclePlan, cycleReadOnly, escClosed), hasTrigger, count: items.length, confirm, riskyApplied, closedAfter, cyclePlan, cycleReadOnly, escClosed, log: H.commandLog.slice() }
  }

  async function scenarioModel() {
    ensureBoot()
    H.locale.setLang('zh')
    await wait(20); await raf()
    const trigger = $('.dmd-trigger')
    const hasTrigger = !!trigger && trigger.textContent.includes('DeepSeek Chat')
    click(trigger); await raf(); await raf()
    const topRows = $$('.dmd-pop .dmd-mrow')
    const top = topRows.length >= 5
    click(byText('.dmd-mrow', '推理等级')); await raf(); await raf()
    const effortPane = !!$('.dmd-mback') && $$('.dmd-pop .dmd-mrow').length === 3
    click(byText('.dmd-mrow', 'High')); await wait(40); await raf()
    const effortApplied = H.dir._st.current.reasoningEffort === 'high' && $('.dmd-trigger').textContent.includes('High')
    click($('.dmd-trigger')); await raf(); await raf()
    click(byText('.dmd-mrow', '更多模型')); await raf(); await raf()
    const search = $('.dmd-msearch')
    const morePane = !!search
    setValue(search, 'reasoner'); await raf(); await raf()
    const filtered = $$('.dmd-mscroll .dmd-mrow')
    const searchOk = filtered.length === 1 && filtered[0].textContent.includes('Reasoner')
    click(filtered[0]); await wait(40); await raf()
    const modelApplied = H.dir._st.current.model === 'deepseek-reasoner'
    // writer-held error path
    const origSelect = H.dir.select
    H.dir.select = async () => ({ ok: false, error: { code: 'session/writer-held' } })
    click($('.dmd-trigger')); await raf(); await raf()
    click(byText('.dmd-mrow', 'DeepSeek Coder')); await wait(30); await raf()
    const errNote = $('.dmd-note.err')
    const errorShown = !!errNote && errNote.textContent.includes('占用')
    H.dir.select = origSelect
    key('Escape'); await wait(20); await raf()
    return { pass: ok(hasTrigger, top, effortPane, effortApplied, morePane, searchOk, modelApplied, errorShown), hasTrigger, topCount: topRows.length, effortPane, effortApplied, morePane, searchOk, modelApplied, errorShown }
  }

  async function scenarioToBottom() {
    ensureBoot()
    unmountToBottom(); await wait(20)
    setInput('<p>one line</p>')
    const slot = mountToBottom(); await wait(50); await raf()
    const placed = slot.style.visibility === 'visible' && getComputedStyle(slot).position === 'fixed'
    const seat = $('#seat').getBoundingClientRect()
    const sr = slot.getBoundingClientRect()
    const gap = Math.round(seat.top - sr.bottom)
    const aligned = Math.abs(gap - 8) <= 2 && Math.abs(sr.left - seat.left) <= 2
    setRunning(true); await wait(30); await raf()
    const runningStill = slot.style.visibility === 'visible'
    setRunning(false)
    setInput('<p>line one</p><p>line two</p><p>line three</p>')
    await wait(50); await raf()
    const seat2 = $('#seat').getBoundingClientRect()
    const sr2 = slot.getBoundingClientRect()
    const regrow = Math.abs((seat2.top - sr2.bottom) - 8) <= 2
    unmountToBottom(); await wait(30); await raf()
    const removed = !$('#toBottom')
    return { pass: ok(placed, aligned, runningStill, regrow, removed), placed, gap, aligned, runningStill, regrow, removed }
  }

  async function scenarioDispose() {
    ensureBoot()
    const before = H.M.moInstances
    H.dispose(); await wait(30); await raf()
    const removedCaret = !$('.dsc-caret')
    const removedSheets = $$('style[data-plugin^="dsh-composer-display"]').length === 0
    const removedAttr = !document.documentElement.hasAttribute('data-dsc-caret')
    H.boot(); await wait(30); await raf()
    const sheetsBack = $$('style[data-plugin^="dsh-composer-display"]').length > 0
    setInput('<p>remount</p>'); focusInput(); await raf(); await raf()
    const singleCaret = $$('.dsc-caret').length === 1
    const delta = H.M.moInstances - before
    document.activeElement && document.activeElement.blur()
    return { pass: ok(removedCaret, removedSheets, removedAttr, sheetsBack, singleCaret, delta <= 6), removedCaret, removedSheets, removedAttr, sheetsBack, singleCaret, moDelta: delta }
  }

  async function scenarioStream() {
    ensureBoot()
    document.activeElement && document.activeElement.blur()
    unmountToBottom(); closeMeter(); setInput('<p></p>')
    await wait(30); await raf()
    $('#transcript').innerHTML = '<p id="streamP"></p>'
    const p = $('#streamP')
    p.appendChild(document.createTextNode(''))
    H.measure.start()
    const text = '流式 token streaming 0123456789 '
    for (let i = 0; i < 180; i++) { p.firstChild.appendData(text[i % text.length]); await raf() }
    const snap = H.measure.stop()
    // The plugin-work metrics are valid regardless of page visibility: no forced layout, no long
    // task, no error, and one coalesced hub callback per mutation frame (moCallbacks ~ frames, not
    // 3x frames as the three separate body observers used to produce). Wall-clock frame deltas are
    // NOT meaningful here: on a hidden page frames are timer-driven and the Worker->main delivery is
    // throttled, so avgFrame / jankFrames are reported for information only, not asserted.
    const coalesced = snap.moCallbacks <= 260
    const pass = ok(snap.longTasks === 0, snap.errors.length === 0, snap.reflow <= 4, coalesced)
    return { pass, coalesced, frameNote: 'avgFrame/jankFrames informational only (hidden-page timer-driven frames)', ...snap }
  }

  const SCEN = { scenarioMarkdown, scenarioCaret, scenarioOneline, scenarioHints, scenarioQueue, scenarioMode, scenarioModel, scenarioToBottom, scenarioDispose, scenarioStream }
  window.SCEN = SCEN

  window.SCEN.runAll = async () => {
    window.__prog = 'starting'
    if (H.booted) H.dispose()
    H.boot()
    await wait(40); await raf()
    const order = ['scenarioMarkdown', 'scenarioCaret', 'scenarioOneline', 'scenarioHints', 'scenarioQueue', 'scenarioMode', 'scenarioModel', 'scenarioToBottom', 'scenarioDispose', 'scenarioStream']
    const results = {}
    for (const name of order) {
      window.__prog = name
      try { results[name] = await SCEN[name]() } catch (e) { results[name] = { pass: false, error: String(e && e.stack || e) } }
      await wait(10)
    }
    const passed = order.filter((n) => results[n].pass).length
    window.__results = { passed, total: order.length, allPass: passed === order.length, results, errors: H.M.errors.slice() }
    window.__prog = 'done'
    const pre = $('#results')
    if (pre) { pre.style.display = 'block'; pre.textContent = order.map((n) => `${results[n].pass ? 'PASS' : 'FAIL'}  ${n}`).join('\n') + `\n\n${passed}/${order.length} pass\nerrors: ${H.M.errors.length}` }
    return window.__results
  }

  // bar buttons
  document.addEventListener('click', (e) => {
    const act = e.target && e.target.dataset && e.target.dataset.act
    if (!act) return
    if (act === 'boot') { if (H.booted) H.dispose(); H.boot(); return }
    if (act === 'lang') { H.locale.setLang(H.locale.getSnapshot() === 'zh' ? 'en' : 'zh'); return }
    if (act === 'dispose') { SCEN.scenarioDispose().then((r) => { window.__last = r; const p = $('#results'); p.style.display = 'block'; p.textContent = JSON.stringify(r, null, 2) }); return }
    if (act === 'all') { window.__results = null; SCEN.runAll(); return }
    const map = { markdown: 'scenarioMarkdown', caret: 'scenarioCaret', mode: 'scenarioMode', model: 'scenarioModel', tobottom: 'scenarioToBottom', meter: 'scenarioOneline', stream: 'scenarioStream' }
    const fn = SCEN[map[act]]
    if (fn) fn().then((r) => { window.__last = r; const p = $('#results'); p.style.display = 'block'; p.textContent = JSON.stringify(r, null, 2) })
  })
})()