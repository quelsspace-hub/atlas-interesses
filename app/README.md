# Aplicativo Atlas de Interesses (V1)

Aplicativo desktop para Windows 11 x64 (D-017: Electron + React + TypeScript). O vault é uma pasta de arquivos Markdown/YAML, que é a fonte de verdade (D-011). Índices são reconstruídos do disco a cada abertura e nunca ficam dentro do vault.

## Estrutura

| Pasta | Conteúdo |
| --- | --- |
| `src/domain/` | Modelo V1, validação, OR de tags, progresso, links e backlinks. Puro, usado pelo processo principal e pela interface |
| `src/vault/` | Persistência e backup. `core/`, `adapters/` e `backup/` vêm da PoC (`poc/src`, commit `2dc0726`), com as mudanças descritas em [IMPLEMENTATION_STATUS §35](../docs/IMPLEMENTATION_STATUS.md); `repository.ts`, `inbox.ts` e `serialize.ts` são novos |
| `src/main/` | Processo principal do Electron: janela, diálogos nativos, IPC e preferências do dispositivo |
| `src/preload/` | Ponte IPC mínima e tipada (`window.atlas`); o renderer roda com `contextIsolation` e `sandbox` |
| `src/renderer/` | Interface React: sete telas mais Configurações (D-025), tokens do Design System (D-026) |
| `test/` | Testes `node:test`: suítes de backup herdadas da PoC, domínio, repositório, Inbox, D-019, serviço e desempenho |
| `e2e/` | Jornadas no aplicativo real, via `playwright-core` |

## Comandos

Em `app/`:

```powershell
npm ci                 # dependências exatas do lockfile (o postinstall baixa o binário do Electron)
npm test               # runtime, typecheck, compilação e testes
npm start              # build e abre o aplicativo
npm run e2e            # build e jornadas E2E no Electron, com vault e dados temporários
npm run dist           # build e instalador NSIS em release/ (sem assinatura de código)
```

Para rodar o E2E no executável empacotado, defina `ATLAS_E2E_EXE` com o caminho de `release\win-unpacked\Atlas de Interesses.exe`.

Para abrir um vault direto ao iniciar, use `--vault=<pasta>`. `ATLAS_TRASH_DIR=<pasta>` desvia a Lixeira para uma pasta comum (testes); sem ela, o que o app remove vai para a Lixeira do Windows. `ATLAS_USER_DATA=<pasta>` isola as preferências do dispositivo; os testes usam essa variável.

## Ambiente verificado

Windows 11 Pro build 26200, x64, NTFS. Electron `44.9.0`, que embute Node `24.22.0` e Chromium `152.0.7977.167`. Os testes rodam no Node `24.22.0` de `node-win-x64`. npm `10.8.2`, com `legacy-peer-deps` em `.npmrc` por causa de uma falha do npm 10.8.2 ao resolver peers opcionais.

As versões exatas estão em `package.json` e `package-lock.json`. Resultados em [TEST_PLAN §22](../docs/TEST_PLAN.md).

## Dados e privacidade

- **Vault:** só a pasta escolhida.
- **Preferências do dispositivo:** vault ativo, recentes e tema ficam em `%APPDATA%\atlas-de-interesses\device-settings.json`.
- **Restauração:** diários e marcadores ficam na mesma pasta de dados do aplicativo.
- **Rede:** nenhuma conexão. Links externos só abrem por ação explícita, e apenas `http`, `https` e `mailto`.
