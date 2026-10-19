import { useState } from 'react'
import type { ConflictDetail, ExportPreview, RestoreOutcome, RestorePreview, ThemePreference } from '../../shared/api.js'
import { errorText, useAtlas } from '../state.js'
import { Button, Modal, SelectField, TextField } from '../ui.js'

const bytes = (n: number) => (n < 1024 ? `${n} B` : n < 1024 ** 2 ? `${(n / 1024).toFixed(1)} KB` : n < 1024 ** 3 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${(n / 1024 ** 3).toFixed(2)} GB`)
const stateLabel: Record<RestoreOutcome['state'], string> = { verified: 'Verificado', 'verified-with-warnings': 'Verificado com avisos', failed: 'Falhou', interrupted: 'Interrompido' }

export function SettingsScreen() {
  const { app, setApp, snapshot, run, reload, confirmDiscard, toast } = useAtlas()
  const [exportPreview, setExportPreview] = useState<ExportPreview | null>(null)
  const [restore, setRestore] = useState<RestorePreview | null>(null)
  if (!snapshot) return null
  const versions = snapshot.schemaVersions
  const toastLast = (last: { ok: boolean; message: string } | null) => { if (last) toast(last.ok ? `Backup automático verificado. ${last.message}` : `Backup automático falhou: ${last.message}`, last.ok ? 'info' : 'error') }
  const setTheme = async (theme: ThemePreference) => { const s = await run(window.atlas.setTheme(theme)); if (s) setApp(s) }
  const switchVault = () => confirmDiscard(async () => { const s = await run(window.atlas.closeVault()); if (s) setApp(s) })

  return (
    <div className="page">
      <div className="page-head"><div><h1>Configurações e backup</h1></div></div>
      <section className="card stack-m" aria-labelledby="vault-h">
        <h2 id="vault-h">Vault</h2>
        <div className="stack" style={{ gap: 4 }}>
          <span><strong>Local:</strong> {snapshot.path}</span>
          <span><strong>Versão do schema dos registros:</strong> {versions.length === 0 ? 'sem registros' : versions.join(', ')}{versions.length > 1 ? ' (versões mistas — veja diagnóstico)' : ''}</span>
          <span><strong>Registros válidos:</strong> {snapshot.records.length}</span>
        </div>
        <div className="row">
          <Button onClick={() => void run(window.atlas.revealPath(snapshot.path))}>Mostrar pasta</Button>
          <Button onClick={() => void reload()}>Reler o vault do disco</Button>
          <Button onClick={switchVault}>Trocar de vault</Button>
        </div>
      </section>

      <section className="card stack-m" aria-labelledby="pref-h">
        <h2 id="pref-h">Preferências deste dispositivo</h2>
        <div style={{ maxWidth: 320 }}>
          <SelectField label="Tema" value={app.theme} options={[['system', 'Seguir o sistema'], ['light', 'Claro'], ['dark', 'Escuro']] as const} onChange={(v) => v && void setTheme(v)} help="Preferência do dispositivo; não entra no vault nem no backup." />
        </div>
      </section>

      <section className="card stack-m" aria-labelledby="backup-h">
        <h2 id="backup-h">Backup</h2>
        <p className="muted">Exporta um ZIP com manifesto e hashes SHA-256, fora do vault. Restaurar sempre cria uma pasta nova: o vault atual não é alterado.</p>
        <div className="row">
          <Button kind="primary" onClick={async () => { const p = await run(window.atlas.previewExport()); if (p) setExportPreview(p) }}>Exportar backup…</Button>
          <Button onClick={async () => { const p = await run(window.atlas.chooseRestoreArchive()); if (p) setRestore(p) }}>Restaurar backup…</Button>
        </div>
      </section>

      <section className="card stack-m" aria-labelledby="auto-h">
        <h2 id="auto-h">Backup automático</h2>
        <p className="muted">Uma vez por dia, ao abrir o vault ou com o aplicativo aberto, grava um backup verificado (o mesmo da exportação) numa pasta fora do vault. Arquivos fora do formato do Atlas são incluídos; arquivos de sistema (Thumbs.db, desktop.ini) não. Os automáticos mais antigos além do limite vão para a Lixeira.</p>
        <label className="checkbox"><input type="checkbox" checked={app.autoBackup.enabled} disabled={!app.autoBackup.folder} onChange={async (e) => { const s = await run(window.atlas.setAutoBackup({ enabled: e.target.checked })); if (s) setApp(s) }} />Ativar backup automático</label>
        <div className="row" style={{ alignItems: 'end' }}>
          <div style={{ flex: 1 }}><TextField label="Pasta dos backups" value={app.autoBackup.folder ?? ''} onChange={() => undefined} help="Fora do vault. Pode ser um disco externo ou outra pasta sincronizada." /></div>
          <Button onClick={async () => { const s = await run(window.atlas.chooseAutoBackupFolder()); if (s) setApp(s) }}>Escolher…</Button>
        </div>
        <div style={{ maxWidth: 220 }}>
          <TextField label="Quantos manter" type="number" value={String(app.autoBackup.keep)} onChange={async (v) => { const n = Math.trunc(Number(v)); if (n >= 1 && n <= 100) { const s = await run(window.atlas.setAutoBackup({ keep: n })); if (s) setApp(s) } }} />
        </div>
        <div className="row">
          <Button disabled={!app.autoBackup.folder} onClick={async () => { const s = await run(window.atlas.runAutoBackupNow()); if (s) { setApp(s); toastLast(s.autoBackup.last) } }}>Fazer backup agora</Button>
          {app.autoBackup.last && (
            <span className={`body-s ${app.autoBackup.last.ok ? 'muted' : ''}`} style={app.autoBackup.last.ok ? undefined : { color: 'var(--danger)' }} role="status">
              Último: {new Date(app.autoBackup.last.at).toLocaleString('pt-BR')} — {app.autoBackup.last.ok ? 'verificado' : 'falhou'}. {app.autoBackup.last.message}
            </span>
          )}
        </div>
      </section>

      <section className="card stack-m" aria-labelledby="sync-h">
        <h2 id="sync-h">Sincronização</h2>
        <p className="muted">O Atlas não envia dados a servidores. Para usar o vault em vários aparelhos, coloque a pasta do vault numa pasta sincronizada (OneDrive, Dropbox, Google Drive ou Syncthing). Mudanças que chegam pela sincronização são lidas automaticamente; quando dois aparelhos editam o mesmo registro, o provedor cria uma cópia de conflito, que aparece no Diagnóstico para você escolher a versão.</p>
        <p><strong>Pasta atual:</strong> {app.syncProvider ? `dentro de ${app.syncProvider}` : 'nenhum provedor reconhecido pelo caminho (qualquer pasta sincronizada funciona)'}.</p>
      </section>

      <Diagnostics />
      <p className="muted body-s">Atlas de Interesses {app.version}</p>
      {exportPreview && <ExportDialog preview={exportPreview} onClose={() => setExportPreview(null)} />}
      {restore && <RestoreDialog preview={restore} onClose={() => setRestore(null)} />}
    </div>
  )
}

function Diagnostics() {
  const { snapshot, index, run } = useAtlas()
  const [conflict, setConflict] = useState<ConflictDetail | null>(null)
  if (!snapshot || !index) return null
  const warnings = snapshot.records.filter((r) => r.problems.length > 0)
  const empty = snapshot.invalid.length === 0 && snapshot.temporaries.length === 0 && snapshot.transactions.length === 0 && snapshot.recovery.length === 0 && warnings.length === 0 && snapshot.conflicts.length === 0
  return (
    <section className="card stack-m" aria-labelledby="diag-h">
      <h2 id="diag-h">Diagnóstico</h2>
      {empty && <p className="muted">Nenhum problema encontrado na última leitura.</p>}
      {snapshot.conflicts.length > 0 && (
        <div className="stack" aria-label="Conflitos de sincronização" role="region">
          <h3>Conflitos de sincronização ({snapshot.conflicts.length})</h3>
          <p className="muted body-s">Cópias criadas pelo provedor quando dois aparelhos editaram o mesmo registro. Compare e escolha; a versão descartada vai para a Lixeira.</p>
          {snapshot.conflicts.map((c) => {
            const record = index.byId.get(c.recordId)
            return (
              <div key={c.path} className="list-row">
                <div className="grow"><strong>{record ? String(record.metadata.title ?? c.recordId) : 'Registro ausente'}</strong><div className="body-s muted"><code>{c.path}</code></div></div>
                <Button small onClick={async () => { const d = await run(window.atlas.getConflict(c.path)); if (d) setConflict(d) }}>Comparar e resolver</Button>
              </div>
            )
          })}
        </div>
      )}
      {conflict && <ConflictResolveDialog conflict={conflict} onClose={() => setConflict(null)} />}
      {snapshot.recovery.map((r) => <div key={r.manifest} className={`banner ${r.outcome === 'blocked' ? 'danger' : ''}`}>Conversão da Inbox ({r.manifest}): {r.message}</div>)}
      {snapshot.invalid.length > 0 && (
        <div className="stack">
          <h3>Arquivos inválidos ({snapshot.invalid.length})</h3>
          <p className="muted body-s">Não são exibidos nem regravados e bloqueiam a exportação até serem corrigidos fora do aplicativo.</p>
          {snapshot.invalid.map((f) => <div key={f.path} className="list-row"><div className="grow"><code>{f.path}</code><div className="body-s muted">{f.problems.map((p) => p.message).join('; ')}</div></div><Button small onClick={() => void window.atlas.revealPath(`${snapshot.path}/${f.path}`)}>Mostrar</Button></div>)}
        </div>
      )}
      {warnings.length > 0 && (
        <div className="stack">
          <h3>Avisos de coerência ({warnings.length})</h3>
          {warnings.slice(0, 50).map((r) => <div key={r.id} className="list-row"><div className="grow"><strong>{String(r.metadata.title ?? r.id)}</strong> <code className="body-s">{r.path}</code><div className="body-s muted">{r.problems.map((p) => p.message).join('; ')}</div></div></div>)}
        </div>
      )}
      {snapshot.temporaries.length > 0 && (
        <div className="stack">
          <h3>Temporários encontrados ({snapshot.temporaries.length})</h3>
          <p className="muted body-s">Podem ser restos de uma gravação interrompida. Nunca são apagados automaticamente; confira o conteúdo antes de removê-los manualmente.</p>
          {snapshot.temporaries.map((t) => <code key={t} className="body-s">{t}</code>)}
        </div>
      )}
    </section>
  )
}

function ExportDialog({ preview, onClose }: { preview: ExportPreview; onClose: () => void }) {
  const { run, toast } = useAtlas()
  const [decisions, setDecisions] = useState<Record<string, 'include' | 'exclude'>>(Object.fromEntries(preview.nonCanonical.map((p) => [p, 'include' as const])))
  const [systemFiles, setSystemFiles] = useState<'include' | 'exclude'>('exclude')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ archivePath: string; fileCount: number; sha256: string } | null>(null)
  const blocked = preview.blockers.length > 0
  const submit = async () => {
    setBusy(true)
    const r = await run(window.atlas.runExport({ nonCanonical: decisions, systemFiles }))
    setBusy(false)
    if (r) { setDone(r); toast('Backup gravado e verificado.') }
  }
  if (done) {
    return (
      <Modal title="Backup concluído" onClose={onClose} actions={<><Button onClick={() => void window.atlas.revealPath(done.archivePath)}>Mostrar arquivo</Button><Button kind="primary" onClick={onClose}>Fechar</Button></>}>
        <p>Backup gravado, relido e verificado: {done.fileCount} arquivo(s).</p>
        <code className="body-s">{done.archivePath}</code>
        <span className="body-s muted">SHA-256 do ZIP: {done.sha256}</span>
      </Modal>
    )
  }
  return (
    <Modal wide title="Exportar backup" onClose={onClose} actions={<><Button onClick={onClose}>Cancelar</Button><Button kind="primary" disabled={blocked || busy} onClick={() => void submit()}>{busy ? 'Exportando e verificando…' : 'Escolher destino e exportar'}</Button></>}>
      <p>{preview.canonicalCount} arquivo(s) canônico(s), {bytes(preview.totalBytes)}.</p>
      {blocked && (
        <div className="banner danger" role="alert">
          <strong>Exportação bloqueada.</strong> Corrija estes itens e tente de novo:
          <ul>{preview.blockers.map((b, i) => <li key={i}><code>{b.path || '(vault)'}</code>: {b.message}</li>)}</ul>
        </div>
      )}
      {preview.nonCanonical.length > 0 && (
        <div className="stack">
          <h3>Arquivos fora do formato do Atlas</h3>
          <p className="muted body-s">Decida explicitamente: nada é omitido em silêncio.</p>
          {preview.nonCanonical.map((p) => (
            <div key={p} className="list-row">
              <code className="grow body-s">{p}</code>
              <select className="input" style={{ width: 140 }} aria-label={`Decisão para ${p}`} value={decisions[p]} onChange={(e) => setDecisions((d) => ({ ...d, [p]: e.target.value as 'include' | 'exclude' }))}>
                <option value="include">Incluir</option><option value="exclude">Excluir</option>
              </select>
            </div>
          ))}
        </div>
      )}
      {preview.systemFiles.length > 0 && (
        <SelectField label={`Arquivos de sistema (${preview.systemFiles.length}: ${preview.systemFiles.slice(0, 3).join(', ')}${preview.systemFiles.length > 3 ? '…' : ''})`} value={systemFiles} options={[['exclude', 'Excluir'], ['include', 'Incluir']] as const} onChange={(v) => setSystemFiles((v || 'exclude') as 'include' | 'exclude')} />
      )}
    </Modal>
  )
}

function RestoreDialog({ preview, onClose }: { preview: RestorePreview; onClose: () => void }) {
  const { run, setApp, confirmDiscard } = useAtlas()
  const [parent, setParent] = useState<string | null>(null)
  const [name, setName] = useState(`Atlas restaurado ${new Date().toISOString().slice(0, 10)}`)
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<RestoreOutcome | null>(null)
  const submit = async () => {
    if (!parent) return
    setBusy(true)
    const r = await run(window.atlas.runRestore(preview.archivePath, parent, name.trim()))
    setBusy(false)
    if (r) setOutcome(r)
  }
  if (outcome) {
    return (
      <Modal wide title={`Restauração: ${stateLabel[outcome.state]}`} onClose={onClose} actions={<>
        {outcome.destination && <Button onClick={() => void window.atlas.revealPath(outcome.destination!)}>Mostrar pasta</Button>}
        {outcome.canOpen && outcome.destination && <Button kind="primary" onClick={() => confirmDiscard(async () => { const s = await run(window.atlas.openRestoredVault(outcome.destination!)); if (s) { setApp(s); onClose() } })}>Abrir vault restaurado</Button>}
        <Button onClick={onClose}>Fechar</Button>
      </>}>
        <p><strong>{outcome.notice}</strong></p>
        <p>{outcome.counts.verified}/{outcome.counts.expected} arquivo(s) verificados por hash.</p>
        {outcome.destination && <code className="body-s">{outcome.destination}</code>}
        {outcome.messages.length > 0 && <ul className="body-s">{outcome.messages.slice(0, 30).map((m, i) => <li key={i}>{m}</li>)}</ul>}
      </Modal>
    )
  }
  return (
    <Modal wide title="Restaurar backup" onClose={onClose} actions={<><Button onClick={onClose}>Cancelar</Button><Button kind="primary" disabled={!parent || !name.trim() || busy} onClick={() => void submit()}>{busy ? 'Restaurando e verificando…' : 'Confirmar restauração'}</Button></>}>
      <div className="card stack" style={{ gap: 4 }}>
        <span><strong>Arquivo:</strong> {preview.archivePath}</span>
        <span><strong>Criado em:</strong> {new Date(preview.createdAt).toLocaleString('pt-BR')} · manifesto v{preview.manifestVersion}</span>
        <span><strong>Conteúdo:</strong> {preview.fileCount} arquivo(s), {bytes(preview.totalBytes)}</span>
        <span className="body-s muted">{Object.entries(preview.byFolder).map(([k, v]) => `${k}: ${v}`).join(' · ')}</span>
      </div>
      <div className="row" style={{ alignItems: 'end' }}>
        <div style={{ flex: 1 }}><TextField label="Pasta onde a cópia será criada" value={parent ?? ''} onChange={() => undefined} help="O aplicativo cria uma pasta nova dentro dela; nada existente é substituído. Ela não pode conter o vault atual nem estar dentro dele." /></div>
        <Button onClick={async () => { const p = await run(window.atlas.chooseRestoreParent()); if (p) setParent(p) }}>Escolher…</Button>
      </div>
      <TextField label="Nome da nova pasta" required value={name} onChange={setName} />
      <p><strong>O vault atual não será alterado.</strong></p>
    </Modal>
  )
}

function ConflictResolveDialog({ conflict, onClose }: { conflict: ConflictDetail; onClose: () => void }) {
  const { reload, toast } = useAtlas()
  const [busy, setBusy] = useState(false)
  const resolve = async (choice: 'keep-current' | 'use-copy') => {
    setBusy(true)
    const r = await window.atlas.resolveConflict(conflict.path, choice, conflict.currentRevision)
    setBusy(false)
    if (!r.ok) { toast(errorText(r.error), 'error'); return }
    toast(choice === 'keep-current' ? 'Versão atual mantida; a cópia foi para a Lixeira.' : 'Cópia adotada; a versão anterior foi para a Lixeira.')
    await reload()
    onClose()
  }
  return (
    <Modal wide title="Conflito de sincronização" onClose={onClose} actions={<>
      <Button onClick={onClose}>Decidir depois</Button>
      <Button disabled={busy || conflict.copyProblems.length > 0} onClick={() => void resolve('use-copy')}>Usar a cópia</Button>
      <Button kind="primary" disabled={busy} onClick={() => void resolve('keep-current')}>Manter a versão atual</Button>
    </>}>
      <p>Nada é apagado: a versão que você não escolher vai para a Lixeira do sistema. Se a versão atual mudar antes de confirmar, a troca é recusada.</p>
      {conflict.copyProblems.length > 0 && <div className="banner danger">A cópia não é um registro válido e não pode ser adotada: {conflict.copyProblems.join('; ')}</div>}
      <div className="compare">
        <div><h3>Versão atual</h3><code className="body-s">{conflict.recordPath}</code><pre>{conflict.currentText ?? '(registro ausente)'}</pre></div>
        <div><h3>Cópia de conflito</h3><code className="body-s">{conflict.path}</code><pre>{conflict.copyText}</pre></div>
      </div>
    </Modal>
  )
}
