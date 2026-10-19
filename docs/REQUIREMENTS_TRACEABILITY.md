# Rastreabilidade de requisitos

**Atualização:** 18/10/2026. A matriz liga requisito → decisão → especificação → cenário planejado. Nenhuma linha é evidência de software aprovado. IDs REQ-001–011 foram mantidos por tema; a revisão acrescenta requisitos explícitos para lacunas relevantes.

| ID | Requisito | Decisão | Fonte ativa | Testes planejados | Estado real |
| --- | --- | --- | --- | --- | --- |
| REQ-001 | Arquivos Markdown canônicos, índices reconstruíveis | D-011; D-014 | [DATA_MODEL.md](DATA_MODEL.md), §1–2 e §2.1 | TC-01, TC-07, TC-20; AC-01 | PoC: leitura de fixture e índice mínimo Tag/Group/Item reconstruído; sem índice de produto. Conjunto canônico (registros, `assets/`, `settings.yml` opcional) e caches fora do vault decididos em 18/10/2026 (D-014); não implementado |
| REQ-002 | UUID v4 imutável | D-005 | [DATA_MODEL.md](DATA_MODEL.md), §1 | TC-02, TC-03 | PoC: UUID estável após alteração/releitura e colisão local; cobertura parcial |
| REQ-003 | Grupo por OR e renomeação de Tag | D-004 | [ESPECIFICACAO_V1.md](ESPECIFICACAO_V1.md), §2 | TC-04 | PoC: OR, rename e reconstrução demonstrados em fixture; GUI não demonstrada |
| REQ-004 | Contexto de notas por tipo | D-001 | [DATA_MODEL.md](DATA_MODEL.md), §8 | TC-22 | PoC: regra pura D-001 em `poc/src/core/domain-rules.ts`; subcasos TC-22 executados; sem índice de Items/UI |
| REQ-005 | Corpo preservado em metadados | D-006 | [VAULT_CONTRACT.md](VAULT_CONTRACT.md), §2 | TC-06 | PoC: bytes e SHA-256 preservados em LF/CRLF; subcaso parcial |
| REQ-006 | Inbox recuperável com origem | D-002 | [VAULT_CONTRACT.md](VAULT_CONTRACT.md), §4 | TC-10, TC-11, TC-12 | Não implementado / não testado |
| REQ-007 | Progresso e nullability | D-003 | [ESPECIFICACAO_V1.md](ESPECIFICACAO_V1.md), §4 | TC-05, TC-18 | PoC: cálculo puro de tasks/null na ordem oficial `100 * done / eligible` (correção de 18/10/2026); semântica de archived_at e persistência não demonstradas |
| REQ-008 | Backup ZIP e restauração íntegra | D-007; D-013 (parcial, emendada); D-014; D-015 (valores de limite) | [VAULT_CONTRACT.md](VAULT_CONTRACT.md), §7 | TC-13, TC-14, TC-15, TC-21; AC-01–AC-19 ([TEST_PLAN](TEST_PLAN.md) §10) | Contrato parcialmente formalizado em 18/10/2026. Emenda DQ-06, critérios DQ-05 e ZIP64 Z-B (DQ-07) também em 18/10/2026. Bloco 2, também em 18/10/2026: D-014, classes de limite, streaming, destino criado pelo aplicativo, relatório, abertura, diário e marcador. Pendências: valores de segurança (medição), AC-13, visual da GUI (Q-08), mecanismo de recuperação da Inbox, prova nativa e execução de todos os AC. Redação anterior das pendências: “valores de limites (DQ-03 e medição), AC-13, Q-08, Q-10 e prova nativa”. **PoC (18/10/2026):** exportação implementada em `poc/src/backup/`; subcasos de AC-01, AC-03, AC-04, AC-05 e AC-10 executados ([TEST_PLAN](TEST_PLAN.md) §13). Restauração não implementada. **Incremento 2 (18/10/2026):** restauração em pasta nova em `poc/src/backup/restore.ts`; subcasos de AC-02, AC-06, AC-08, AC-14, AC-15, AC-16 e da parte de dados do AC-17 executados ([TEST_PLAN](TEST_PLAN.md) §14). **Incremento 3 (18/10/2026):** AC-19 medido na PoC Node, nas séries (i) a (iii); o critério da série (i) foi observado como atendido nesta máquina, com ressalva; TC-21 não aprovado ([TEST_PLAN](TEST_PLAN.md) §15). Estados do VAULT_CONTRACT §7.4 e §7.5 atualizados; proposta de valores do AC-07 em [PROPOSTA_AC07_LIMITES](PROPOSTA_AC07_LIMITES.md) (PROPOSTO, não aprovado). **D-015 (18/10/2026):** valores decididos com a alternativa B, exceto a razão de compressão; não implementados; AC-07 continua PLANEJADO. **Incremento 4 (18/10/2026):** limites implementados na PoC e AC-07 executado, sem a razão de compressão ([TEST_PLAN](TEST_PLAN.md) §16) |
| REQ-009 | Links, aliases e backlinks | D-009 | [VAULT_CONTRACT.md](VAULT_CONTRACT.md), §5 | TC-07, TC-08, TC-19 | PoC: links/backlinks locais reconstruídos em fixture; TC-07/08 parciais; move/reparo não implementados |
| REQ-010 | Hub conceitual central e navegação acessível | D-010 | [UX_SPECIFICATION.md](UX_SPECIFICATION.md), §1–6 | TC-23, TC-24 | Não implementado / não testado |
| REQ-011 | Design System fiel ao PDF | Referência visual | [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md), §1–6 | TC-23 | Não implementado / não testado |
| REQ-012 | Nova permanente preserva origem | D-008 | [ESPECIFICACAO_V1.md](ESPECIFICACAO_V1.md), §5 | TC-09 | PoC: `poc/src/core/permanent-note.ts` cria permanente em fixture, origem byte a byte intacta, backlink reconstruído; TC-09 parcial, sem GUI/restart |
| REQ-013 | Arquivamento e recuperação | Princípio oficial | [ESPECIFICACAO_V1.md](ESPECIFICACAO_V1.md), §2–4 | TC-18 | Não implementado / não testado |
| REQ-014 | Gravação real e conflito explícito | Integridade | [VAULT_CONTRACT.md](VAULT_CONTRACT.md), §3 | TC-16, TC-17 | PoC: conflito pré-rename e falhas locais; nativo/TC-17 não testado |
| REQ-015 | Compatibilidade de versão do schema | ADR-007 proposto; D-014 | [VAULT_CONTRACT.md](VAULT_CONTRACT.md), §8; [DATA_MODEL.md](DATA_MODEL.md), §1 e §2.1 | TC-01, TC-20; AC-02 | Desde 18/10/2026 (D-014): `schema_version` de cada registro é a única fonte; a versão exibida é derivada e pode ser mista; `settings_version` é só o formato do `settings.yml`. Congelamento (Q-01) e schema futuro (Q-10) abertos. Versão não suportada bloqueia exportação e restauração (A-10). Não implementado / não testado |
| REQ-016 | Viabilidade nativa da stack | ADR-008 candidata | [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md), §2 | TC-17, TC-21 | Plataforma prioritária de validação definida em 18/10/2026: Windows 11 x64/NTFS (DQ-01, [TEST_PLAN](TEST_PLAN.md) §12). Não implementado / não testado |
| REQ-017 | Jornadas locais completas | Escopo V1 | [ESPECIFICACAO_V1.md](ESPECIFICACAO_V1.md), §10 | TC-24 | Não implementado / não testado |

