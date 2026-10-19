import MarkdownIt from 'markdown-it'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { itemProgress, type RecordView } from '../domain/derive.js'
import { resolveRelative } from '../domain/links.js'
import { LABELS, type Item, type Tag } from '../domain/model.js'
import type { ApiError } from '../shared/api.js'
import { useAtlas, type Route } from './state.js'

export function Button({ kind = 'default', small, icon, children, ...rest }: { kind?: 'default' | 'primary' | 'danger' | 'ghost'; small?: boolean; icon?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`btn ${kind === 'default' ? '' : kind} ${small ? 'small' : ''} ${icon ? 'icon' : ''}`} {...rest}>{children}</button>
}

export function Field({ label, help, error, children }: { label: string; help?: string; error?: string; children: (id: string, describedBy?: string) => ReactNode }) {
  const id = useId()
  const describedBy = error ? `${id}-error` : help ? `${id}-help` : undefined
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      {children(id, describedBy)}
      {help && !error && <span className="help" id={`${id}-help`}>{help}</span>}
      {error && <span className="error" id={`${id}-error`}>{error}</span>}
    </label>
  )
}

export function TextField({ label, value, onChange, help, error, placeholder, required, type = 'text', autoFocus }: { label: string; value: string; onChange: (v: string) => void; help?: string; error?: string; placeholder?: string; required?: boolean; type?: string; autoFocus?: boolean }) {
  return (
    <Field label={required ? `${label} *` : label} help={help} error={error}>
      {(id, d) => <input id={id} className="input" type={type} value={value} placeholder={placeholder} aria-describedby={d} aria-invalid={!!error} aria-required={required} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} />}
    </Field>
  )
}

export function TextArea({ label, value, onChange, rows = 3, help, className = '' }: { label: string; value: string; onChange: (v: string) => void; rows?: number; help?: string; className?: string }) {
  return <Field label={label} help={help}>{(id, d) => <textarea id={id} className={`input ${className}`} rows={rows} value={value} aria-describedby={d} onChange={(e) => onChange(e.target.value)} />}</Field>
}

export function SelectField<T extends string>({ label, value, options, onChange, help, allowEmpty }: { label: string; value: T | ''; options: ReadonlyArray<readonly [T, string]>; onChange: (v: T | '') => void; help?: string; allowEmpty?: string }) {
  return (
    <Field label={label} help={help}>
      {(id, d) => (
        <select id={id} className="input" value={value} aria-describedby={d} onChange={(e) => onChange(e.target.value as T | '')}>
          {allowEmpty !== undefined && <option value="">{allowEmpty}</option>}
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      )}
    </Field>
  )
}

export const entries = <T extends string>(record: Record<T, string>) => Object.entries(record) as Array<[T, string]>

export function TagBadge({ tag }: { tag: Tag | undefined }) {
  if (!tag) return <span className="badge danger">Tag ausente</span>
  return (
    <span className={`badge ${tag.archived_at ? 'archived' : ''}`} title={tag.description || undefined}>
      {tag.color && <span className="dot" style={{ background: tag.color }} aria-hidden="true" />}
      {tag.title}{tag.archived_at ? ' (arquivada)' : ''}
    </span>
  )
}

export function TagList({ ids }: { ids: readonly string[] }) {
  const { index } = useAtlas()
  if (ids.length === 0) return null
  return <span className="row">{ids.map((id) => <TagBadge key={id} tag={index?.byId.get(id)?.metadata as Tag | undefined} />)}</span>
}

// Seletor de tags: tags arquivadas ficam ocultas para novas escolhas, mas as já associadas continuam visíveis.
export function TagPicker({ label = 'Tags', value, onChange }: { label?: string; value: string[]; onChange: (ids: string[]) => void }) {
  const { index } = useAtlas()
  const tags = (index?.tags ?? []).filter((t) => !t.metadata.archived_at || value.includes(t.id))
  const missing = value.filter((id) => !index?.byId.has(id))
  return (
    <div className="field" role="group" aria-label={label}>
      <span>{label}</span>
      <div className="tag-picker">
        {tags.length === 0 && <span className="muted body-s">Nenhuma tag. Crie tags em Organização.</span>}
        {tags.map((t) => {
          const on = value.includes(t.id)
          return (
            <button key={t.id} type="button" className="tag-toggle" aria-pressed={on} onClick={() => onChange(on ? value.filter((v) => v !== t.id) : [...value, t.id])}>
              {t.metadata.color && <span className="badge dot" style={{ background: t.metadata.color, padding: 0, width: 10, height: 10 }} aria-hidden="true" />}
              {t.metadata.title}{t.metadata.archived_at ? ' (arquivada)' : ''}
            </button>
          )
        })}
        {missing.map((id) => <span key={id} className="badge danger" title={id}>Tag ausente</span>)}
      </div>
    </div>
  )
}

