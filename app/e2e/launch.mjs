// Utilitário E2E: inicia o aplicativo empacotado em dist/ com vault e dados do dispositivo isolados.
import { mkdtemp, realpath } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright-core'

export async function tempDir(prefix) {
  return realpath(await mkdtemp(join(tmpdir(), prefix)))
}

export async function launch({ vault, userData, trash }) {
  // ATLAS_E2E_EXE aponta para o executável empacotado (release/win-unpacked) em vez de 'electron .'.
  const exe = process.env.ATLAS_E2E_EXE
  const app = await electron.launch({
    ...(exe ? { executablePath: exe } : {}),
    args: exe ? [`--vault=${vault}`] : ['.', `--vault=${vault}`],
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, ATLAS_USER_DATA: userData, ELECTRON_ENABLE_LOGGING: '1', ...(trash ? { ATLAS_TRASH_DIR: trash } : {}) }
  })
  const page = await app.firstWindow()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.waitForLoadState('domcontentloaded')
  return { app, page, errors }
}
