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
    const { React, h } = kit
    const { useState, useEffect, useMemo, useCallback, useSyncExternalStore } = React
    let UI = null
    try { UI = require('@deepseek-ai/dsh-client-ui-primitives') } catch { UI = null }

    const NS = 'queue-tray'
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
    }
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
    }
    const fmt = (s, p) => String(s).replace(/\{(\w+)\}/g, (_, k) => (p && p[k] !== undefined ? String(p[k]) : `{${k}}`))

    const sheet = kit.sheet('queue-tray', CSS_QUEUE_TRAY)

    const textOf = (content) => {
      const texts = (content || []).filter((b) => b.type === 'text').map((b) => b.text)
      return texts.length ? texts.join('') : null
    }
    /* dsh wraps each attachment in the block: { type: 'image' | 'file', attachment }. Handing the block
       itself to loadImage() loses attachmentId, so the resolve rejects and the thumb spins forever. */
    const attachmentsOf = (content) => {
      const out = []
      for (const block of content || []) {
        if ((block.type === 'image' || block.type === 'file') && block.attachment !== undefined) {
          out.push({ type: block.type, attachment: block.attachment })
        }
      }
      return out
    }

    function Tip({ label, disabled, children }) {
      if (!UI?.Tooltip || disabled) return children
      return h(UI.Tooltip, { portal: true, label, side: 'bottom', delayMs: 400 }, children)
    }
    const Icon = (name, size) => (UI?.[name] ? h(UI[name], { size }) : null)

    function Action({ kind, label, title, disabled, onClick, icon }) {
      return h(Tip, { label, disabled: !!title },
        h('button', {
          type: 'button', className: 'dqt-btn', 'data-kind': kind,
          'aria-label': label, title: title || undefined, disabled: !!disabled, onClick,
        }, Icon(icon, 14)))
    }

    function QueueTray(props) {
      const { ctx, t, useSession, useProjection, updateQueue, notify, loadImage, renderFactorySlot } = props
      useSyncExternalStore(useCallback((fn) => ctx.locale.subscribe(fn), [ctx]), () => ctx.locale.getSnapshot())
      const inbox = useProjection('inbox')
      const pendingSubmissions = useSession((s) => s.pendingSubmissions)
      const running = useSession((s) => s.running)
      const mutable = useSession((s) => s.subagent === null || s.subagent.address.mode === 'continuable')
      const queue = useMemo(() => {
        const rows = inbox?.['next-turn'] ?? []
        const inChat = new Set(pendingSubmissions.filter((i) => i.placement === 'transcript').map((i) => i.requestId))
        return inChat.size === 0 ? rows : rows.filter(({ source }) => source.kind !== 'user' || !('rpcId' in source) || !inChat.has(source.rpcId))
      }, [inbox, pendingSubmissions])
      const pending = useMemo(() => {
        const admitted = new Set(queue.flatMap(({ source }) => (source.kind === 'user' && 'rpcId' in source ? [source.rpcId] : [])))
        return pendingSubmissions.filter((s) => s.placement === 'queued' && !admitted.has(s.requestId))
      }, [pendingSubmissions, queue])
      const rowCount = queue.length + pending.length
      const [editing, setEditing] = useState(null)
      const [busy, setBusy] = useState(null)
      const [open, setOpen] = useState(true)
      const [allBusy, setAllBusy] = useState(false)

      useEffect(() => {
        if (rowCount === 0) { setEditing(null); setOpen(true) }
        if (editing && !queue.some((r) => r.id === editing.id)) setEditing(null)
      }, [rowCount, queue, editing])

      const focusComposer = useCallback(() => {
        const stack = document.querySelector<HTMLElement>('.dqt')?.closest(SEL.stack)
        const input = stack?.querySelector<HTMLElement>(SEL.input) || document.querySelector<HTMLElement>(SEL.input)
        input?.focus({ preventScroll: true })
      }, [])

      const apply = useCallback(async (id, action) => {
        setBusy(id)
        try { await updateQueue(id, action); return true }
        catch (e) {
          const code = e?.code || e?.error?.code
          if (code === 'session/steer-unavailable' || code === 'session/queue-item-not-found') return false
          notify('error', t('q.failed')); return false
        } finally { setBusy((b) => (b === id ? null : b)) }
      }, [updateQueue, notify, t])

      const steerAll = useCallback(async () => {
        setAllBusy(true)
        try { for (const row of queue) { const ok = await apply(row.id, { kind: 'steer' }); if (!ok) break } }
        finally { setAllBusy(false) }
      }, [queue, apply])

      if (rowCount === 0) return null
      const interact = mutable && (editing !== null || busy !== null || allBusy)
      const listVisible = rowCount === 1 || open || interact
      const count = fmt(t('q.count'), { n: rowCount })

      const saveEdit = async () => {
        if (!editing || editing.text.trim() === '') return
        if (await apply(editing.id, { kind: 'edit', content: [{ type: 'text', text: editing.text }] })) { setEditing(null); focusComposer() }
      }
      const cancelEdit = () => { setEditing(null); focusComposer() }

      const rowActions = (row, text) => editing?.id === row.id
        ? h('div', { className: 'dqt-actions' },
          h(Action, { kind: 'save', label: t('q.save'), disabled: busy !== null || editing.text.trim() === '', onClick: saveEdit, icon: 'IconCheckOutlineRegular' }),
          h(Action, { kind: 'cancel', label: t('q.cancel'), disabled: busy !== null, onClick: cancelEdit, icon: 'IconCloseOutlineRegular' }))
        : h('div', { className: 'dqt-actions' },
          h(Action, { kind: 'steer', label: t('q.steer'), title: running ? undefined : t('q.steer.off'), disabled: busy !== null || allBusy || !running || !mutable, onClick: () => apply(row.id, { kind: 'steer' }), icon: 'IconSendOutlineRegular' }),
          h(Action, { kind: 'edit', label: t('q.edit'), title: text === null ? t('q.edit.off') : undefined, disabled: busy !== null || allBusy || text === null || !mutable, onClick: () => setEditing({ id: row.id, text }), icon: 'IconEditOutlineRegular' }),
          h(Action, { kind: 'remove', label: t('q.remove'), disabled: busy !== null || allBusy || !mutable, onClick: () => apply(row.id, { kind: 'remove' }), icon: 'IconTrashOutlineRegular' }))

      const thumbs = (content) => {
        const atts = attachmentsOf(content)
        if (!atts.length) return null
        return h('span', { className: 'dqt-thumbs' }, atts.map((a, i) => a.type === 'image'
          ? h(QueueImage, { key: i, attachment: a.attachment, loadImage })
          : h('span', { className: 'dqt-file', key: i, title: a.attachment.name }, Icon('IconDocumentOutlineRegular', 12), a.attachment.name)))
      }
      /* pending submissions carry a ready-made preview url, no resolve needed */
      const pendingThumbs = (atts) => {
        const list = (atts || []).filter((a) => a !== undefined && a.value !== undefined)
        if (!list.length) return null
        return h('span', { className: 'dqt-thumbs' }, list.map((a, i) => a.type === 'image'
          ? h('img', { key: i, src: a.value.previewUrl, alt: '' })
          : h('span', { className: 'dqt-file', key: i, title: a.value.name }, Icon('IconDocumentOutlineRegular', 12), a.value.name)))
      }

      return h('div', { className: 'dqt', 'data-dqt': '', 'data-dqt-count': rowCount, 'data-open': listVisible ? '1' : '0' },
        rowCount > 1 && h('div', { className: 'dqt-head' },
          h('button', {
            type: 'button', className: 'dqt-toggle', 'aria-expanded': listVisible, disabled: interact,
            'aria-label': listVisible ? t('q.collapse') : t('q.expand'), onClick: () => setOpen((v) => !v),
          }, Icon('IconQueueOutlineRegular', 14), h('span', null, count),
            h('span', { className: 'dqt-chev' }, Icon('IconChevronDownOutlineRegular', 14))),
          mutable && h(Tip, { label: running ? t('q.steerAll') : t('q.steer.off'), disabled: false },
            h('button', { type: 'button', className: 'dqt-all', disabled: !running || allBusy || busy !== null, onClick: steerAll },
              Icon('IconSendOutlineRegular', 13), t('q.steerAll')))),
        h('ul', { className: 'dqt-list', hidden: !listVisible },
          listVisible && queue.map((row, i) => {
            const text = textOf(row.content)
            return h('li', { className: 'dqt-row', key: row.id, 'data-busy': busy === row.id ? '1' : '0' },
              rowCount > 1 && h('span', { className: 'dqt-idx', 'aria-hidden': true }, i + 1),
              editing?.id === row.id
                ? h('div', { className: 'dqt-edit' }, UI?.InlineEditor
                  ? h(UI.InlineEditor, { value: editing.text, label: t('q.edit'), onChange: (text2) => setEditing({ id: row.id, text: text2 }), onSave: saveEdit, onCancel: cancelEdit })
                  : h('textarea', { value: editing.text, rows: 2, autoFocus: true, onChange: (e) => setEditing({ id: row.id, text: e.target.value }) }))
                : h(React.Fragment, null, thumbs(row.content),
                  h('span', { className: 'dqt-preview' }, renderFactorySlot
                    ? renderFactorySlot('conversation.user.text', { text: text ?? '', facts: { collapseWhitespace: true, trimWhitespace: true }, interactive: false, ellipsis: true })
                    : (text ?? ''))),
              rowActions(row, text))
          }),
          listVisible && pending.map((s) => h('li', { className: 'dqt-row', key: s.requestId, 'data-busy': '1' },
            pendingThumbs(s.attachments),
            h('span', { className: 'dqt-preview' }, s.text),
            h('span', { className: 'dqt-status', role: 'status' }, h('span', { className: 'dqt-spin' }), t('q.sending')),
            h('div', { className: 'dqt-actions' },
              h(Action, { kind: 'steer', label: t('q.steer'), title: t('q.sending'), disabled: true, icon: 'IconSendOutlineRegular' }),
              h(Action, { kind: 'edit', label: t('q.edit'), title: t('q.sending'), disabled: true, icon: 'IconEditOutlineRegular' }),
              h(Action, { kind: 'remove', label: t('q.remove'), title: t('q.sending'), disabled: true, icon: 'IconTrashOutlineRegular' }))))))
    }

    function QueueImage({ attachment, loadImage }) {
      const [url, setUrl] = useState(null)
      useEffect(() => {
        let alive = true
        loadImage(attachment).then((u) => { if (alive) setUrl(u) }, () => {})
        return () => { alive = false }
      }, [attachment, loadImage])
      return url ? h('img', { src: url, alt: '' }) : h('span', { className: 'dqt-spin', 'aria-hidden': true })
    }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'queue-tray: dictionaries')
        const t = ctx.locale.bind(NS)
        ctx.effect(() => { sheet.ensure(); return sheet.remove }, 'queue-tray: styles')
        function Slot(props) { return h(QueueTray, { ...props, ctx, t }) }
        ctx.inject(['conversation', 'sessions', 'uiConversation'], (scope) => {
          ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
            name: 'conversation.input.dock',
            id: 'claude-queue-tray',
            order: 19,
            locale: NS,
            inject: (sessionId) => {
              const actx = scope.sessions.scope(sessionId)
              const conversation = actx?.get('conversation')
              if (!conversation) return {}
              return {
                updateQueue: (itemId, action) => conversation.updateQueue(itemId, action),
                notify: (level, text) => conversation.input.for(actx).notify(level, text),
                loadImage: (attachment) => scope.uiConversation.imageUrl(sessionId, attachment),
              }
            },
          }, Slot))
        })
      },
    }
  },
})