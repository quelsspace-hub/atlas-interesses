# Histórico de mudanças

## 2026-10-19 — V4: grafo de conhecimento

- D-030:
  - grafo somente leitura com links persistidos (contínuos, com seta) e relações derivadas (contexto, projeto, origem, tag, grupo, cada uma com tracejado próprio);
  - explicação de cada relação;
  - links quebrados visíveis;
  - foco e profundidade, limite de 150 nós com aviso;
  - lista equivalente;
  - “Ver no grafo” em itens e notas.
- Testes 166/166; E2E 12/12. Detalhes em IMPLEMENTATION_STATUS §38 e TEST_PLAN §25.

## 2026-10-19 — V3: mapa visual

- D-029:
  - mapa radial somente leitura e determinístico (hub, grupos, itens; item compartilhado uma vez, ligado a cada grupo);
  - zoom e pan por mouse e teclado;
  - filtros;
  - painel do nó;
  - retorno ao contexto (histórico e vista preservada);
  - alternativa em lista.
- Testes 163/163; E2E 11/11, com a verificação de que nenhum arquivo do vault muda ao usar o mapa. Detalhes em IMPLEMENTATION_STATUS §37 e TEST_PLAN §24.

## 2026-10-19 — V2: busca global e catálogo de fontes

- D-028:
  - busca no corpo e nos metadados, sem acento e sem caixa, com frase exata e exclusão;
  - filtros combináveis (tipo, status, tipo de nota, tags com OR, arquivados);
  - catálogo de fontes derivado das notas;
  - índice só em memória;
  - sem mudança de schema.
- Tela Busca e atalho Ctrl+K. Testes 160/160; E2E 10/10. Detalhes em IMPLEMENTATION_STATUS §36 e TEST_PLAN §23.

## 2026-10-19 — Aplicativo V1 (Electron) e decisões delegadas

- Decisões D-017 a D-027 tomadas por delegação da proprietária: stack Electron + React + TS; S-1 128:1; nomes reservados; Q-01 a Q-10. ADR-008 decidida.
- Novo `app/`:
  - núcleo da PoC adaptado e repositório V1;
  - transação recuperável da Inbox;
  - domínio puro;
  - sete telas, mais Configurações e backup;
  - E2E com playwright-core;
  - instalador NSIS;
  - job de CI.
- Verificado: 154/154 testes; 9/9 jornadas E2E, no build e no executável empacotado; metas da D-027 atendidas. Detalhes em IMPLEMENTATION_STATUS §35 e TEST_PLAN §22.
- README da raiz regravado em UTF-8: a linha final em UTF-16 do primeiro commit foi removida. AGENTS, guia do Cursor, contratos e rastreabilidade atualizados.

## 2026-10-19 — CI no GitHub Actions

- Novo `.github/workflows/ci.yml`: em PR, push na `main` e execução manual, roda `npm ci` e `npm test` em `poc/` num runner `windows-latest`. Casos pesados ficam fora. Sem mudança em código, contratos, manifestos ou lockfile.
- Registro em IMPLEMENTATION_STATUS §34 e `poc/README.md`. Resultado do primeiro run em IMPLEMENTATION_STATUS §34.
- O primeiro run revelou 11 testes sensíveis a `TEMP` com nome curto 8.3; os helpers de teste de exportação/restauração passaram a usar o caminho real. Sem mudança em `src/`.

## 2026-10-19 — AC-13: extração pelos componentes do Windows 11

- Retomada após o trabalho do CodeRabbit (§29–§32): `npm test` no Windows 11 com runtime pinado, 172/172. Cabeçalho do status corrigido de 152 para 172.
- Novo executor `poc/bench/ac13-windows.ts`: 12/12 extrações (clássico com nome não ASCII, ZIP64 forçado, 65.539 entradas, arquivo > 4 GiB) por `Expand-Archive`, `tar.exe` e `Shell.Application`, com hashes iguais ao manifesto. Dados em `poc/bench/results/ac13-windows-2026-10-19.jsonl`; TEST_PLAN §21, IMPLEMENTATION_STATUS §33.
- Pendente: abertura manual no Explorador. AC-13 completo, TC e gate V0 não aprovados. Código de produto, contratos e dependências inalterados.