## Rastreabilidade da correção dos seis contratos

Os seis campos pertencem ao contrato de validação de REQ-001; sua conferência não aprova implementação. Fonte original exata em [SOURCES.md](SOURCES.md).

| Contrato confirmado | Fonte ativa | Cenário planejado | Estado |
| --- | --- | --- | --- |
| Item.status: seis estados canônicos | [DATA_MODEL.md](DATA_MODEL.md), §6; [ESPECIFICACAO_V1.md](ESPECIFICACAO_V1.md), F-02 | TC-01 | Documentação corrigida; software não implementado / cenário não executado |
| Item.priority: low/medium/high, opcional | [DATA_MODEL.md](DATA_MODEL.md), §6; [ESPECIFICACAO_V1.md](ESPECIFICACAO_V1.md), F-02 | TC-01 | Documentação corrigida; software não implementado / cenário não executado |
| Task.priority: low/medium/high, opcional | [DATA_MODEL.md](DATA_MODEL.md), §7; [ESPECIFICACAO_V1.md](ESPECIFICACAO_V1.md), F-03 | TC-01 | Documentação corrigida; software não implementado / cenário não executado |
| Task.sort_order: inteiro obrigatório | [DATA_MODEL.md](DATA_MODEL.md), §7; [ESPECIFICACAO_V1.md](ESPECIFICACAO_V1.md), F-03 | TC-01 | Documentação corrigida; software não implementado / cenário não executado |
| Group.sort_order: inteiro obrigatório | [DATA_MODEL.md](DATA_MODEL.md), §4; [ESPECIFICACAO_V1.md](ESPECIFICACAO_V1.md), F-01 | TC-01 | A PoC validou inteiro apenas no envelope reduzido; não validou Group completo nem schema V1 |
| InboxCapture.capture_kind: enum obrigatório | [DATA_MODEL.md](DATA_MODEL.md), §9; [ESPECIFICACAO_V1.md](ESPECIFICACAO_V1.md), F-05 | TC-01 | Documentação corrigida; software não implementado / cenário não executado |