export function Modal({ title, onClose, children, actions, wide }: { title: string; onClose: () => void; children: ReactNode; actions?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const first = ref.current?.querySelector<HTMLElement>('input, select, textarea, button')
    first?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); previous?.focus() }
  }, [onClose])
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <h2>{title}</h2>
        {children}
        {actions && <div className="row end">{actions}</div>}
      </div>
    </div>
  )
}

const SCREEN_LABEL: Record<string, string> = { overview: 'Visão geral', inbox: 'Inbox', atlas: 'Atlas', projects: 'Projetos', group: 'Grupo', item: 'Item', tasks: 'Tarefas', notes: 'Notas', note: 'Nota', organization: 'Organização', search: 'Busca', map: 'Mapa', graph: 'Grafo', settings: 'Configurações' }

// Volta à tela anterior (retorno ao contexto, D-029); sem histórico, vai para `fallback`.
export function BackButton({ fallback }: { fallback: Route }) {
  const { goBack, previous } = useAtlas()
  const target = previous ?? fallback
  return <Button kind="ghost" small onClick={() => goBack(fallback)}>← {SCREEN_LABEL[target.screen] ?? 'Voltar'}</Button>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

export function Progress({ value, mode }: { value: number | null; mode?: string }) {
  if (mode === 'none') return <span className="muted body-s">Sem progresso</span>
  if (value === null) return <span className="muted body-s">{mode === 'tasks' ? 'Sem tarefas elegíveis' : 'Não informado'}</span>
  return (
    <span className="progress" aria-label={`Progresso ${value}%`}>
      <span className="bar" aria-hidden="true"><i style={{ width: `${value}%` }} /></span>
      <span>{value}%</span>
    </span>
  )
}

export function ItemProgress({ item }: { item: Item }) {
  const { index } = useAtlas()
  if (!index) return null
  return <Progress value={itemProgress(index, item)} mode={item.progress_mode} />
}

export function StatusBadge({ item }: { item: Item }) {
  return <span className={`badge ${item.status === 'archived' ? 'archived' : ''}`}>{LABELS.itemStatus[item.status]}</span>
}

// Navegação para registros a partir de um caminho relativo.
export function routeFor(record: RecordView): Route {
  switch (record.kind) {
    case 'item': return { screen: 'item', id: record.id }
    case 'note': return { screen: 'note', id: record.id }
    case 'group': return { screen: 'group', id: record.id }
    case 'task': return { screen: 'tasks', id: record.id }
    case 'capture': return { screen: 'inbox', id: record.id }
    default: return { screen: 'organization' }
  }
}

const md = new MarkdownIt('commonmark', { html: false, linkify: false })

// Pré-visualização segura (html desativado). Links locais navegam no app; quebrados ficam marcados sem apagar o texto.
export function MarkdownView({ source, fromPath }: { source: string; fromPath: string }) {
  const { index, navigate, run } = useAtlas()
  const html = useMemo(() => md.render(source), [source])
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const root = ref.current
    if (!root || !index) return
    const paths = new Map([...index.byId.values()].map((r) => [r.path, r]))
    for (const a of root.querySelectorAll('a')) {
      const href = a.getAttribute('href') ?? ''
      if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#')) continue
      let target: string | null = null
      try { target = resolveRelative(fromPath, decodeURI(href.split('#')[0] ?? '')) } catch { target = null }
      if (target && !paths.has(target) && !target.startsWith('assets/')) { a.classList.add('broken'); a.title = 'Link quebrado: alvo não encontrado' }
    }
    for (const img of root.querySelectorAll('img')) img.removeAttribute('src')
  }, [html, index, fromPath])
  const onClick = useCallback((e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a')
    if (!a) return
    e.preventDefault()
    const href = a.getAttribute('href') ?? ''
    if (/^(https?:|mailto:)/i.test(href)) { void run(window.atlas.openExternal(href)); return }
    if (!index) return
    let target: string | null = null
    try { target = resolveRelative(fromPath, decodeURI(href.split('#')[0] ?? '')) } catch { target = null }
    const record = target ? [...index.byId.values()].find((r) => r.path === target) : undefined
    if (record) navigate(routeFor(record))
  }, [index, fromPath, navigate, run])
  return <div className="markdown" ref={ref} onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
}

// A linha em branco entre o frontmatter e o corpo (convenção dos exemplos) não aparece no editor;
// é devolvida ao salvar uma edição explícita do corpo.
const separator = (body: string) => /^\r?\n/.exec(body)?.[0] ?? ''
const visibleBody = (record: RecordView | undefined) => (record ? record.body.slice(separator(record.body).length) : '')

