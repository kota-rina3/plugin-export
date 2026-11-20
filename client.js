/**
 * @local/plugin-export — Client half.
 *
 * Adds an "Export plugins" row to the Plugins page's add-plugin menu and a
 * frame-wide dialog that exports the selected installed plugins.
 *
 * The Host half provides the `pluginExport` service with runtime Remote
 * markers, so the Typert Gateway claims `pluginExport/listPlugins` and
 * `pluginExport/exportPlugin` endpoints; this half calls them as plain
 * package RPCs over the `/api` connection — no Remote mount needed.
 *
 * The menu closes when the row is clicked (`onDismiss`), which would unmount
 * a dialog rendered inside the row, so the dialog lives in `shell.overlay`
 * and the row only flips a shared switch on the bridge.
 */
window.__ModuleLoader__.load({
  id: '@local/plugin-export',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useEffect, useMemo, useRef, useState } = React

    const en = {
      exportPlugins: 'Export plugins',
      exportPluginsDescription: 'Copy selected installed plugins into a folder',
      dialogTitle: 'Export plugins',
      dialogIntro: 'Choose installed plugins and a target folder. Each plugin is written into its own subdirectory named by its package name.',
      targetLabel: 'Target folder',
      browse: 'Browse…',
      filterLabel: 'Filter',
      selectAll: 'Select all',
      clearAll: 'Clear',
      loading: 'Loading installed plugins…',
      loadFailed: 'Failed to load installed plugins',
      retry: 'Retry',
      noPlugins: 'No installed plugins found',
      noMatches: 'No plugins match the filter',
      exportButton: 'Export',
      exporting: 'Exporting…',
      exportedPrefix: 'Exported to',
      exportFailed: 'Export failed',
      close: 'Close',
      nothingSelected: 'Select at least one plugin',
      folderRequired: 'Choose a target folder first',
    }
    const zh = {
      exportPlugins: '导出插件',
      exportPluginsDescription: '将选中的已安装插件复制到文件夹',
      dialogTitle: '导出插件',
      dialogIntro: '选择已安装的插件和目标文件夹；每个插件会写入以包名命名的独立子目录（作用域名保留 @scope 层级）。',
      targetLabel: '目标文件夹',
      browse: '浏览…',
      filterLabel: '筛选',
      selectAll: '全选',
      clearAll: '清空',
      loading: '正在加载已安装的插件…',
      loadFailed: '加载已安装插件失败',
      retry: '重试',
      noPlugins: '未找到已安装的插件',
      noMatches: '没有符合筛选条件的插件',
      exportButton: '导出',
      exporting: '正在导出…',
      exportedPrefix: '已导出到',
      exportFailed: '导出失败',
      close: '关闭',
      nothingSelected: '请至少选择一个插件',
      folderRequired: '请先选择目标文件夹',
    }

    const ROW_STYLE = `
.dsh-plugin-export-row {
  display: flex; align-items: center; gap: 10px; width: 100%;
  min-height: 72px; padding: 10px 14px; border: 0; background: transparent;
  color: var(--dsw-alias-label-primary); font: inherit; text-align: left; cursor: pointer;
}
.dsh-plugin-export-row:hover { background: var(--dsw-alias-bg-layer-2); }
.dsh-plugin-export-row:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: -2px; }
.dsh-plugin-export-row-icon { flex: none; display: inline-flex; color: var(--dsw-alias-label-secondary); }
.dsh-plugin-export-row-copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dsh-plugin-export-row-title { font-size: 13px; line-height: 18px; font-weight: 500; }
.dsh-plugin-export-row-desc {
  font-size: 12px; line-height: 16px; color: var(--dsw-alias-label-secondary);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
`

    const DIALOG_STYLE = `
.dsh-plugin-export-backdrop {
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: center; justify-content: center;
}
.dsh-plugin-export-dialog {
  width: min(540px, calc(100vw - 48px)); max-height: min(660px, calc(100vh - 64px));
  display: flex; flex-direction: column;
  background: var(--dsw-alias-bg-layer-1);
  border: 1px solid var(--dsw-alias-border-l1);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  color: var(--dsw-alias-label-primary);
}
.dsh-plugin-export-head { display: flex; align-items: center; gap: 8px; padding: 16px 20px 6px; }
.dsh-plugin-export-title { font-size: 16px; line-height: 22px; font-weight: 600; }
.dsh-plugin-export-close {
  margin-left: auto; width: 28px; height: 28px; border: 0; border-radius: 8px;
  background: transparent; color: var(--dsw-alias-label-secondary);
  font: inherit; font-size: 15px; line-height: 28px; cursor: pointer;
}
.dsh-plugin-export-close:hover { background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary); }
.dsh-plugin-export-close:focus-visible,
.dsh-plugin-export-btn:focus-visible,
.dsh-plugin-export-input:focus-visible,
.dsh-plugin-export-item:focus-within { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.dsh-plugin-export-intro { padding: 0 20px 12px; font-size: 13px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
.dsh-plugin-export-field { display: flex; gap: 8px; padding: 0 20px 10px; }
.dsh-plugin-export-field-label { flex: none; align-self: center; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.dsh-plugin-export-input {
  flex: 1; min-width: 0; height: 30px; padding: 0 10px;
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px;
  background: var(--dsw-alias-bg-base); color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 13px;
}
.dsh-plugin-export-input::placeholder { color: var(--dsw-alias-label-secondary); }
.dsh-plugin-export-btn {
  flex: none; height: 30px; padding: 0 12px;
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px;
  background: transparent; color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 13px; cursor: pointer; white-space: nowrap;
}
.dsh-plugin-export-btn:hover { background: var(--dsw-alias-bg-layer-2); }
.dsh-plugin-export-btn[disabled] { opacity: 0.5; cursor: default; }
.dsh-plugin-export-btn[data-primary="true"] {
  background: var(--dsw-alias-brand-primary); border-color: transparent; color: var(--dsw-alias-bg-base);
}
.dsh-plugin-export-toolbar { display: flex; align-items: center; gap: 8px; padding: 0 20px 8px; }
.dsh-plugin-export-toolbar .dsh-plugin-export-input { height: 28px; font-size: 12px; }
.dsh-plugin-export-list {
  flex: 1; min-height: 120px; overflow: auto; margin: 0 12px;
  border: 1px solid var(--dsw-alias-border-l1); border-radius: 10px;
  background: var(--dsw-alias-bg-base);
}
.dsh-plugin-export-item {
  display: flex; align-items: flex-start; gap: 10px; width: 100%;
  padding: 9px 12px; border: 0; background: transparent;
  color: inherit; font: inherit; text-align: left; cursor: pointer;
  user-select: none;
}
.dsh-plugin-export-item:hover { background: var(--dsw-alias-bg-layer-2); }
.dsh-plugin-export-item[data-checked="true"] { background: var(--dsw-alias-bg-layer-2); }
.dsh-plugin-export-item input { margin: 2px 0 0; accent-color: var(--dsw-alias-brand-primary); }
.dsh-plugin-export-item-copy { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.dsh-plugin-export-item-title { display: flex; align-items: baseline; gap: 8px; font-size: 13px; line-height: 18px; }
.dsh-plugin-export-item-name {
  font-size: 11px; line-height: 14px; color: var(--dsw-alias-label-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.dsh-plugin-export-item-version { flex: none; font-size: 11px; color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
.dsh-plugin-export-item-desc {
  font-size: 12px; line-height: 16px; color: var(--dsw-alias-label-secondary);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.dsh-plugin-export-empty { padding: 28px 16px; text-align: center; font-size: 13px; color: var(--dsw-alias-label-secondary); }
.dsh-plugin-export-foot { display: flex; align-items: center; gap: 10px; padding: 10px 20px 16px; }
.dsh-plugin-export-status {
  flex: 1; min-width: 0; font-size: 12px; line-height: 16px;
  color: var(--dsw-alias-label-secondary);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.dsh-plugin-export-status[data-kind="success"] { color: var(--dsw-alias-state-success-primary); }
.dsh-plugin-export-status[data-kind="error"] { color: var(--dsw-alias-state-error-primary); }
`

    function DownloadGlyph() {
      return h('svg', { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': true, focusable: 'false' },
        h('path', {
          d: 'M8 2v8m0 0 3-3m-3 3-3-3',
          stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', fill: 'none',
        }),
        h('path', {
          d: 'M2.5 11.5v1a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-1',
          stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round', fill: 'none',
        }))
    }

    function CloseGlyph() {
      return h('svg', { width: 12, height: 12, viewBox: '0 0 12 12', 'aria-hidden': true, focusable: 'false' },
        h('path', {
          d: 'M2.5 2.5l7 7m0-7-7 7',
          stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round', fill: 'none',
        }))
    }

    /**
     * One bridge per plugin lifetime: the dialog open-state switch shared by
     * the menu row and the overlay host, plus the Host RPC calls.
     */
    function createExportBridge(ctx) {
      const listeners = new Set()
      let open = false
      const notify = () => { for (const listener of [...listeners]) listener() }
      const setOpen = (next) => {
        if (open === next) return
        open = next
        notify()
      }

      const call = async (method, args) => {
        const connection = ctx.get('connection')
        if (connection === undefined || connection.rpc?.call === undefined) {
          throw new Error('The connection to the application host is unavailable')
        }
        const controller = new AbortController()
        const result = await connection.rpc.call('/api', method, { args }, controller.signal)
        if (!result.ok) {
          const message = result.error && typeof result.error.message === 'string'
            ? result.error.message
            : `${method} failed`
          throw new Error(message)
        }
        return result.value
      }

      return {
        isDialogOpen: () => open,
        subscribeDialog: (listener) => {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
        openDialog: () => setOpen(true),
        closeDialog: () => setOpen(false),
        listPlugins: async () => {
          const value = await call('pluginExport/listPlugins', {})
          return Array.isArray(value) ? value : []
        },
        exportPlugin: (pluginName, targetDir) => call('pluginExport/exportPlugin', { pluginName, targetDir }),
        pickDirectory: async () => {
          const service = ctx.get('uiWorkspace')
          if (service === undefined || typeof service.pickDirectory !== 'function') return null
          return await service.pickDirectory()
        },
        defaultTarget: () => {
          // `ctx.get` is the unchecked read; a bare `ctx.remote` would throw
          // because `remote` is not in this plugin's inject list.
          const remote = ctx.get('remote')
          const facts = remote && remote.$host
          const home = facts && typeof facts.home === 'string' ? facts.home : ''
          return home.length > 0 ? `${home.replace(/[\\/]+$/, '')}/plugin-exports` : ''
        },
      }
    }

    /** The add-plugin menu row. Owner props bring `onDismiss`; the bridge brings the rest. */
    function ExportAction({ t, onDismiss, openDialog }) {
      const activate = () => {
        try {
          if (typeof onDismiss === 'function') onDismiss()
        } catch {}
        openDialog()
      }
      return h(React.Fragment, null,
        h('style', null, ROW_STYLE),
        h('button', {
          type: 'button',
          className: 'dsh-plugin-export-row',
          role: 'menuitem',
          onClick: activate,
        },
        h('span', { className: 'dsh-plugin-export-row-icon', 'aria-hidden': true }, h(DownloadGlyph)),
        h('span', { className: 'dsh-plugin-export-row-copy' },
          h('span', { className: 'dsh-plugin-export-row-title' }, t('exportPlugins')),
          h('span', { className: 'dsh-plugin-export-row-desc' }, t('exportPluginsDescription')))))
    }

    /** The frame-wide host that renders the dialog only while it is open. */
    function ExportDialogHost(props) {
      const { isDialogOpen, subscribeDialog } = props
      const [open, setOpen] = useState(isDialogOpen)
      useEffect(() => subscribeDialog(() => setOpen(isDialogOpen())), [isDialogOpen, subscribeDialog])
      if (!open) return null
      return h(ExportDialog, props)
    }

    function ExportDialog({ t, closeDialog, listPlugins, exportPlugin, pickDirectory, defaultTarget }) {
      const [phase, setPhase] = useState('loading')
      const [plugins, setPlugins] = useState([])
      const [loadError, setLoadError] = useState('')
      const [selected, setSelected] = useState(() => new Set())
      const [filter, setFilter] = useState('')
      const [target, setTarget] = useState(defaultTarget)
      const [busy, setBusy] = useState(false)
      const [status, setStatus] = useState({ kind: 'idle', message: '' })
      const alive = useRef(true)

      useEffect(() => {
        alive.current = true
        return () => { alive.current = false }
      }, [])

      const load = async () => {
        setPhase('loading')
        setLoadError('')
        try {
          const items = await listPlugins()
          if (!alive.current) return
          setPlugins(items)
          setPhase('ready')
        } catch (error) {
          if (!alive.current) return
          setLoadError(error instanceof Error ? error.message : String(error))
          setPhase('error')
        }
      }

      useEffect(() => { void load() }, [])

      useEffect(() => {
        if (!busy) return undefined
        const cancel = (event) => { if (event.key === 'Escape') event.stopPropagation() }
        window.addEventListener('keydown', cancel, true)
        return () => { window.removeEventListener('keydown', cancel, true) }
      }, [busy])

      useEffect(() => {
        const cancel = (event) => {
          if (event.key === 'Escape' && !busy) closeDialog()
        }
        window.addEventListener('keydown', cancel)
        return () => { window.removeEventListener('keydown', cancel) }
      }, [busy, closeDialog])

      const visible = useMemo(() => {
        const query = filter.trim().toLowerCase()
        if (query.length === 0) return plugins
        return plugins.filter(plugin => {
          const haystack = `${plugin.title ?? ''} ${plugin.name} ${plugin.description ?? ''}`.toLowerCase()
          return haystack.includes(query)
        })
      }, [plugins, filter])

      const toggle = (name) => {
        setSelected(previous => {
          const next = new Set(previous)
          if (next.has(name)) next.delete(name)
          else next.add(name)
          return next
        })
      }

      const browse = async () => {
        try {
          const picked = await pickDirectory()
          if (typeof picked === 'string' && picked.length > 0) setTarget(picked)
        } catch {}
      }

      const run = async () => {
        if (busy) return
        const folder = target.trim()
        if (folder.length === 0) {
          setStatus({ kind: 'error', message: t('folderRequired') })
          return
        }
        if (selected.size === 0) {
          setStatus({ kind: 'error', message: t('nothingSelected') })
          return
        }
        setBusy(true)
        setStatus({ kind: 'idle', message: t('exporting') })
        try {
          for (const name of selected) {
            await exportPlugin(name, folder)
          }
          if (!alive.current) return
          // Each plugin landed in its own subtree under the chosen parent.
          setStatus({ kind: 'success', message: `${t('exportedPrefix')} ${folder}` })
        } catch (error) {
          if (!alive.current) return
          const message = error instanceof Error ? error.message : String(error)
          setStatus({ kind: 'error', message: `${t('exportFailed')}: ${message}` })
        } finally {
          if (alive.current) setBusy(false)
        }
      }

      const onBackdrop = (event) => {
        if (event.target === event.currentTarget && !busy) closeDialog()
      }

      const allVisibleSelected = visible.length > 0 && visible.every(plugin => selected.has(plugin.name))

      return h(React.Fragment, null,
        h('style', null, DIALOG_STYLE),
        h('div', { className: 'dsh-plugin-export-backdrop', onMouseDown: onBackdrop },
        h('div', {
          className: 'dsh-plugin-export-dialog',
          role: 'dialog',
          'aria-modal': 'true',
          'aria-label': t('dialogTitle'),
        },
        h('div', { className: 'dsh-plugin-export-head' },
          h('span', { className: 'dsh-plugin-export-title' }, t('dialogTitle')),
          h('button', {
            type: 'button',
            className: 'dsh-plugin-export-close',
            onClick: closeDialog,
            disabled: busy,
            'aria-label': t('close'),
            title: t('close'),
          }, h(CloseGlyph))),
        h('div', { className: 'dsh-plugin-export-intro' }, t('dialogIntro')),
        h('div', { className: 'dsh-plugin-export-field' },
          h('label', { className: 'dsh-plugin-export-field-label', for: 'dsh-plugin-export-target' }, t('targetLabel')),
          h('input', {
            id: 'dsh-plugin-export-target',
            className: 'dsh-plugin-export-input',
            type: 'text',
            value: target,
            disabled: busy,
            spellCheck: false,
            onChange: event => setTarget(event.target.value),
          }),
          h('button', { type: 'button', className: 'dsh-plugin-export-btn', onClick: browse, disabled: busy },
            t('browse'))),
        h('div', { className: 'dsh-plugin-export-toolbar' },
          h('input', {
            className: 'dsh-plugin-export-input',
            type: 'text',
            value: filter,
            placeholder: t('filterLabel'),
            disabled: busy || phase !== 'ready',
            spellCheck: false,
            onChange: event => setFilter(event.target.value),
            'aria-label': t('filterLabel'),
          }),
          h('button', {
            type: 'button',
            className: 'dsh-plugin-export-btn',
            disabled: busy || phase !== 'ready' || visible.length === 0,
            onClick: () => setSelected(previous => {
              const next = new Set(previous)
              for (const plugin of visible) next.add(plugin.name)
              return next
            }),
          }, allVisibleSelected ? t('clearAll') : t('selectAll'))),
        h('div', { className: 'dsh-plugin-export-list', role: 'listbox', 'aria-multiselectable': 'true' },
          phase === 'loading'
            ? h('div', { className: 'dsh-plugin-export-empty' }, t('loading'))
            : phase === 'error'
              ? h('div', { className: 'dsh-plugin-export-empty' },
                t('loadFailed'),
                loadError.length > 0 ? ' — ' + loadError : '',
                h('button', { type: 'button', className: 'dsh-plugin-export-btn', style: { margin: '10px auto 0', display: 'inline-block' }, onClick: load }, t('retry')))
              : visible.length === 0
                ? h('div', { className: 'dsh-plugin-export-empty' }, plugins.length === 0 ? t('noPlugins') : t('noMatches'))
                : visible.map(plugin => h('label', {
                  key: plugin.name,
                  className: 'dsh-plugin-export-item',
                  'data-checked': selected.has(plugin.name) ? 'true' : undefined,
                },
                h('input', {
                  type: 'checkbox',
                  checked: selected.has(plugin.name),
                  disabled: busy,
                  onChange: () => toggle(plugin.name),
                }),
                h('span', { className: 'dsh-plugin-export-item-copy' },
                  h('span', { className: 'dsh-plugin-export-item-title' },
                    h('span', { className: 'dsh-plugin-export-item-name', title: plugin.name },
                      plugin.title && plugin.title.length > 0 ? plugin.title : plugin.name),
                    h('span', { className: 'dsh-plugin-export-item-version' }, plugin.version)),
                  plugin.description && plugin.description.length > 0
                    ? h('span', { className: 'dsh-plugin-export-item-desc', title: plugin.description }, plugin.description)
                    : null)))),
        h('div', { className: 'dsh-plugin-export-foot' },
          h('span', {
            className: 'dsh-plugin-export-status',
            'data-kind': status.kind === 'idle' ? undefined : status.kind,
            role: 'status',
          }, status.message),
          h('button', {
            type: 'button',
            className: 'dsh-plugin-export-btn',
            'data-primary': 'true',
            onClick: run,
            disabled: busy || phase !== 'ready' || selected.size === 0,
          }, busy ? t('exporting') : t('exportButton'))))))
    }

    return {
      inject: ['slots', 'locale', 'connection', 'uiWorkspace'],
      async apply(ctx) {
        ctx.effect(() => ctx.locale.register('plugin-export', { en, zh }), 'plugin-export: dictionaries')
        const bridge = createExportBridge(ctx)
        ctx.effect(() => ctx.slots.inject('plugins.add.actions', () => ctx.slots.register({
          name: 'plugins.add.actions',
          id: 'plugin-export',
          order: 20,
          locale: 'plugin-export',
          inject: () => bridge,
        }, ExportAction)), 'plugin-export: add-plugin menu row')
        ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'plugin-export.dialog',
          locale: 'plugin-export',
          inject: () => bridge,
        }, ExportDialogHost)), 'plugin-export: export dialog overlay')
      },
    }
  },
})