## Evidência parcial da primeira PoC

Em 17/10/2026 (data do ambiente), a PoC delimitada de um registro cobriu subcasos de TC-01, TC-02, TC-03, TC-06 e TC-16. Typecheck/build passaram e 11 testes passaram; nenhum TC completo foi aprovado. TC-17 não foi executado. Comandos, hashes do corpo e limitações estão em [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) e instruções/regras em [poc/README.md](../poc/README.md).

## Evidência parcial das regras puras, antes da renomeação no disco

Na etapa anterior, a suíte executou 24 testes com typecheck/build aprovados. D-004 cobria então OR somente em memória. D-003 cobre cálculo de progresso por `project_id`/status e tarefas avulsas; seleção de `archived_at` permanece Q-03 e fora de TC-05.

## Evidência parcial de rename/reconstrução

Na etapa atual, a baseline de 24 testes foi reproduzida antes das alterações; após a implementação, `npm test` passou com typecheck/build e 26 testes. TC-04 cobre parcialmente OR em memória, renomeação isolada de Tag e reconstrução de índice derivado; a GUI não foi implementada nem testada. Corpo, UUID/caminho, bytes/hashes dos consumidores e referências foram conferidos. Nenhum TC completo está aprovado. Ver [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), [TEST_PLAN.md](TEST_PLAN.md) e [poc/README.md](../poc/README.md).

## Evidência parcial de links/backlinks

Em 18/10/2026, baseline de 26 testes foi reproduzida antes e depois de adicionar markdown-it `15.0.3`; `npm test` final passou com typecheck/build e 29 testes. TC-07 cobre parcialmente extração CommonMark, resolução de Notes por caminho/UUID, backlinks reconstruídos, classes ignoradas/diagnosticadas e ausência de mutações. TC-08 cobre títulos iguais por UUID/path e rename do título do destino sem alterar path, corpo ou backlink. Não há UI, restart de aplicativo, watcher, move/reparo ou Wikilinks. Ver [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md), [TEST_PLAN.md](TEST_PLAN.md) e [poc/README.md](../poc/README.md).

## Evidência parcial de D-001 e nova permanente

Em 18/10/2026, baseline de 29 testes reproduzida antes de editar; `npm test` final passou com typecheck/build e 37 testes. REQ-004 cobre a regra pura D-001 (TC-22 parcial). REQ-012 cobre criação de nova permanente a partir de work/reading com UUID novo, contexto null, origem sem alteração de bytes, link relativo para a origem e backlink reconstruído do disco (TC-09 parcial). Não há UI, editor, restart de aplicativo nem envelope completo. Ver [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) §12, [TEST_PLAN.md](TEST_PLAN.md) §8 e [poc/README.md](../poc/README.md).

## Correção da ordem de operação de D-003

Em 18/10/2026, por decisão da proprietária, `calculateProjectProgress` foi alinhado à fórmula oficial `100 * done / eligible`, com os oráculos fracionários correspondentes; `npm test` passou com 37 testes. O contrato D-003 não mudou. Ver [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) §13.

## Formalização parcial da Q-05

