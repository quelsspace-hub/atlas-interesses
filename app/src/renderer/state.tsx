import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { buildIndex, type RecordView, type VaultIndex } from '../domain/derive.js'
import type { EntityKind } from '../domain/model.js'
import type { ApiError, AppState, ConversionOutput, Result, VaultSnapshot } from '../shared/api.js'

export type Screen = 'overview' | 'inbox' | 'atlas' | 'projects' | 'group' | 'item' | 'tasks' | 'notes' | 'note' | 'organization' | 'search' | 'map' | 'settings'
export interface Route { screen: Screen; id?: string }

interface Toast { id: number; kind: 'info' | 'error'; text: string }

interface DirtyEntry { label: string; save: () => Promise<boolean> }

interface Ctx {
  app: AppState
  setApp: (s: AppState) => void
  snapshot: VaultSnapshot | null
  index: VaultIndex | null
  reload: () => Promise<void>
  route: Route
  navigate: (r: Route) => void
  // Retorno ao contexto (D-029): volta à tela anterior, que restaura o próprio estado (ex.: zoom do mapa).
  goBack: (fallback: Route) => void
  previous: Route | null
  toast: (text: string, kind?: Toast['kind']) => void
  run: <T>(promise: Promise<Result<T>>, okText?: string) => Promise<T | null>
  create: (kind: EntityKind, metadata: Record<string, unknown>, body?: string, okText?: string) => Promise<RecordView | null>
  update: (record: RecordView, metadata: Record<string, unknown>, body?: string, okText?: string) => Promise<RecordView | ApiError>
  convert: (capture: RecordView, outputs: ConversionOutput[]) => Promise<string | null>
  setDirty: (key: string, entry: DirtyEntry | null) => void
  confirmDiscard: (proceed: () => void) => void
}

const Context = createContext<Ctx | null>(null)

// Rota e histórico mudam juntos num reducer puro (retorno ao contexto, D-029): Voltar só leva a rotas
// que foram exibidas, mesmo com navegações em sequência rápida.
interface Navigation { route: Route; history: Route[] }
type NavAction = { type: 'navigate'; route: Route } | { type: 'back'; fallback: Route } | { type: 'reset' }
const HOME: Navigation = { route: { screen: 'overview' }, history: [] }

export function navigationReducer(state: Navigation, action: NavAction): Navigation {
  switch (action.type) {
    case 'navigate': {
      const same = state.route.screen === action.route.screen && state.route.id === action.route.id
      return { route: action.route, history: same ? state.history : [...state.history.slice(-49), state.route] }
    }
    case 'back': {
      const previous = state.history[state.history.length - 1]
      return { route: previous ?? action.fallback, history: state.history.slice(0, -1) }
    }
    case 'reset':
      return HOME
  }
}

export function useAtlas(): Ctx {
  const ctx = useContext(Context)
  if (!ctx) throw new Error('AtlasProvider ausente')
  return ctx
}

// Campos com undefined são omitidos (ex.: prioridade removida = chave ausente, D-020).
const clean = (m: Record<string, unknown>) => JSON.parse(JSON.stringify(m)) as Record<string, unknown>

export function errorText(error: ApiError): string {
  const diagnostics = error.details?.diagnostics as Array<{ path: string; message: string }> | undefined
  return diagnostics && diagnostics.length > 0 ? `${error.message} ${diagnostics.slice(0, 4).map((d) => `${d.path}: ${d.message}`).join(' · ')}` : error.message
}