## 2026-10-19 — S-1 explícito

- Política A aprovada (D-016); mecanismo opcional implementado sem instalar padrão numérico.
- 172/172 testes e 11/11 casos do candidato 128:1; recusas legítimas documentadas. AC-07 segue parcial.

## 2026-10-19 — F-2.v1 aprovado e experimento executado

- Gerador determinístico e executor F-2/F-3 com store/deflate 1/6/9, processos isolados e registros de memória/tempo/disco por fase. PNG/PDF reais e inventário com hashes de arquivos/corpos.
- Suíte ampliada: 164/164, código 0; 75/75 operações medidas, incluindo 15 recusas de corrupção antes da confirmação/destino. Dados e resumo em poc/bench/results; TEST_PLAN §19.
- Sobreposição de razões legítimas e de expansão comprovada; alternativas para S-1 submetidas em PROPOSTA_AC07_LIMITES §6. Contrato, exportador e dependências preservados. AC-07 completo e Windows continuam pendentes.

## 2026-10-19 — Proposta F-2.v1 para revisão

- Composição, reprodutibilidade, protocolo de medição e casos F-3 em PROPOSTA_F2_V1; classificação PROPOSTO, aguardando aprovação antes da geração.
- Risco de sobreposição entre razões legítimas e de expansão explicitado; nenhum S-1 decidido. Índice e controles atualizados; sem código, amostras ou novas medições.

## 2026-10-19 — AC-13 automático na PoC; compatibilidade Windows pendente

- Revisadas as opções ZIP64 já existentes; padrão Z-B preservado. Testes leves reforçam estruturas, bytes e recusa de corrupção; novos casos pesados provam promoção por contagem/tamanho, em execução explícita.
- Suíte principal: runtime 24.22.0, typecheck/build e 152/152 testes aprovados no Linux. EACCES/EPERM sintéticos e EACCES POSIX real exercitados. Ajustada a expectativa de caminho Windows na regressão Linux.
- Evidências e limitações em TEST_PLAN §17 e IMPLEMENTATION_STATUS §29; estados atualizados em VAULT_CONTRACT, OPEN_QUESTIONS e rastreabilidade; comandos em poc/README. Manifests/lockfiles e contratos de produto preservados. Extração Windows pendente; nenhum TC completo ou gate V0 aprovado.

## 2026-10-18 — Incremento 4 da PoC: limites da D-015 e AC-07

- **Código:** `poc/src/backup/manifest.ts`, `verify-archive.ts`, `inventory.ts`, `export.ts` e `restore.ts`: teto do manifesto, caracteres de controle, comprimento, segmento e profundidade de caminho, espaço livre na exportação e caminho absoluto no destino. A razão de compressão não foi implementada.
- **Testes:** novo `poc/test/backup-limits.test.ts`. `npm test`: 143 passaram, 0 falharam.
- **Registros:** TEST_PLAN §16 e nota no AC-07, IMPLEMENTATION_STATUS §28, estados do VAULT_CONTRACT §7.5 e da D-015, rastreabilidade e `poc/README.md`. Dependências e lockfiles não foram alterados.

## 2026-10-18 — Decisão D-015: valores de limite do AC-07

- **Decisão:** a proprietária aprovou a PROPOSTA_AC07_LIMITES com a alternativa B de caminho (1.024 caracteres). D-015 foi registrada em DECISIONS. A razão de compressão continua sem valor.
- **Contrato:** VAULT_CONTRACT §7.5 com os valores decididos e §7.2 item 7 e §7.7 item 2 com as referências e a recusa de U+0001–U+001F. As redações anteriores foram preservadas.
- **Documentos dependentes:** DATA_MODEL §2.1, ESPECIFICACAO_V1 F-07, TEST_PLAN AC-07, PROPOSTA_AC07_LIMITES, ADR-006, OPEN_QUESTIONS Q-05, rastreabilidade e IMPLEMENTATION_STATUS §27.
- Código e dependências não foram alterados; nada foi implementado.