Em 18/10/2026 a proprietária formalizou as escolhas de backup (D-013): manifesto M-B, exclusões E-C, consistência C-A, estrutura de limites L-C, links S-A, anexos opacos, regras de validação e restauração como cópia independente. VAULT_CONTRACT §7, ADR-006, Q-05 e TEST_PLAN (TC-13–15 e AC-01–AC-14) foram atualizados juntos. DATA_MODEL não mudou, porque o manifesto de backup não é registro do vault e não altera campos nem pastas. Nenhum código de backup existe e nenhum critério foi executado.

## Bloco 1 da PROPOSTA_BLOQUEIOS_Q05

Em 18/10/2026 a proprietária aceitou DQ-01, DQ-02 e DQ-04 a DQ-09; DQ-03 permanece pendente. Registros: emenda de D-013 (DQ-06) em DECISIONS e VAULT_CONTRACT §7.5; critérios de limites (DQ-05) e ZIP64 Z-B (DQ-07) em VAULT_CONTRACT §7.5; plataforma, fixtures, protocolo de medição e testes de links (DQ-01, DQ-02, DQ-04, DQ-08, DQ-09) em TEST_PLAN §12. São decisões documentais: nenhuma fixture, medição, implementação ou teste foi executado, e nenhum critério recebeu PASS.

## Bloco 2 da PROPOSTA_BLOQUEIOS_Q05

Em 18/10/2026 a proprietária aceitou DQ-03 e DQ-10 a DQ-25, as cinco respostas da revisão do plano e as três da seção F.3. Registros:

- **D-014** (conteúdo canônico e configuração portátil) em DECISIONS e DATA_MODEL §1, §2.1 e §10.
- **Emendas e complementos da D-013** em DECISIONS e VAULT_CONTRACT §7:
  - destino criado pelo aplicativo;
  - classes de limite segurança × capacidade;
  - streaming;
  - relatório, abertura, diário e marcador.
- **F-2 progressivo e F-3 em degraus** em TEST_PLAN §12.2.
- **Critérios** AC-01 a AC-19 em TEST_PLAN §10 (AC-15 a AC-19 novos).
- **Fluxo de restauração** em UX §2 e ESPECIFICACAO_V1 F-07.

Requisito de streaming → AC-19 → TC-21 → status “não implementado”. São decisões documentais: nenhuma implementação, fixture, medição ou teste foi executado, e nenhum critério recebeu PASS.

## Correções pós-auditoria do bloco 2

Em 18/10/2026, depois da auditoria independente, a proprietária decidiu A-01 (exportação simétrica, com registros inválidos bloqueando), A-09 (temporários `.tmp-{UUID}.md`) e A-10 (versões não suportadas bloqueiam). Os achados A-02 a A-16 foram corrigidos em DECISIONS, DATA_MODEL, VAULT_CONTRACT, ESPECIFICACAO_V1, UX_SPECIFICATION, ARCHITECTURE_DECISIONS, OPEN_QUESTIONS e TEST_PLAN.

- As linhas TC-13 e TC-14 do TEST_PLAN §2 passaram a coincidir com a tabela de ligação do §10 (A-05).
- Extensões de AC-01, AC-04, AC-06, AC-07, AC-08, AC-10, AC-15, AC-16, AC-17 e AC-19, todas PLANEJADAS.

Nenhum critério foi executado.

## Incremento 1 da PoC: exportação

Em 18/10/2026, a exportação foi implementada na PoC com yauzl 3.4.0 e yazl 3.3.1: inventário, validação simétrica, manifesto M-B, consistência C-A, releitura do ZIP e publicação sem sobrescrita. `npm test`: 71 testes passaram. Execução e limites em [TEST_PLAN §13](TEST_PLAN.md) e [IMPLEMENTATION_STATUS §22](IMPLEMENTATION_STATUS.md). No fechamento das pendências (status §23), o nome reservado (VAULT_CONTRACT §7.2 item 8) e o `settings_version` 1 (DATA_MODEL §2.1) foram formalizados e testados: 84 testes passaram.

## Manutenção

Ao implementar, adicionar caminho do código, revisão e evidência da execução. Quando um requisito muda, revisar todos os cenários associados. REQ-010/011 não recebem PASS apenas por existência de documentação: dependem de protótipo/app e avaliação. Os cenários estão definidos no [TEST_PLAN.md](TEST_PLAN.md).