export function AtlasProvider({ initial, children, renderPending }: { initial: AppState; children: ReactNode; renderPending: (pending: { entries: DirtyEntry[]; resolve: (choice: 'save' | 'discard' | 'cancel') => void } | null) => ReactNode }) {
  const [app, setApp] = useState(initial)
  const [snapshot, setSnapshot] = useState<VaultSnapshot | null>(null)
  const [{ route, history }, dispatch] = useReducer(navigationReducer, HOME)
  const [toasts, setToasts] = useState<Toast[]>([])
  const dirty = useRef(new Map<string, DirtyEntry>())
  const [pending, setPending] = useState<{ entries: DirtyEntry[]; resolve: (c: 'save' | 'discard' | 'cancel') => void } | null>(null)
  const toastId = useRef(0)

  const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = ++toastId.current
    setToasts((t) => [...t, { id, kind, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 12000 : 4000)
  }, [])

  const run = useCallback(async <T,>(promise: Promise<Result<T>>, okText?: string): Promise<T | null> => {
    const result = await promise
    if (!result.ok) { toast(errorText(result.error), 'error'); return null }
    if (okText) toast(okText)
    return result.value
  }, [toast])

  const reload = useCallback(async () => {
    const result = await window.atlas.loadVault()
    if (result.ok) setSnapshot(result.value)
    else toast(errorText(result.error), 'error')
  }, [toast])

  useEffect(() => {
    dirty.current.clear()
    setSnapshot(null)
    dispatch({ type: 'reset' })
    if (app.vaultPath) void reload()
  }, [app.vaultPath, reload])

  const applyRecord = useCallback((record: RecordView) => {
    setSnapshot((s) => s && ({ ...s, records: [...s.records.filter((r) => r.id !== record.id), record] }))
  }, [])

  const create = useCallback(async (kind: EntityKind, metadata: Record<string, unknown>, body = '', okText?: string) => {
    const record = await run(window.atlas.createRecord(kind, clean(metadata), body), okText)
    if (record) applyRecord(record)
    return record
  }, [run, applyRecord])

  // Devolve o erro para a tela decidir (conflito preserva a edição; nunca mostra "salvo" sem confirmação).
  const update = useCallback(async (record: RecordView, metadata: Record<string, unknown>, body?: string, okText?: string): Promise<RecordView | ApiError> => {
    const result = await window.atlas.updateRecord(record.id, record.revision, clean(metadata), body)
    if (!result.ok) {
      if (result.error.code !== 'conflict') toast(errorText(result.error), 'error')
      return result.error
    }
    applyRecord(result.value)
    if (okText) toast(okText)
    return result.value
  }, [toast, applyRecord])

  const convert = useCallback(async (capture: RecordView, outputs: ConversionOutput[]) => {
    const result = await run(window.atlas.convertCapture(capture.id, capture.revision, outputs), 'Captura processada; resultado gravado e verificado.')
    await reload()
    return result?.primaryId ?? null
  }, [run, reload])

  const setDirty = useCallback((key: string, entry: DirtyEntry | null) => {
    if (entry) dirty.current.set(key, entry)
    else dirty.current.delete(key)
  }, [])

  const askPending = useCallback(() => new Promise<'save' | 'discard' | 'cancel'>((resolve) => {
    setPending({ entries: [...dirty.current.values()], resolve: (choice) => { setPending(null); resolve(choice) } })
  }), [])

  const confirmDiscard = useCallback((proceed: () => void) => {
    if (dirty.current.size === 0) { proceed(); return }
    void askPending().then(async (choice) => {
      if (choice === 'cancel') return
      if (choice === 'save') {
        for (const entry of [...dirty.current.values()]) if (!(await entry.save())) return
      }
      dirty.current.clear()
      proceed()
    })
  }, [askPending])

  const navigate = useCallback((next: Route) => confirmDiscard(() => dispatch({ type: 'navigate', route: next })), [confirmDiscard])
  const goBack = useCallback((fallback: Route) => confirmDiscard(() => dispatch({ type: 'back', fallback })), [confirmDiscard])
  const previous = history[history.length - 1] ?? null

  // D-025: fechar a janela com alterações pendentes pergunta Salvar / Descartar / Cancelar.
  useEffect(() => window.atlas.onCloseRequested(() => confirmDiscard(() => void window.atlas.confirmClose())), [confirmDiscard])

  const index = useMemo(() => (snapshot ? buildIndex(snapshot.records) : null), [snapshot])

  const value: Ctx = { app, setApp, snapshot, index, reload, route, navigate, goBack, previous, toast, run, create, update, convert, setDirty, confirmDiscard }
  return (
    <Context.Provider value={value}>
      {children}
      {renderPending(pending)}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'error' ? 'error' : ''}`} role={t.kind === 'error' ? 'alert' : undefined}>
            <p>{t.text}</p>
            <button className="btn ghost small" onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))} aria-label="Fechar aviso">×</button>
          </div>
        ))}
      </div>
    </Context.Provider>
  )
}

export const nowIso = () => new Date().toISOString()