## 2026-10-18 — Estados do contrato depois do AC-19 e proposta do AC-07

- **Contrato:** VAULT_CONTRACT §7.4 (estado do streaming) e §7.5 (linhas de estado dos valores, da capacidade e dos testes) atualizados com fatos de execução, com as redações anteriores preservadas. Nenhum requisito foi alterado.
- **Proposta:** novo `PROPOSTA_AC07_LIMITES.md` (PROPOSTO), com limites de segurança separados das verificações de capacidade, base, margens e lacunas. A razão de compressão ficou sem valor por falta de evidência.
- **Registros:** IMPLEMENTATION_STATUS §26, nota no AC-07 do TEST_PLAN, índice em `docs/README.md` e rastreabilidade. Código e dependências não foram alterados.

## 2026-10-18 — Incremento 3 da PoC: medições do AC-19

- **Código:** `poc/bench/` (gerador de fixtures, worker de medição e orquestrador); gancho opcional `phase` em `poc/src/backup/export.ts` e `restore.ts`, só para medição; `bench/**/*.ts` incluído em `poc/tsconfig.json`.
- **Medições:** três séries do AC-19, com 5 execuções por degrau e todas as 140 operações bem-sucedidas. Dados em `poc/bench/results/`. Nenhum limite fixado.
- **Testes:** `npm test`: 126 passaram, 0 falharam.
- **Registros:** TEST_PLAN §15 (e notas nos §10 e §12.2), IMPLEMENTATION_STATUS §25, rastreabilidade e `poc/README.md`. Dependências, lockfiles e contratos não foram alterados.

## 2026-10-18 — Incremento 2 da PoC: restauração em pasta nova

- **Código:** `poc/src/backup/restore.ts` (pré-validação, destino por caminho real, criação após confirmação, extração exclusiva em streaming com diário, validação de registros, relatório com quatro estados, remoção limitada ao diário e marcador mínimo) e extensões em `backup-fs.ts`, `verify-archive.ts`, `inventory.ts` e `errors.ts`.
- **Testes:** `poc/test/backup-restore.test.ts`. `npm test`: 126 passaram, 0 falharam.
- **Registros:** IMPLEMENTATION_STATUS §24, TEST_PLAN §14, rastreabilidade e `poc/README.md`. Dependências, lockfiles e contratos não foram alterados.

## 2026-10-18 — Fechamento das pendências do incremento 1

- **Contrato:** VAULT_CONTRACT §7.2 item 8 (nome reservado `manifest.json` na raiz) e DATA_MODEL §2.1 (`settings_version` 1, só na PoC), registrados como complementos em DECISIONS.
- **Código:** `poc/src/backup/inventory.ts`, com o nome reservado comparado sem caixa e com NFC, só na raiz.
- **Testes:** 13 novos em `poc/test/backup-export.test.ts`. `npm test`: 84 passaram, 0 falharam.
- **Registros:** TEST_PLAN §13, rastreabilidade, IMPLEMENTATION_STATUS §23.

## 2026-10-18 — Incremento 1 da PoC: exportação de backup

- **Código:** `poc/src/backup/` (manifesto M-B, inventário, validação simétrica, consistência C-A, releitura do ZIP, publicação sem sobrescrita) e ajuste em `poc/src/core/frontmatter.ts`.
- **Dependências:** `yauzl` 3.4.0, `yazl` 3.3.1, `@types/yauzl` 3.4.0, `@types/yazl` 3.3.1, versões exatas, com `poc/package.json` e `poc/package-lock.json` atualizados.
- **Testes:** `poc/test/backup-manifest.test.ts` e `poc/test/backup-export.test.ts`. `npm test`: 71 passaram, 0 falharam.
- **Documentação:** IMPLEMENTATION_STATUS §22, TEST_PLAN §13, REQUIREMENTS_TRACEABILITY e `poc/README.md`. Contratos e decisões não foram alterados.

