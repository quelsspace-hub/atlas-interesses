import { CheckSquare, FolderOpen, FolderPlus, Inbox as InboxIcon, LayoutGrid, Map as MapIcon, NotebookPen, Rocket, Settings as SettingsIcon, Tags } from 'lucide-react'
import { useEffect, useState } from 'react'
import { isOpenTask } from '../domain/derive.js'
import type { AppState } from '../shared/api.js'
import { AtlasScreen, GroupScreen } from './screens/Atlas.js'
import { InboxScreen } from './screens/Inbox.js'
import { ItemScreen } from './screens/Item.js'
import { NoteScreen, NotesScreen } from './screens/Notes.js'
import { OrganizationScreen } from './screens/Organization.js'
import { OverviewScreen } from './screens/Overview.js'
import { SettingsScreen } from './screens/Settings.js'
import { TasksScreen } from './screens/Tasks.js'
import { AtlasProvider, errorText, useAtlas, type Screen } from './state.js'
import { Button, Modal } from './ui.js'

function applyTheme(state: AppState) {
  const dark = state.theme === 'dark' || (state.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
}

export function App() {
  const [state, setState] = useState<AppState | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    void window.atlas.getState().then((r) => (r.ok ? setState(r.value) : setError(errorText(r.error))))
  }, [])
  useEffect(() => {
    if (!state) return
    applyTheme(state)
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => applyTheme(state)
    media.addEventListener('change', listener)
    return () => media.removeEventListener('change', listener)
  }, [state])
  if (error) return <div className="welcome"><div className="banner danger">{error}</div></div>
  if (!state) return null
  return (
    <AtlasProvider initial={state} renderPending={(pending) => pending && (
      <Modal title="Há alterações não salvas" onClose={() => pending.resolve('cancel')} actions={<>
        <Button onClick={() => pending.resolve('cancel')}>Cancelar</Button>
        <Button kind="danger" onClick={() => pending.resolve('discard')}>Descartar alterações</Button>
        <Button kind="primary" onClick={() => pending.resolve('save')}>Salvar</Button>
      </>}>
        <p>Itens com alterações: {pending.entries.map((e) => e.label).join(', ')}.</p>
        <p className="muted">Descartar não pode ser desfeito. Cancelar mantém você na tela atual.</p>
      </Modal>
    )}>
      <Shell onState={setState} />
    </AtlasProvider>
  )
}

function Shell({ onState }: { onState: (s: AppState) => void }) {
  const ctx = useAtlas()
  const { app, setApp, index, route, navigate } = ctx
  useEffect(() => { onState(app) }, [app, onState])

  // Atalhos Alt+1–Alt+6 (UX §5, D-025).
  useEffect(() => {
    const order: Screen[] = ['overview', 'inbox', 'atlas', 'tasks', 'notes', 'organization']
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return
      const n = Number(e.key)
      if (n >= 1 && n <= order.length) { e.preventDefault(); navigate({ screen: order[n - 1]! }) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  if (!app.vaultPath) return <Welcome app={app} onState={setApp} />

  const pending = index?.captures.filter((c) => c.metadata.status === 'pending').length ?? 0
  const open = index?.tasks.filter((t) => isOpenTask(t.metadata)).length ?? 0
  const nav: Array<{ screen: Screen; label: string; icon: React.ReactNode; count?: number; key?: string }> = [
    { screen: 'overview', label: 'Visão geral', icon: <MapIcon size={18} />, key: 'Alt+1' },
    { screen: 'inbox', label: 'Inbox', icon: <InboxIcon size={18} />, count: pending, key: 'Alt+2' },
    { screen: 'atlas', label: 'Atlas', icon: <LayoutGrid size={18} />, key: 'Alt+3' },
    { screen: 'projects', label: 'Projetos', icon: <Rocket size={18} /> },
    { screen: 'tasks', label: 'Tarefas', icon: <CheckSquare size={18} />, count: open, key: 'Alt+4' },
    { screen: 'notes', label: 'Notas', icon: <NotebookPen size={18} />, key: 'Alt+5' },
    { screen: 'organization', label: 'Organização', icon: <Tags size={18} />, key: 'Alt+6' }
  ]
  const current: Screen = route.screen === 'group' ? 'atlas' : route.screen === 'item' ? 'atlas' : route.screen === 'note' ? 'notes' : route.screen
  const vaultName = app.vaultPath.split(/[\\/]/).filter(Boolean).pop()

  return (
    <div className="app">
      <nav className="sidebar" aria-label="Navegação principal">
        <div className="brand"><strong>ATLAS DE INTERESSES</strong><span title={app.vaultPath}>{vaultName}</span></div>
        {nav.map((n) => (
          <button key={n.screen} className="nav-item" aria-current={current === n.screen ? 'page' : undefined} onClick={() => navigate({ screen: n.screen })} title={n.key ? `${n.label} (${n.key})` : n.label}>
            {n.icon}<span className="nav-label">{n.label}</span>{!!n.count && <span className="count">{n.count}</span>}
          </button>
        ))}
        <div className="nav-bottom">
          <div className="nav-sep" />
          <button className="nav-item" aria-current={current === 'settings' ? 'page' : undefined} onClick={() => navigate({ screen: 'settings' })}>
            <SettingsIcon size={18} /><span className="nav-label">Configurações e backup</span>
          </button>
        </div>
      </nav>
      <main className="main" id="conteudo">
        {!index ? <div className="page"><p className="muted">Lendo o vault…</p></div> : <Routes />}
      </main>
    </div>
  )
}

function Routes() {
  const { route } = useAtlas()
  switch (route.screen) {
    case 'overview': return <OverviewScreen />
    case 'inbox': return <InboxScreen focusId={route.id} />
    case 'atlas': return <AtlasScreen />
    case 'projects': return <AtlasScreen projectsOnly />
    case 'group': return <GroupScreen id={route.id!} />
    case 'item': return <ItemScreen key={route.id} id={route.id!} />
    case 'tasks': return <TasksScreen focusId={route.id} />
    case 'notes': return <NotesScreen />
    case 'note': return <NoteScreen key={route.id} id={route.id!} />
    case 'organization': return <OrganizationScreen />
    case 'settings': return <SettingsScreen />
  }
}

function Welcome({ app, onState }: { app: AppState; onState: (s: AppState) => void }) {
  const { run } = useAtlas()
  const choose = async (mode: 'open' | 'create') => { const s = await run(window.atlas.chooseVault(mode)); if (s) onState(s) }
  return (
    <div className="welcome">
      <div className="hub">
        <h1 className="display">ATLAS DE INTERESSES</h1>
        <p className="muted">Seus interesses, projetos e notas em arquivos Markdown locais. Escolha uma pasta para guardar o vault — nada sai deste computador.</p>
        <div className="row" style={{ justifyContent: 'center' }}>
          <Button kind="primary" onClick={() => void choose('create')}><FolderPlus size={18} /> Criar vault</Button>
          <Button onClick={() => void choose('open')}><FolderOpen size={18} /> Abrir vault existente</Button>
        </div>
        {app.recentVaults.length > 0 && (
          <div className="stack" style={{ textAlign: 'left' }}>
            <h3>Recentes</h3>
            {app.recentVaults.map((p) => (
              <button key={p} className="card clickable" onClick={async () => { const s = await run(window.atlas.openRecent(p)); if (s) onState(s) }}>{p}</button>
            ))}
          </div>
        )}
        <p className="muted body-s">Versão {app.version}</p>
      </div>
    </div>
  )
}