// Estado de edição de um registro: rascunho, pendência, salvamento explícito (Ctrl+S) e conflito.
export function useRecordEditor<M extends Record<string, unknown>>(record: RecordView | undefined, label: string) {
  const { update, setDirty } = useAtlas()
  const [meta, setMeta] = useState<M | null>(record ? (record.metadata as unknown as M) : null)
  const [body, setBody] = useState(visibleBody(record))
  const [base, setBase] = useState<RecordView | undefined>(record)
  const [status, setStatus] = useState<'clean' | 'dirty' | 'saving' | 'error'>('clean')
  const [conflict, setConflict] = useState<{ external: string; mine: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Ao trocar de registro, ou quando o registro muda sem edição local, adota a versão persistida.
  useEffect(() => {
    if (!record) return
    if (record.id !== base?.id || (status === 'clean' && record.revision !== base?.revision)) {
      setBase(record); setMeta(record.metadata as unknown as M); setBody(visibleBody(record)); setStatus('clean'); setError(null)
    }
  }, [record, base, status])

  const bodyChanged = !!base && body !== visibleBody(base)
  const metaChanged = !!base && JSON.stringify(meta) !== JSON.stringify(base.metadata)
  const changed = bodyChanged || metaChanged

  useEffect(() => {
    if (status === 'saving') return
    if (changed && status === 'clean') setStatus('dirty')
    if (!changed && status === 'dirty') setStatus('clean')
  }, [changed, status])

  const save = useCallback(async (): Promise<boolean> => {
    if (!base || !meta || !changed) return true
    setStatus('saving')
    const result = await update(base, meta, bodyChanged ? (separator(base.body) || (base.body === '' && body ? '\n' : '')) + body : undefined)
    if ('code' in result) {
      const e = result as ApiError
      setStatus('error')
      setError(e.message)
      if (e.code === 'conflict') setConflict({ external: String(e.details?.external ?? ''), mine: body })
      return false
    }
    setBase(result); setMeta(result.metadata as unknown as M); setBody(visibleBody(result)); setStatus('clean'); setError(null)
    return true
  }, [base, meta, changed, bodyChanged, body, update])

  useEffect(() => {
    if (!record) return
    setDirty(`editor:${record.id}`, changed ? { label, save } : null)
    return () => setDirty(`editor:${record.id}`, null)
  }, [changed, save, label, record, setDirty])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); void save() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  const patch = useCallback((p: Partial<M>) => setMeta((m) => (m ? { ...m, ...p } : m)), [])
  const discard = useCallback(() => { if (base) { setMeta(base.metadata as unknown as M); setBody(visibleBody(base)); setStatus('clean'); setError(null) } }, [base])
  const adoptExternal = useCallback(async () => {
    if (!base) return
    const r = await window.atlas.refreshRecord(base.id)
    if (r.ok && r.value) { setBase(r.value); setMeta(r.value.metadata as unknown as M); setBody(visibleBody(r.value)); setStatus('clean'); setError(null) }
    setConflict(null)
  }, [base])

  return { meta, patch, body, setBody, status, error, save, discard, changed, conflict, setConflict, adoptExternal, base }
}

export function SaveBar({ editor }: { editor: { status: string; error: string | null; save: () => Promise<boolean>; discard: () => void; changed: boolean } }) {
  const text = editor.status === 'saving' ? 'Salvando…' : editor.status === 'error' ? `Não salvo: ${editor.error}` : editor.changed ? 'Alterações não salvas' : 'Salvo no disco'
  return (
    <div className="row">
      <span className={`save-state ${editor.status === 'error' ? 'error' : editor.changed ? 'dirty' : ''}`} role="status">{text}</span>
      {editor.changed && <Button kind="ghost" onClick={editor.discard}>Descartar</Button>}
      <Button kind="primary" disabled={!editor.changed || editor.status === 'saving'} onClick={() => void editor.save()} title="Ctrl+S">Salvar</Button>
    </div>
  )
}

export function ConflictDialog({ editor }: { editor: { conflict: { external: string; mine: string } | null; setConflict: (c: null) => void; adoptExternal: () => Promise<void> } }) {
  if (!editor.conflict) return null
  const { external, mine } = editor.conflict
  return (
    <Modal wide title="O arquivo mudou fora do aplicativo" onClose={() => editor.setConflict(null)} actions={<>
      <Button onClick={() => void navigator.clipboard.writeText(mine)}>Copiar meu texto</Button>
      <Button onClick={() => editor.setConflict(null)}>Manter no editor</Button>
      <Button kind="primary" onClick={() => void editor.adoptExternal()}>Usar a versão do disco</Button>
    </>}>
      <p>Nada foi sobrescrito. Compare as versões e escolha como continuar; sua edição continua no editor até você decidir.</p>
      <div className="compare">
        <div><h3>Versão no disco</h3><pre>{external}</pre></div>
        <div><h3>Seu texto (corpo)</h3><pre>{mine}</pre></div>
      </div>
    </Modal>
  )
}