## 2026-10-18 — Decisões e correções pós-auditoria do bloco 2

- Alteração somente documental, sem mudança de código.
- Emendas à D-013:
  - A-01: exportação simétrica à restauração; registros inválidos bloqueiam;
  - A-09: temporários `.tmp-{UUID}.md`;
  - A-10: versões não suportadas bloqueiam.
- Justificativa da D-014 registrada.
- Correções A-02 a A-16 no contrato, no modelo, na UX, na especificação, nos testes e na rastreabilidade.
- Arquivos alterados: DECISIONS, DATA_MODEL, VAULT_CONTRACT, ESPECIFICACAO_V1, UX_SPECIFICATION, ARCHITECTURE_DECISIONS, OPEN_QUESTIONS, TEST_PLAN, REQUIREMENTS_TRACEABILITY, PROPOSTA_BLOQUEIOS_Q05, IMPLEMENTATION_STATUS e CHANGELOG.
- Nenhum teste executado; todos os critérios PLANEJADOS; questões abertas continuam abertas.

## 2026-10-18 — Formalização documental do bloco 2 (DQ-03, DQ-10–DQ-25)

- Alteração somente documental, sem mudança de código.
- Nova D-014 (conteúdo canônico e configuração portátil; versão do schema derivada dos registros; `settings.yml` opcional com `settings_version`).
- Emendas à D-013:
  - destino criado pelo aplicativo;
  - limites classificados em segurança e capacidade, sem teto derivado de F-2;
  - nenhum cache dentro do vault.
- Complementos à D-013: streaming, relatório, abertura, diário com marcador mínimo, transações pendentes, ZIP temporário e arquivos de sistema.
- TEST_PLAN com AC-15 a AC-19 e extensões de AC-03 e AC-05, como PLANEJADOS; F-2 progressivo e F-3 em degraus.
- Q-01, Q-02, Q-04, Q-05, Q-07, Q-08, Q-10 e V0 continuam abertas. Nenhum teste executado.
- Arquivos alterados (lista completada em 18/10/2026, achado A-16): DECISIONS, DATA_MODEL, VAULT_CONTRACT, ESPECIFICACAO_V1, UX_SPECIFICATION, ARCHITECTURE_DECISIONS, OPEN_QUESTIONS, TEST_PLAN, REQUIREMENTS_TRACEABILITY, PROPOSTA_BLOQUEIOS_Q05, IMPLEMENTATION_STATUS, IMPLEMENTATION_ROADMAP e CHANGELOG.

## 2026-10-18 — Pré-condição de symlink satisfeita

- A proprietária habilitou o Modo de Desenvolvedor. Uma nova sonda criou symlinks sem elevação. A pré-condição de AC-09 (b) foi registrada como satisfeita; AC-09 não foi executado.

## 2026-10-18 — Formalização documental do bloco 1 (DQ-01–DQ-09)

- Alteração somente documental, sem mudança de código.
- Formalizados: plataforma prioritária de validação Windows 11 x64/NTFS; fixtures F-1/F-2/F-3; protocolo de medição; critérios de fixação de limites; ZIP64 Z-B; abordagem dos testes de symlink e de pontos de reparo.
- Emenda a D-013: categoria de limite “comprimento do caminho absoluto no destino” (DECISIONS e VAULT_CONTRACT §7.5).
- DQ-03 (estimativa de F-2) permanece pendente. Nenhum valor de limite aprovado; AC-13, AC-09 e AC-12 não executados.

## 2026-10-18 — Revisão de estado das DQ-01–DQ-25

- Verificado que nenhuma DQ foi respondida pela proprietária; nenhuma decisão formalizada e nenhum contrato alterado.
- Acrescentadas à proposta a matriz de estados (§9.2), a lista de mudanças previstas no TEST_PLAN (§9.3) e as emendas suspensas (§9.4).

## 2026-10-18 — Pacote de decisões para os bloqueios da Q-05

- Criado `docs/PROPOSTA_BLOQUEIOS_Q05.md` (não vinculante) com análise de Q-07, Q-10, Q-08 e Q-04, ambiente real observado e tabela única DQ-01–DQ-25.
- Registrados no status o ambiente observado e uma sonda exploratória de links e junções no Windows.
- Contratos, decisões, questões e plano de testes inalterados; nada instalado nem implementado.

## 2026-10-18 — Formalização parcial da Q-05

- Formalizadas as escolhas de backup da proprietária (D-013): manifesto M-B, exclusões E-C, consistência C-A, estrutura de limites L-C, links S-A, anexos opacos, validação e restauração como cópia independente.
- Atualizados juntos VAULT_CONTRACT §7, ADR-006, DECISIONS (D-013 e nota em P-04), OPEN_QUESTIONS Q-05, TEST_PLAN (TC-13–15 e AC-01–AC-14), REQ-008, status, roadmap e proposta. DATA_MODEL inalterado.
- Recomendada a biblioteca ZIP (yauzl + yazl; alternativa @zip.js/zip.js), sem instalação.
- Pendências mantidas: limites e ZIP64 (Q-07), configuração e anexos (Q-10), GUI (Q-08), destino após falha (Q-04/Q-08). Nada implementado ou executado.

## 2026-10-18 — Correção da ordem de operação de D-003

- Por decisão da proprietária, `calculateProjectProgress` na PoC passou a calcular `100 * done / eligible`, como na documentação oficial; oráculos fracionários alinhados. Suíte com 37 testes aprovados.
- Contrato D-003 inalterado; registros anteriores preservados como histórico.
- Preparada proposta técnica para decisão da Q-05, sem alterar especificação nem implementar backup.

## 2026-10-18 — Auditoria de continuidade e PoC D-001/D-008

- Reexecutada a suíte existente (29 testes) antes de editar; status e evidências confrontados com o código.
- Acrescentadas à PoC a regra pura D-001 e a criação de nova permanente em fixture, com origem preservada e backlink reconstruído; suíte final com 37 testes.
- Registradas divergências documentais (seções 9–11 do status e ordem de operação de D-003) em IMPLEMENTATION_STATUS §12, sem reescrever o histórico.
- Atualizados status, roadmap, plano de testes, rastreabilidade, checklist, README da PoC e linhas de estado. Contratos, decisões e questões em aberto não foram alterados.

## 2026-10-18 — Correção autorizada dos seis contratos

- Restaurado Item.status aos seis estados aprovados; canceled permanece apenas em Task.status.
- Limitadas Item.priority e Task.priority a low/medium/high, opcionais.
- Corrigidos Group.sort_order e Task.sort_order para inteiros obrigatórios.
- Corrigido InboxCapture.capture_kind para enum obrigatório de sete valores.
- Registradas P-02 e as partes divergentes de P-05 como superadas, sem apagar o histórico.
- Alinhados contratos, especificação, questões, roadmap, rastreabilidade e critérios de testes planejados.
- Exemplos YAML já compatíveis preservados; fontes originais e ZIP histórico mantidos integralmente.
- Correção documental: nenhum aplicativo, PoC ou cenário TC foi implementado ou executado nesta etapa.

## 2026-10-18 — Consolidação documental

- Reescritos os documentos ativos com fontes fornecidas pela proprietária.
- Corrigidos campos apagados, referências quebradas, instruções incompletas e declarações de testes inexistentes.
- Reconciliadas criação de permanente, links Markdown e regra do hub conforme recomendações aceitas.
- Acrescentados contrato de vault, especificação V1, arquitetura de arquivos e registro de reconciliação.
- Incluídos PDF oficial, tokens extraídos e 12 exemplos fictícios.
- Preservadas fontes anteriores em ZIP com inventário SHA-256.
- Criados README de entrada e convenções UTF-8/LF.
- Detalhes técnicos ainda não decididos identificados como propostas e perguntas explícitas.

Nenhuma implementação de PoC ou V1 foi criada nesta etapa. Gate técnico da V0 permanece aberto.
