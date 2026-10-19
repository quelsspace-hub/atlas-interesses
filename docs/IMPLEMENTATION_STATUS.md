# Status real do Atlas

**Atualização registrada:** 19/10/2026 · **Execução mais recente:** 19/10/2026 no Windows 11 (§35, aplicativo V1) · **Etapa:** PoC local parcial, incluindo backup/restauração, limites D-015 e validação automática de ZIP64 (AC-13; §29) e extração pelos componentes do Windows 11 (§33).

## 1. Situação

**Estado atual (§38):** V4 (grafo de conhecimento, D-030) implementada; testes 166/166 e E2E 12/12. **Antes (§37):** V3 (mapa visual, D-029) implementada; testes 163/163 e E2E 11/11. **Antes (§36):** V2 (busca global e catálogo de fontes, D-028) implementada; testes 160/160 e E2E 10/10. **Antes (§35):** aplicativo V1 em `app/` (D-017), com testes 154/154, jornadas E2E 9/9 no executável empacotado e instalador NSIS gerado; decisões delegadas D-017 a D-027. *Antes:* suíte principal da PoC com 172/172 testes aprovados no Windows 11 (§33). AC-13: parte automática (§29) e extração por `Expand-Archive`, `tar.exe` e `Shell.Application` verificadas (§33); falta a abertura manual no Explorador. *Redação anterior: 152/152; aceite do AC-13 dependia da extração no Windows 11.*

O estado registrado na consolidação de 18/10/2026 é preservado como proveniência. PoCs delimitadas executadas nos ambientes de 17–18/10 cobrem persistência de um registro, regras D-003/D-004, renomeação de Tag, reconstrução de backlinks, regra pura D-001 e criação de nova permanente em fixture (seção 12). Os recortes não representam entidades completas ou schema V1. Isso não conclui V0, não implementa o aplicativo e não aprova a stack. Tauri 2 + React + TypeScript continua candidata.

## 2. Entregas disponíveis

| Entrega | Estado |
| --- | --- |
| Documentação oficial, modelo, regras e guia do Cursor | Reescritos e aprofundados |
| Contratos de vault, especificação funcional e arquitetura de arquivos | Documentados; propostas técnicas identificadas |
| Testes da PoC | Implementados e executados; suíte completa do produto V1 ainda não implementada |
| PDF e tokens visuais | Fonte incluída e valores extraídos |
| Vault fictício | 12 exemplos documentais, sem aplicativo |
| Fontes anteriores | 28 entradas preservadas no ZIP com hashes |
| PoC de persistência, domínio, Tag e links/backlinks | Implementados e executados; subcasos de TC-01–08 e TC-16, sem TC completo aprovado |
| PoC de contexto D-001 e nova permanente D-008 | Implementados e executados; subcasos de TC-09 e TC-22, sem TC completo aprovado |
| Aplicativo V1 / testes automatizados da V1 | Não implementados |
| GUI / build / instalador / validação nativa | Não existentes |

## 3. Validação documental registrada na consolidação de 18/10

- Leitura UTF-8 dos arquivos iniciais e anexos: verificada nas etapas de inspeção.
- PDF: quatro páginas extraídas, renderizadas e conferidas; cores extraídas das amostras vetoriais.
- Conferência documental executada: UTF-8/LF, estrutura Markdown, links internos existentes e JSON legível.
- Doze exemplos YAML conferidos: UUIDs válidos/únicos, nomes de arquivo, datas, referências e regras condicionais; exemplo de OR em dois grupos e progresso de 50%.
- Vinte e oito fontes históricas conferidas byte a byte com o checkout inicial/anexos; manifesto e CRC do ZIP íntegros.
- Dezoito valores de cor conferidos contra o PDF. Contraste Dark on-primary/primary medido em 3,48:1: revisão de uso pendente em Q-09.
- Essas verificações avaliam documentos e fixtures; não equivalem à execução de casos TC do futuro aplicativo.
- Naquela entrega, testes de software, builds e provas nativas não foram executados; a evidência posterior desta PoC está nas seções 7–8.

Registros antigos de PoC “13/13 PASS”, “11 aprovados + 2 parciais” e V0 encerrada não são evidência válida. Foram preservados apenas como fonte histórica.

## 4. Pendências

As seis regras auditadas estão confirmadas e não são pendências: Item.status com seis estados; Item.priority e Task.priority opcionais com low/medium/high; Group.sort_order e Task.sort_order inteiros obrigatórios; InboxCapture.capture_kind obrigatório com os sete valores originais. Permanecem apenas as demais propostas de Q-01–Q-10, incluindo defaults não decididos, conteúdo/destinos da Inbox, tarefas arquivadas, falhas, backup, plataforma e UX. Nenhuma delas foi resolvida nesta correção.

## 5. Próximo passo

**Atualização (§35, 19/10/2026):** V1 implementada em `app/`. O que resta está no §35, em “Pendente”. **Atualização (§33, 19/10/2026):** extração Windows automatizada concluída (12/12); restam a abertura manual no Explorador e as decisões listadas no §33. **Atualização anterior de 19/10/2026:** concluir a comprovação de compatibilidade ZIP64 no Windows 11 (§29). Em seguida, propor a composição F-2.v1 para aprovação, medir amostras legítimas comprimíveis e F-3 maliciosas, e submeter o valor S-1 antes de implementar a razão de compressão do AC-07. Inbox depende de Q-01/Q-02/Q-04; nenhuma mudança estrutural dessa etapa foi iniciada. Os parágrafos abaixo preservam a sequência histórica.

Aguardar a revisão da proprietária desta etapa delimitada. Nenhuma etapa adicional, integração nativa ou implementação do aplicativo está autorizada por esta entrega.

Recomendação técnica registrada na seção 12, sujeita a autorização: decidir a ordem de operação de D-003 (divergência 3 da seção 12.4) e, em seguida, fechar Q-05 para viabilizar a prova de backup/restauração, exigida pelo gate V0. Inbox depende de Q-02 e Q-04.

**Atualização (seções 13–14):** D-003 foi alinhada à fórmula oficial. A proposta para decidir a Q-05 está em [PROPOSTA_Q05_BACKUP](PROPOSTA_Q05_BACKUP.md), aguardando escolhas da proprietária (§6 da proposta). Backup não implementado; nenhuma especificação alterada.

**Atualização (seção 15):** as escolhas da Q-05 foram formalizadas parcialmente (D-013, VAULT_CONTRACT §7). Próximo passo recomendado: resolver as pendências de Q-07, Q-10, Q-08 e Q-04 e de ZIP64 listadas na seção 15 e, após autorização, instalar a biblioteca ZIP e implementar e validar a PoC de backup e restauração contra AC-01–AC-14.

**Atualização (seção 16):** o pacote de decisões para os bloqueios está em [PROPOSTA_BLOQUEIOS_Q05](PROPOSTA_BLOQUEIOS_Q05.md) §7 (DQ-01–DQ-25), aguardando respostas da proprietária. **Revisão (seção 17):** nenhuma DQ aprovada; a matriz de estados está em PROPOSTA_BLOQUEIOS_Q05 §9. **Atualização (seção 18):** bloco 1 aceito (DQ-01, DQ-02, DQ-04–DQ-09); DQ-03 e DQ-10–DQ-25 pendentes. **Atualização (seção 20):** bloco 2 formalizado em documentos (DQ-03, DQ-10–DQ-25, D-014). **Atualização (seção 21):** decisões A-01, A-09 e A-10 registradas e achados A-02 a A-16 corrigidos em documentos. **Atualização (seção 22):** exportação implementada na PoC (incremento 1); 71 testes passaram. Próximo incremento recomendado: restauração em pasta nova criada pelo aplicativo, com diário (AC-02, AC-06, AC-08, AC-14 a AC-16). **Atualização (seção 23):** pendências do incremento 1 fechadas; 84 testes passaram. Próximo passo: autorização separada para reverificar as versões da biblioteca ZIP, instalá-la e implementar a PoC de backup e restauração contra AC-01–AC-19. **Atualização (seção 24):** restauração em pasta nova implementada na PoC (incremento 2); 126 testes passaram. Pendências do backup na PoC: valores de segurança e AC-07, AC-13, AC-19 e, no aplicativo nativo, AC-12, AC-18 e a parte de interface do AC-17. **Atualização (seção 25):** AC-19 medido na PoC Node (incremento 3); o critério da série (i) foi observado como atendido nesta máquina, com ressalva. Nenhum limite foi fixado. Próximo passo possível: propor os valores de segurança do AC-07 pelos critérios do VAULT_CONTRACT §7.5, para decisão da proprietária. **Atualização (seção 26):** estados do VAULT_CONTRACT §7.4 e §7.5 corrigidos; proposta de valores do AC-07 registrada em [PROPOSTA_AC07_LIMITES](PROPOSTA_AC07_LIMITES.md), aguardando decisão da proprietária. A razão de compressão continua sem valor, por falta de F-2.v1 e de F-3 maliciosos. **Atualização (seção 27):** a proprietária aprovou a proposta com a alternativa B (D-015); os valores estão no VAULT_CONTRACT §7.5 e não estão implementados. Próximo incremento possível, com autorização própria: implementar e testar o AC-07 com esses valores, sem a razão de compressão. **Atualização (seção 28):** limites da D-015 implementados na PoC e AC-07 executado, sem a razão de compressão; 143 testes passaram.

## 6. Registro da correção autorizada

- Corrigidas as seis divergências com base nas linhas 30, 69, 70, 104, 107 e 152 da ESPECIFICACAO_V1 original preservada. Fontes e propostas superadas em [SOURCES](SOURCES.md), [DECISIONS](DECISIONS.md) e [RECOVERY_LOG](RECOVERY_LOG.md).
- Os exemplos já estavam compatíveis e não receberam alterações de conteúdo. Critérios TC permanecem apenas planejados.
- Conferência específica desta correção: seis contratos comparados com as linhas originais e alinhados em modelo, decisões, especificação, questões, critérios planejados e rastreabilidade. Conferidos 38 documentos Markdown e 156 links locais existentes; os 12 exemplos YAML foram lidos e permanecem idênticos ao estado anterior. Nenhum arquivo foi adicionado ou removido nesta correção; somente 12 documentos ativos foram alterados. Verificação de espaços em branco: sem erros.
- SHA-256 do ZIP histórico antes e depois da correção, calculados e comparados: `f246c2d7cdc1a094046ef1357097019a0411824d3569969e7286f3a22c26a30b` em ambos, também igual à referência anterior registrada. CRC do ZIP verificado; fontes históricas e PDF preservados integralmente.
- Ao encerrar a correção documental anterior, software, PoC e testes do aplicativo ainda não estavam implementados; nenhum teste de software foi executado naquela correção.

## 7. Registro da primeira PoC de persistência

**Data do ambiente:** 17/10/2026. As datas 18/10/2026 mantidas em documentos de consolidação e nas fontes não foram alteradas nem normalizadas.

- Escopo: envelope experimental reduzido com `id`, `title` e `sort_order`; `sort_order: 0` é dado da fixture, não default. Q-01, Q-02 e Q-03 permanecem abertas; em particular, destinos da Inbox em Q-02 não foram ampliados por D-002. Os seis contratos confirmados não foram reabertos.
- Ambiente: Windows x64; Node global `20.20.2` (EOL) observado antes da instalação; Node local `24.22.0` fornecido por `node-win-x64@24.22.0`; npm `10.8.2`; TypeScript `7.0.2`; `@types/node` `24.19.2`; `yaml` `2.9.1`. Dependências diretas com versões exatas no manifesto e lockfile local. SHA-256 do executável comparado ao valor oficial de `win-x64/node.exe`: `ba93f9a70bd86fce3ebbb39ec758501458453467aa92a34a0a3602d1e3fc2b9c`. Nenhuma instalação global ou alteração de configuração do sistema.
- Fontes oficiais consultadas antes da instalação: página de releases Node.js, release Node `24.22.0` LTS e documentação/repositório do parser `yaml`; versões exatas registradas em `poc/package.json` e `poc/package-lock.json`.
- Comandos e resultados: `npm install --save-exact` executado por engano na raiz: código 1 (`ENOENT`, sem manifesto raiz e sem alteração); instalação inicial em `poc/`: código 0; primeiro `npm test`: código 1, fixture não encontrada em `dist`; após corrigir a referência compilada, `npm test`: código 0, 11 passaram; para fixar diretamente o runtime, `npm install --save-exact`: código 0, 1 pacote adicionado, 4 removidos, 7 auditados, zero vulnerabilidades; `npm ci`: código 0, 6 pacotes adicionados, 7 auditados, zero vulnerabilidades; validação final `npm test`: código 0, runtime `v24.22.0`, typecheck/build passaram, 11 testes passaram e 0 falharam.
- Corpos LF e CRLF comparados diretamente por bytes e SHA-256 antes/depois: LF `28f5921e34ed051a673c884cd7a50f0ebbf576a7484570861fe3b6d87909d5a1`; CRLF `128220058c92865b3254ee9df6ba7a43ebbca9793dbfcc8c16701adf528fcc4a`. Incluem acentos, espaços finais, linhas vazias, fence e ausência de newline final.
- Cobertura exercitada: diagnóstico de YAML inválido e chave duplicada; envelope reduzido e UUID v4; título alterado, UUID mantido e releitura; criação exclusiva sem sobrescrita; alteração externa injetada durante staging, mantendo bytes externos e rascunho local no erro; falha sintética ao gravar temporário; rename seguido de falha de leitura de confirmação retorna estado incerto sem rollback.
- Limites: SHA-256 antes de rename não é compare-and-swap atômico; permanece uma janela de corrida até o rename. Não comprovados concorrência geral, queda de energia, falha física de disco, durabilidade em outros SOs, comportamento Tauri/GUI/permissões, TC-17 nativo, Inbox, backup, progresso, indexação ou V1.
- TC-01, TC-02, TC-03, TC-06 e TC-16 têm somente subcasos parciais executados; nenhum TC completo foi aprovado. TC-17 não foi executado. A matriz detalhada está em [TEST_PLAN](TEST_PLAN.md) e [REQUIREMENTS_TRACEABILITY](REQUIREMENTS_TRACEABILITY.md).
- O ZIP histórico não foi extraído nem alterado. SHA-256 antes desta tarefa (auditoria local imediatamente anterior) e após esta tarefa: `f246c2d7cdc1a094046ef1357097019a0411824d3569969e7286f3a22c26a30b`; igual à referência de SOURCES. SHA-256 final do PDF preservado: `3ea280f816507755cf11a879d1bfa4c5439bdb402e6b28336d68d6c56b42aa2a`.

## 8. Etapa delimitada: regras puras D-003/D-004

**Data do ambiente:** 17/10/2026 · **Comando final:** `npm test` dentro de `poc/` · **Resultado:** código 0; typecheck/build passaram; 24 testes passaram, 0 falharam. Sem dependências adicionadas. A suíte reaplicou também os 11 casos anteriores; nenhum resultado antigo foi contado sem nova execução.

- D-004: `itemBelongsToGroup` usa interseção não vazia de `tag_ids`. Testes diferenciam OR de AND, ausência de tags, nomes iguais com IDs diferentes, Item em vários Groups e ausência de mutação. É cálculo em memória; renomeação isolada de Tag em disco permanece não demonstrada (parte de TC-04).
- D-003: `calculateProjectProgress` considera `todo`, `in_progress` e `done`; conta `done`, exclui `canceled`, ignora tarefas com outro `project_id` ou `project_id: null`; retorna `null` sem elegíveis. Retorna o resultado numérico direto sem arredondamento e não altera tarefas/status de projeto. Casos fracionários usam a ordem `done / eligible * 100`.
- Os tipos `TagMembershipSlice` e `ProgressTaskSlice` são recortes experimentais. As tarefas de teste não têm `archived_at`; a seleção/influência de tarefas arquivadas continua em Q-03 e fora da prova. Nenhum default, nullability ou outro contrato foi acrescentado.
- Revisão do mecanismo anterior: havia cleanup incondicional no `catch` de `writeTemporary`. Um erro `EEXIST` ao criar o temporário podia apagar um caminho que o adapter não possuía. O teste novo reproduziu o defeito; a correção transfere cleanup de escrita parcial ao adapter somente após abertura exclusiva bem-sucedida. O teste de conflito agora confirma remoção do temporário; a falha parcial confirma cleanup próprio; a colisão confirma preservação do arquivo alheio.
- A revisão também verificou: criação real via `wx`; conflito externo entre staging e checagem pré-rename; `rename` falho antes da substituição mantém original e temporário diagnóstico; falha de leitura pós-rename retorna `UncertainWriteError`, preserva rascunho/hash/path e não faz rollback. SHA-256 seguido de rename continua não sendo compare-and-swap atômico.
- Iterações de teste: a execução discriminante inicial falhou com 11/12 porque demonstrou remoção do arquivo alheio; após o fix, a primeira suíte de 24 teve 2 falhas de oráculo por diferença IEEE-754 entre `100/3` e `(1/3)*100`. Ajustados os asserts para a fórmula aprovada, sem arredondar. A suíte final passou 24/24.
- O ZIP histórico permaneceu em SHA-256 `f246c2d7cdc1a094046ef1357097019a0411824d3569969e7286f3a22c26a30b`, igual ao hash pré-etapa e à referência em SOURCES. Nenhuma dependência foi instalada nesta etapa.

## 9. Etapa delimitada: renomeação de Tag e reconstrução

**Data do ambiente:** 17/10/2026 · **Baseline reproduzido antes das alterações:** `npm test`, código 0, 24 testes passaram · **Validação final:** `npm test`, código 0; typecheck/build passaram; 26 testes passaram, 0 falharam. Nenhuma dependência instalada.

## 10. Etapa delimitada: links Markdown e backlinks

**Data do ambiente:** 18/10/2026 · **Baseline preservada antes de editar:** cópias e manifesto SHA-256 em `%TEMP%\atlas-links-baseline-20261018-001036`. Baseline executada: `npm test`, código 0, 26 testes passaram. **Validação final:** `npm test`, código 0; typecheck/build passaram; 28 testes passaram, 0 falharam.

- Dependência local adicionada: `markdown-it@15.0.3` (MIT), tipos integrados; CommonMark preset, `html: false`, `linkify: false`. Documentação e arquitetura oficiais consultadas; versão fixada no package.json/package-lock, sem instalação global.
- Sintaxe provada: links Markdown inline/reference para caminho relativo `.md` sob `notes/work|reading|permanent/{UUID}.md`, com fragmento opcional preservado (sem validação de heading). A resolução parte do arquivo de origem e usa caminho/UUID, não título.
- Código inline/fences e imagens não criam relações. URLs externas, anchor-only, query, arquivos não-Nota, destinos `.md` ausentes e caminhos fora da raiz são excluídos ou diagnosticados. Nenhum destino fora da raiz foi consultado ou lido. Indexação comparou bytes/hash de todos os arquivos antes/depois.
- Reconstruções leem somente arquivos Markdown regulares enumerados nas três pastas de Nota. Symlinks são classificados sem seguimento por `lstat`. Rebuild retorna mapas novos; links de saída e backlinks são derivados em memória.
- Subcasos de TC-07/08 executados: link/backlink, títulos iguais distintos por UUID/path, rename apenas do título preservando corpo/path/consumer, códigos/URLs e demais tipos de destino, missing diagnostic sem alteração e rebuild após descarte do índice anterior. TC-07/08 completos permanecem pendentes (sem restart de app, watcher, move/reparo, heading validation ou GUI).
- Arquivo de Nota inválido interrompe a construção com erro em vez de ser descartado. A fixture não decide política geral para inválidos, referências ausentes, symlinks ou arquivamento. Wikilinks não são suportados; D-009 não foi ampliada além do recorte.
- ZIP histórico antes/depois: SHA-256 `f246c2d7cdc1a094046ef1357097019a0411824d3569969e7286f3a22c26a30b`, igual à referência. PDF preservado.

## 11. Etapa delimitada: links Markdown e backlinks

**Data do ambiente:** 18/10/2026 · **Baseline externa:** cópias e manifesto SHA-256 em `%TEMP%\atlas-links-baseline-20261018-001036`. Antes de instalar o parser, baseline executada: `npm test`, código 0, 26 testes passaram. Após instalar markdown-it, os mesmos 26 passaram novamente. **Validação final:** `npm test`, código 0; typecheck/build passaram; 29 testes passaram, 0 falharam.

- Dependência direta local adicionada: `markdown-it@15.0.3` (MIT), tipos integrados, em `poc/package.json` e lockfile. Fontes oficiais de versão/API consultadas antes de instalar. Sem instalação global.
- Configuração: preset CommonMark, `html: false`, `linkify: false`; links extraídos de tokens `link_open` e atributo `href`, sem regex em texto bruto.
- Sintaxe provada: links inline/reference Markdown com caminho relativo não vazio terminado em `.md`, sob diretórios canônicos `notes/work`, `notes/reading`, `notes/permanent`, destino com basename UUID e `note_type` correspondente. Caminho resolve relativo à origem; fragmento opcional é retido, mas heading não é validado.
- Código inline/fences e imagens não geram relações. Diagnósticos cobertos: URL externa, anchor-only, query local, destino vazio/inválido, arquivo que não é Nota, Markdown ausente e caminho fora da raiz. HTML bruto, autolink automático e Wikilinks não são interpretados.
- A fixture tem origem, destino, outra Nota de título igual, arquivo Markdown não-Nota, asset e alvo ausente. Índice recriado do disco produz outgoing/backlinks por UUID. Testes verificam arquivos e hashes iguais antes/depois da indexação e rename do título do destino, corpo/path/caminho do link estáveis após rebuild.
- O leitor exige diretórios canônicos e arquivo regular com UUID/note_type consistente. Destinos externos à raiz não são consultados; cada componente interno é verificado por `lstat` sem seguir symlinks. Nota inválida interrompe o build do índice com erro, sem descarte silencioso. Não há política geral para inválidos/referências ausentes, move, concorrência ou headings nesta fixture.
- TC-07 e TC-08 cobertos parcialmente; restart do app, watcher, outros dialetos Markdown, heading validation, move/reparo, seletor e GUI não comprovados. Nenhum TC completo recebe PASS.
- O ZIP manteve SHA-256 `f246c2d7cdc1a094046ef1357097019a0411824d3569969e7286f3a22c26a30b`; PDF preservado. Q-01/Q-02/Q-03 e os seis contratos confirmados não foram alterados.

## 12. Auditoria de continuidade e etapa delimitada: contexto D-001 e nova permanente D-008

**Data do ambiente:** 18/10/2026 · **Base de autorização:** instrução da proprietária na sessão atual para auditar o repositório e continuar o desenvolvimento pela próxima unidade suficientemente especificada, sem iniciar a V1. **Baseline reproduzida antes de editar:** `npm test` em `poc/`, código 0, runtime `v24.22.0`, typecheck/build passaram, 29 testes passaram, 0 falharam. Cópia e manifesto SHA-256 dos arquivos-fonte fora do repositório (diretório temporário da sessão). **Validação final:** `npm test`, código 0; typecheck/build passaram; 37 testes passaram, 0 falharam. Nenhuma dependência instalada; nenhum runtime global alterado.

### 12.1 Escopo implementado

- `poc/src/core/identity.ts`: `isUuidV4`, extraído de `frontmatter.ts` sem mudança de comportamento (a validação do envelope usa a mesma expressão).
- `poc/src/core/domain-rules.ts`: `noteContextViolation` aplica D-001 em memória. `work` exige UUID v4 de Item; `reading` aceita `null` ou UUID v4; `permanent` exige `null`. Chave `context_item_id` ausente e tipo desconhecido são rejeitados. Com `knownItemIds`, uma referência inexistente é rejeitada; sem esse conjunto só a forma é verificada. Não consulta tipo nem arquivamento do Item.
- `poc/src/core/note-link-index.ts`: exportado `extractMarkdownLinkHrefs`, com a mesma instância markdown-it (CommonMark, `html:false`, `linkify:false`). `rebuildNoteLinkIndex` não foi alterado.
- `poc/src/core/permanent-note.ts`: `createPermanentNoteFrom` reconstrói o índice de Notas a partir do disco, localiza a origem por UUID e aceita somente origem `work` ou `reading`. Gera um UUID v4 (injetável no teste), recusa UUID já usado por uma Nota indexada, valida D-001 e compõe o corpo como elaboração fornecida + linha `Origem: [título escapado](../{tipo}/{UUID}.md)`. Antes de gravar, confere que o corpo produz exatamente um link a mais para a origem. Grava somente `notes/permanent/{UUID}.md` via `createRecord` (abertura exclusiva `wx`). A origem nunca é escrita.
- Envelope experimental da nova Nota: `id`, `title`, `note_type: permanent`, `context_item_id: null`. Timestamps, `schema_version`, `tag_ids`, aliases e campos de fonte não são gravados porque continuam propostos em Q-01/P-01. Cópia de tags e título padrão não foram decididos e não foram implementados. A forma `Origem: [...]` segue o exemplo documental `docs/examples/vault/notes/permanent/…`; não é decisão de texto da UI.

### 12.2 Testes executados

- TC-22 (domínio), 4 testes: casos aceitos/rejeitados de work, reading e permanent; chave ausente; referência inválida; Item desconhecido com conjunto informado; tipo desconhecido; ausência de mutação.
- TC-09 (arquivo), 4 testes: (1) a partir de work com CRLF/acentos/fence: novo UUID, contexto null, metadados exatos, corpo esperado, bytes e SHA-256 da origem iguais, nenhum outro arquivo do vault alterado, exatamente um arquivo novo; índice reconstruído do disco com nova instância de storage mostra outgoing nova→origem e backlink origem←nova. (2) a partir de reading com UUID aleatório, título com `[ ] & * ( )` escapado e EOL CRLF; backlink reconstruído. (3) recusas sem gravação: origem permanent, origem inexistente, UUID da origem, UUID de permanente existente, id não UUID v4, título vazio e elaboração com fence aberta (link de origem não seria interpretado); snapshot SHA-256 do vault igual. (4) arquivo criado concorrentemente no destino → `DestinationExistsError`, bytes alheios e origem preservados; falha sintética de criação → `StorageFailureError` (`create-exclusive`) com rascunho, vault inalterado.
- Verificação discriminante: duas mutações temporárias em `permanent-note.ts` foram executadas e revertidas (conferência byte a byte com cópia). Sem a guarda do link de origem: 1 falha (fence aberta). Com `context_item_id` copiado da origem: 3 falhas (a guarda D-001 recusa a criação). A suíte final foi executada após a reversão.
- SHA-256 do corpo-origem no teste (1), por execução: `caa6f18e75df8a535cded9e634907eb60b39155163546a91dda32df4d537323e`.

### 12.3 Limites

- "Reiniciar" foi exercitado como reconstrução do índice a partir do disco com mapas e storage novos; não há reinício de aplicativo, cache persistente, GUI, seletor de notas nem editor. TC-09 e TC-22 completos permanecem pendentes.
- Unicidade de UUID verificada contra as três pastas de Nota e pelo caminho exclusivo; não contra outras entidades. A verificação prévia e a criação não formam operação atômica: a colisão concorrente é detectada pelo `wx`.
- Origem com contexto inválido não é bloqueada (D-001 é aplicada à nova Nota); a política para registros inválidos continua aberta. Nota inválida em qualquer pasta interrompe a criação, como no índice existente.
- D-001 por existência depende de um conjunto de Items fornecido; não há índice de Items integrado a esta prova.

### 12.4 Divergências encontradas na auditoria (não corrigidas)

1. As seções 10 e 11 registram a mesma etapa de links; a 10 informa 28 testes finais e a 11 informa 29. A baseline desta sessão obteve 29, coerente com a seção 11, TEST_PLAN §7 e REQUIREMENTS_TRACEABILITY. As duas seções foram preservadas como histórico.
2. A seção 9 contém apenas a linha de cabeçalho; os detalhes da etapa de Tag estão em TEST_PLAN §6 e poc/README.
3. D-003 na documentação oficial (§5.3) define `100 * done / eligible`; `calculateProjectProgress` calcula `(done / eligible) * 100`. Para 1/3 os resultados diferem em IEEE-754 (`33.333333333333336` contra `33.33333333333333`). A seção 8 descreve o ajuste dos asserts como alinhamento à "fórmula aprovada", mas eles seguem a ordem do código. Código e testes não foram alterados; a ordem de operação, e se ela importa antes do arredondamento de apresentação, requer decisão da proprietária. **Atualização:** resolvida por decisão da proprietária e correção registrada na seção 13; o texto acima é mantido como registro da auditoria.
4. README, docs/README e AI_CONTEXT não mencionavam a etapa de links; foram atualizados com o estado verificado nesta sessão.
5. `.editorconfig`/`.gitattributes` definem LF, mas os fontes e testes TypeScript preexistentes da PoC, `poc/README.md` e a fixture `group.md` estão em CRLF. Os arquivos editados mantiveram CRLF; os três arquivos novos (`identity.ts`, `permanent-note.ts`, `permanent-note.test.ts`) usam LF conforme a convenção documentada. Nenhuma normalização em massa foi feita.

O ZIP histórico manteve SHA-256 `f246c2d7cdc1a094046ef1357097019a0411824d3569969e7286f3a22c26a30b` e o PDF `3ea280f816507755cf11a879d1bfa4c5439bdb402e6b28336d68d6c56b42aa2a`, antes e depois. Q-01–Q-10 e os seis contratos confirmados não foram alterados.

## 13. Correção autorizada: ordem de operação de D-003

**Data do ambiente:** 18/10/2026 · **Decisão da proprietária (sessão atual):** alinhar o código à fórmula da documentação oficial §5.3, `100 * done / eligible`, sem alterar o contrato. **Baseline reproduzida antes de editar:** `npm test` em `poc/`, código 0, runtime `v24.22.0`, 37 testes passaram, 0 falharam; cópia e manifesto SHA-256 fora do repositório. **Validação final:** `npm test`, código 0; typecheck/build passaram; 37 testes passaram, 0 falharam. Nenhuma dependência instalada.

- `poc/src/core/domain-rules.ts`: `calculateProjectProgress` passou de `(done / eligible) * 100` para `(100 * done) / eligible`. Seleção de tarefas, exclusão de `canceled`, retorno `null` e ausência de arredondamento não mudaram.
- `poc/test/domain-rules.test.ts`: os dois oráculos fracionários (1 de 3 elegíveis) passaram de `(1 / 3) * 100` para `(100 * 1) / 3`, ou seja, `33.333333333333336` em IEEE-754. Os demais oráculos (0, 100, null, isolamento por projeto) não mudaram.
- Diff conferido contra a cópia de baseline: somente essas três linhas; finais de linha CRLF preexistentes preservados.
- Verificação discriminante: com o código anterior e os novos oráculos, 2 testes falharam (`mistura todo, in_progress, done e canceled exclui canceled` e `progresso fracionário não arredonda nem modifica os dados`); o código corrigido foi restaurado e conferido byte a byte antes da execução final.
- A seção 8 permanece como histórico da implementação anterior: sua frase "Casos fracionários usam a ordem `done / eligible * 100`" descreve o comportamento até esta correção. Seleção de tarefas arquivadas (Q-03), modos manual/none, persistência e UI continuam fora de TC-05; TC-05 completo permanece pendente.

## 14. Preparação da decisão Q-05 (documental)

**Data do ambiente:** 18/10/2026 · Criado [PROPOSTA_Q05_BACKUP.md](PROPOSTA_Q05_BACKUP.md) e registrado no índice de `docs/README.md`. Fontes lidas: documentação oficial §3, §6 e §8; DECISIONS D-005/D-007/D-011/D-012 e P-04; ESPECIFICACAO_V1 F-07 e §9; VAULT_CONTRACT §3, §4 e §7; DATA_MODEL §1, §2 e §10; ADR-006; OPEN_QUESTIONS Q-04/Q-05/Q-07/Q-10; TEST_PLAN TC-13–15; UX de Configurações; AGENTS. Fontes históricas do ZIP consultadas somente para comparação, em leitura sem extração: não definem formato de manifesto, e uma delas diz que o backup “pode ser feito copiando o vault”, o que não é norma vigente.

A proposta separa requisitos DECIDIDOS/ESPECIFICADOS de recomendações técnicas, apresenta alternativas para manifesto, exclusões, snapshot, limites, links simbólicos e anexos, e lista os critérios planejados AC-01 a AC-12. Nenhuma decisão foi tomada: VAULT_CONTRACT, DATA_MODEL, ESPECIFICACAO_V1, DECISIONS, OPEN_QUESTIONS e TEST_PLAN TC-13–15 não foram alterados, e não há código de backup. TC-13, TC-14 e TC-15 continuam não implementados e não executados.

## 15. Formalização parcial da Q-05 (documental)

**Data do ambiente:** 18/10/2026 · **Base:** diretrizes da proprietária na sessão atual (P-1 M-B, P-2 E-C, P-3 C-A, P-4 L-C, P-5 S-A, P-6 a P-8). **Alterações locais preexistentes:** nenhuma desde o fim da sessão anterior (manifesto SHA-256 comparado). Baseline copiada fora do repositório antes de editar.

- **Formalizado:** VAULT_CONTRACT §7 reescrito (manifesto, inclusões e exclusões, anexos, consistência, estrutura de limites, links, restauração), com o histórico da proposta anterior em §7.8. ADR-006 atualizado. D-013 registrado em DECISIONS, com nota em P-04. Q-05 em OPEN_QUESTIONS atualizada com decisões e pendências, e o texto original citado.
- **Testes:** TEST_PLAN com TC-13–15 revisados e nova §10 com AC-01–AC-14. Incorporados: inventário exato (AC-01), injeção determinística de escrita concorrente (AC-04), inspeção do sistema de arquivos fora do destino (AC-06) e exigência nativa (AC-12). O modelo de registro de execução passou para a §11. Todos os critérios continuam PLANEJADOS.
- **Rastreabilidade:** REQ-008 atualizado. DATA_MODEL não alterado: as decisões não mudam campos, caminhos nem a estrutura dos registros.
- **Pendências explícitas:**
  - valores numéricos dos limites; junções e pontos de reparo; ZIP64, com recomendação Z-B (Q-07);
  - canonicidade de `settings.yml`/`assets/` e configuração portátil (Q-10);
  - GUI e troca do vault ativo (Q-08);
  - destino de restauração falha (Q-04/Q-08);
  - P-04, para transação, edição externa e migração.
- **Biblioteca ZIP:** recomendação em PROPOSTA_Q05_BACKUP §8. Preferida: yauzl 3.4.0 + yazl 3.3.1; alternativa: @zip.js/zip.js. Fontes primárias consultadas em 18/10/2026 (registro npm, README e typings da versão exata, issue tracker do fflate). **Nada instalado**; `poc/package.json` e o lockfile não foram alterados.
- **Não executado:** nenhum teste funcional de backup existe ou foi executado. A suíte da PoC não foi alterada nesta etapa. Verificações realizadas: links locais e consistência de referências entre documentos (ver comandos no relatório da sessão), hashes do ZIP histórico e do PDF.
- Q-05 **não** está concluída; V0 permanece aberta. Q-01 a Q-04 e Q-06 a Q-10 não foram alteradas.

## 16. Pacote de decisões para os bloqueios da Q-05 (documental)

**Data do ambiente:** 18/10/2026 · **Alterações locais preexistentes:** nenhuma desde a sessão anterior (manifesto SHA-256 comparado); baseline copiada fora do repositório.

- Criado [PROPOSTA_BLOQUEIOS_Q05.md](PROPOSTA_BLOQUEIOS_Q05.md) (PROPOSTO, não vinculante), registrado no índice `docs/README.md`. Para Q-07, Q-10, Q-08 e Q-04 o documento apresenta: o que está decidido, o que está pendente, alternativas, recomendação, o que se decide agora ou depois de medição ou protótipo, e os testes. Termina com a tabela única DQ-01–DQ-25 e a ordem de implementação.
- **Ambiente observado (VERIFICADO, delimitado):**
  - Windows 11 Pro 10.0.26200, x64, Intel Core i5-1334U, 15,7 GiB de RAM;
  - NTFS; `LongPathsEnabled = 1`; sessão não elevada; Modo de Desenvolvedor não habilitado;
  - Node da PoC 24.22.0.

  Nome da máquina e usuário não foram registrados.
- **Sonda exploratória** (diretório temporário, removido, sem código de backup, sem ID TC/AC): symlink de arquivo e de diretório falhou com `EPERM`; junção criada e classificada por `lstat` como `isSymbolicLink() === true`; `fs.statfs` disponível. Não é evidência de backup nem de AC-09.
- **Nada foi alterado** em VAULT_CONTRACT, DATA_MODEL, ESPECIFICACAO_V1, DECISIONS, OPEN_QUESTIONS ou TEST_PLAN. AC-15–AC-17 são apenas sugeridos na proposta. Nenhuma dependência instalada, nenhum código alterado, nenhum teste funcional executado. Configurações do sistema não foram alteradas: a habilitação do Modo de Desenvolvedor é decisão e ação da proprietária (DQ-08).
- Bloqueios mantidos até a resposta: Q-07 (volume de F-2, margens e valores dos limites, que dependem de medição), Q-10, Q-08 (visual por protótipo) e Q-04. Q-05 e V0 permanecem abertas.

## 17. Revisão formal do estado das DQ-01–DQ-25 (documental)

**Data do ambiente:** 18/10/2026 · **Alterações locais preexistentes:** nenhuma desde a sessão anterior (manifesto SHA-256 comparado); baseline copiada fora do repositório.

- **Autorização verificada:** o histórico contém escolhas explícitas da proprietária somente para a ordem de D-003 (§13) e para as diretrizes P-1 a P-8 (D-013). Nenhuma DQ foi respondida. Por isso **nenhuma DQ foi formalizada**. DECISIONS, OPEN_QUESTIONS, VAULT_CONTRACT, DATA_MODEL, ESPECIFICACAO_V1, TEST_PLAN e ARCHITECTURE_DECISIONS não foram alterados.
- A matriz com dependências, documento responsável, AC afetados e estado de cada DQ foi acrescentada em [PROPOSTA_BLOQUEIOS_Q05 §9](PROPOSTA_BLOQUEIOS_Q05.md):
  - 24 de 25 dependem de confirmação;
  - DQ-03 depende de informação da proprietária (registros, anexos, tamanho total e horizonte de crescimento);
  - as margens e os valores de DQ-05 dependem de medição;
  - DQ-07, DQ-09, DQ-20, DQ-22 e DQ-23 têm uma parte que depende de prova técnica.
- **Emendas suspensas até a resposta:** DQ-06 e DQ-19 (opção A) alterariam texto de D-013; DQ-10 alteraria DATA_MODEL §2/§10 e VAULT_CONTRACT §7.2. Nenhuma contradição entre documentos vigentes foi encontrada.
- **Lista de mudanças previstas no TEST_PLAN** (AC-15–AC-17, extensões de AC-03/AC-05, pré-condição de AC-09, AC-18 condicional, fixtures e MP): proposta §9.3, **não aplicada**.
- **Limitação de symlink registrada:** sessão não elevada e sem Modo de Desenvolvedor (`EPERM`). A execução dos testes de symlink exige ação da proprietária (DQ-08); o agente não alterou privilégios nem configurações.
- Nenhum código, dependência ou configuração foi alterado; nenhum teste funcional foi executado; nenhum TC ou AC recebeu PASS. Q-04, Q-05, Q-07, Q-08, Q-10 e V0 permanecem abertas.

## 18. Formalização documental do bloco 1 (DQ-01–DQ-09)

**Data do ambiente:** 18/10/2026 · **Autorização:** a proprietária aceitou DQ-01, DQ-02 e DQ-04 a DQ-09 e manteve DQ-03 pendente; o escopo é somente documental. **Estado prévio:** nenhuma alteração local desde a sessão anterior (manifesto SHA-256 comparado); baseline copiada fora do repositório.

- **Emenda a D-013 (DQ-06):** acrescentada a categoria de limite “comprimento do caminho absoluto no destino” na linha de D-013 em DECISIONS e na lista de VAULT_CONTRACT §7.5. Redação anterior preservada na nova seção “Emendas registradas” de DECISIONS e em VAULT_CONTRACT §7.8.
- **VAULT_CONTRACT §7.5:**
  - critérios de fixação dos valores (DQ-05), com tabela que separa categorias, critérios, valores (nenhum aprovado) e testes;
  - ZIP64 passou de PENDENTE para Z-B (DQ-07), com a recomendação anterior citada e AC-13 pendente.
- **TEST_PLAN:**
  - nova §12 com plataforma prioritária, fixtures F-1/F-2/F-3, protocolo MP, limites e testes de links e pontos de reparo (DQ-01, DQ-02, DQ-04, DQ-08, DQ-09);
  - AC-07, AC-09 e AC-13 e a frase de pré-condições do §3 ajustados, todos ainda PLANEJADOS.
- **Correções estritamente necessárias** para evitar contradição, fora da lista principal:
  - ARCHITECTURE_DECISIONS ADR-006: o estado e a consequência que tratavam o ZIP64 como pendente;
  - OPEN_QUESTIONS: na Q-05, a frase “ZIP64… decisão após Q-07”; na Q-07, uma anotação de decisão parcial.

  Em todos os casos o texto anterior foi citado. Q-05 e Q-07 continuam abertas.
- **Rastreabilidade:** REQ-008 e REQ-016 atualizados, mais um parágrafo do bloco 1.
- **Pendências mantidas:**
  - DQ-03, a estimativa de F-2;
  - margens, tetos de memória e tempo e valores numéricos dos limites, que dependem de medição;
  - AC-13, com biblioteca, leitor, extração pelo Explorador e fluxo não validados;
  - AC-09: (b) symlink depende de ação manual da proprietária; (c) outros pontos de reparo dependem do backend nativo, que não existe;
  - AC-12 nativo;
  - DQ-10 a DQ-25.
- **Decisões aceitas não equivalem a implementação ou teste.** Nenhum código, dependência ou configuração do Windows foi alterado. Nenhuma fixture foi construída, nenhuma medição foi feita, nenhum teste funcional foi executado e nenhum TC ou AC recebeu PASS. Q-04, Q-05, Q-07, Q-08, Q-10 e V0 permanecem abertas.

## 19. Pré-condição de symlink (DQ-08) satisfeita no ambiente

**Data do ambiente:** 18/10/2026 · A proprietária habilitou manualmente o Modo de Desenvolvedor do Windows. O agente não alterou nenhuma configuração.

- Conferência por leitura do registro: `AllowDevelopmentWithoutDevLicense = 1`; a sessão continua **não elevada**.
- Repetição da sonda exploratória da §16, com o mesmo script, o Node 24.22.0 da PoC e diretório temporário removido ao final:
  - symlink de arquivo: **criado**;
  - symlink de diretório: **criado**;
  - junção: criada;
  - nos três casos, `lstat` retornou `isSymbolicLink() === true`; `readlink` funcionou.
- Consequência: a pré-condição ambiental da variante (b) de AC-09 está satisfeita neste equipamento (TEST_PLAN §12.5). **AC-09 não foi executado**, porque não há código de backup. A variante (c), outros pontos de reparo, continua dependendo do backend nativo. A sonda não é evidência de TC ou AC.
- Se o Modo de Desenvolvedor for desativado depois, a pré-condição deixa de valer e precisa ser reconferida antes da execução.

## 20. Formalização documental do bloco 2 (DQ-03, DQ-10–DQ-25)

**Data do ambiente:** 18/10/2026 · **Autorização:** edição exclusivamente documental de 13 arquivos em `docs/`, com as DQ aceitas, as cinco respostas da revisão do plano e as três respostas da seção F.3. **Estado prévio:** repositório idêntico ao fim da etapa anterior (manifesto SHA-256 comparado); baseline copiada fora do repositório para o diff.

- **D-014** criada: conteúdo canônico (registros, `assets/`, `settings.yml` opcional), configuração do dispositivo e caches fora do vault, e versão do schema derivada dos registros (V-1). Registrada em DECISIONS e no DATA_MODEL §1, §2.1 e §10.
- **Emendas à D-013**, com a redação anterior citada em DECISIONS e no VAULT_CONTRACT:
  - destino criado pelo aplicativo (§7.7 item 1);
  - classes de limite segurança × capacidade e critérios 1 a 3 (§7.5);
  - caches (§7.2 item 2).
- **Complementos à D-013:**
  - streaming normativo, sem promessa de memória constante (§7.4);
  - arquivos de sistema e pastas vazias, e recriação das pastas canônicas;
  - ordem e relatório;
  - abertura do vault restaurado;
  - política de transação pendente (o mecanismo continua PROPOSTO);
  - escrita concorrente e ZIP temporário;
  - restauração falha, diário e marcador mínimo;
  - alcance da verificação de links (§7.6).
- **Demais documentos:**
  - ESPECIFICACAO_V1 F-07 e UX §2: versão derivada, tema no dispositivo e fluxo de restauração DECIDIDO (o visual continua dependendo de protótipo);
  - ADR-006: linha de estado;
  - OPEN_QUESTIONS: Q-04, Q-05, Q-07, Q-08 e Q-10 anotadas, **todas abertas**;
  - TEST_PLAN: AC-01 a AC-19 (AC-15 a AC-19 novos, extensões de AC-03 e AC-05), §12.2 e §12.4 com F-2 progressivo e F-3 em degraus;
  - rastreabilidade: REQ-001, REQ-008 e REQ-015;
  - proposta: matriz §9.2 e §11;
  - roadmap e changelog.
- **Rastreio do streaming:** VAULT_CONTRACT §7.4 → AC-19 → TC-21 → **não implementado**. Nenhuma biblioteca foi validada contra o requisito.
- **Continuam abertos:** Q-01 (congelamento de `schema_version`), Q-02, Q-04 (mecanismo da Inbox e escrita geral), Q-05, Q-07 (F-2.v1, metas, hardware, valores de segurança), Q-08 (visual e UX §4), Q-10 (chaves, política de entrada de anexos, schema futuro, edição externa) e V0.
- **Decisões aceitas não equivalem a implementação.** Nenhum código, dependência, lockfile ou configuração foi alterado. Nenhuma fixture foi construída e nenhuma medição ou teste funcional foi executado. Todos os critérios novos estão PLANEJADOS; nenhum TC ou AC recebeu PASS.

## 21. Decisões e correções pós-auditoria do bloco 2 (documental)

**Data do ambiente:** 18/10/2026 · **Autorização:** decisões A-01 (a), A-09 e A-10 e correção documental de A-02 a A-16. **Estado prévio:** repositório inalterado desde a etapa anterior; nova baseline separada fora do repositório (a baseline do bloco 2 foi preservada).

- **Decisões registradas** como emendas à D-013 (DECISIONS), com problema, alternativas, decisão, mudança, redação anterior, impacto e testes:
  - **A-01:** a exportação aplica as verificações da restauração; registros inválidos e versões não suportadas bloqueiam; um `settings.yml` presente é validado; entradas muito comprimíveis usam o método store; espaço livre e caminho absoluto no destino só são verificados na restauração, com justificativa.
  - **A-09:** temporários `.tmp-{UUID v4}.md`, o formato da PoC. Não havia conflito funcional: o manifesto de transação, ainda PROPOSTO, guarda o caminho do temporário explicitamente.
  - **A-10:** versão não suportada bloqueia a disponibilização, em categoria própria.
- **Correções:**
  - A-02: diário de diretórios e remoção de baixo para cima; a cópia existe enquanto a pasta de destino existir;
  - A-03: pasta criada só depois da confirmação;
  - A-04: os dois caminhos resolvidos para o caminho real, com comparação conforme o sistema de arquivos;
  - A-05: TC-13 e TC-14 alinhados ao §10, e a afirmação da proposta corrigida;
  - A-06: AC-19 em três séries;
  - A-07: nova varredura depois da coleta;
  - A-08: recuperação só quando implementada e validada, e `.txn_*` bloqueia a restauração;
  - A-11: ADR-006 e linha da D-013;
  - A-12: campos das emendas e justificativa da D-014;
  - A-13: AC-17 separado em dados e interface;
  - A-14: marcador local ao dispositivo, onde salvar o relatório, vault sem registros, estados definidos, pastas canônicas vazias;
  - A-15: streaming na exportação e validação de um registro por vez;
  - A-16: changelog completado.
- **Não alterados:** código, `poc/`, dependências, lockfiles e ambiente. **Não executados:** testes funcionais. Todos os critérios continuam PLANEJADOS. Q-01, Q-02, Q-04, Q-05, Q-07, Q-08, Q-10 e V0 continuam abertas.

## 22. Incremento 1 da PoC: exportação de backup

**Data do ambiente:** 18/10/2026 · **Autorização:** incremento técnico 1 (exportação), com escopo fechado. **Plataforma:** Windows 11 x64/NTFS, Node `24.22.0`, sessão não elevada, Modo de Desenvolvedor ativo.

- **Bibliotecas** (reverificadas no registro npm em 18/10/2026, versão exata e licença MIT; publicadas há mais de duas semanas, sem versão mais nova):

  | Pacote | Versão | Publicação | Tipo |
  | --- | --- | --- | --- |
  | `yauzl` | 3.4.0 | 07/06/2026 | dependência (`pend` 1.2.0) |
  | `yazl` | 3.3.1 | 23/11/2024 | dependência (`buffer-crc32` 1.0.0) |
  | `@types/yauzl` | 3.4.0 | 13/06/2026 | desenvolvimento |
  | `@types/yazl` | 3.3.1 | 07/04/2026 | desenvolvimento |

  - **Fontes:** https://registry.npmjs.org/yauzl, /yazl, /@types%2Fyauzl, /@types%2Fyazl; READMEs das versões exatas via unpkg (PROPOSTA_Q05_BACKUP §8).
  - **Comandos:** `npm install --save-exact yauzl@3.4.0 yazl@3.3.1` e `npm install --save-exact --save-dev @types/yauzl@3.4.0 @types/yazl@3.3.1`, ambos com código 0 e 0 vulnerabilidades.
  - **Justificativa:** leitura pelo diretório central, `validateEntrySizes`, atributos externos para detectar links, ZIP64 nos dois sentidos, escrita em stream e poucas dependências.
- **Código:**
  - `poc/src/backup/manifest.ts`: M-B, regras de caminho, ordenação UTF-8;
  - `inventory.ts`: varredura sem seguir links, classificação D-014/E-C, validação simétrica A-01/A-10, padrão `.tmp-{UUID}.md` da A-09;
  - `verify-archive.ts`: releitura do ZIP independente do destino;
  - `export.ts`: decisões explícitas, hash em streaming, ZIP temporário com criação exclusiva fora do vault, nova varredura da C-A, releitura e publicação por link físico, que falha se o destino existir;
  - `backup-fs.ts`: porta de arquivos para injeção de falhas;
  - `errors.ts`;
  - `poc/src/core/frontmatter.ts`: nova função `parseFrontmatterDocument`, sem mudança de comportamento em `parseRecordBytes`.
- **Testes:** `poc/test/backup-manifest.test.ts` e `poc/test/backup-export.test.ts`. `npm test` com código 0 e 71/71. Subcasos e lacunas em [TEST_PLAN §13](TEST_PLAN.md). Uma primeira execução travou porque o `FileHandle.close()` esperava o stream de escrita aberto com `autoClose: false`; a correção passou a usar `autoClose: true` com `flush: true`.
- **Suposições e lacunas da implementação, tratadas de forma conservadora e sem alterar o contrato:**
  1. Um `manifest.json` na raiz do vault colide com o manifesto do backup. A exportação o **bloqueia** (`reserved-name`), mas o contrato não trata o caso. Proposta mínima, que precisa da sua decisão: registrar no VAULT_CONTRACT §7.2 que `manifest.json` na raiz é nome reservado e bloqueia. *(Resolvido no §23.)*
  2. Só `settings_version` 1 e `schema_version` 1 são aceitos. O contrato não define os valores suportados de `settings_version`; o valor 1 é suposição da PoC e precisa da sua confirmação. *(Resolvido no §23.)*
  3. Todas as entradas são gravadas sem compressão (método store), o que cumpre a regra de razão de compressão da A-01 sem inventar um limite. O ZIP fica do tamanho dos dados.
  4. Os limites de comprimento e profundidade de caminho relativo **não** são aplicados, porque não há valores aprovados.
  5. A publicação usa link físico e exige um sistema de arquivos que o suporte, como o NTFS. Sem suporte (FAT, exFAT), a exportação falha de forma controlada.
  6. "Pausar escritas internas" não se aplica, porque não há aplicativo.
  7. A validação de registros cobre YAML, id e nome, versão, título (exceto na Inbox), `note_type` e pasta, e UUID único. Ela não aplica D-001 nem campos ainda abertos em Q-01.
- **Não implementado:** restauração, diário, recuperação da Inbox, limites de segurança com valores, AC-07, AC-13 e integração nativa. Nenhum TC foi aprovado.

## 23. Fechamento das pendências do incremento 1

**Data do ambiente:** 18/10/2026 · **Autorização:** a proprietária autorizou resolver as lacunas pela opção conservadora e documentada. **Estado prévio:** conferido; baseline separada fora do repositório.

- **Pendência A — nome reservado `manifest.json`:**
  - formalizada em VAULT_CONTRACT §7.2 item 8 e em DECISIONS (complemento da D-013);
  - **divergência encontrada e corrigida:** a implementação comparava o nome exato. No NTFS, um `Manifest.JSON` na raiz passaria pelo inventário e só falharia na releitura do ZIP, como duplicata. `poc/src/backup/inventory.ts` passou a comparar sem diferenciar maiúsculas e minúsculas e com NFC, só na raiz;
  - o arquivo da pessoa não é alterado.
- **Pendência B — `settings_version`:**
  - formalizada em DATA_MODEL §2.1 e em DECISIONS (complemento da D-014) como decisão nova, limitada à PoC: só a versão 1;
  - nenhuma contradição encontrada: os exemplos não têm `settings.yml`, que é opcional, e a fixture do AC-01 usa a versão 1;
  - o código já se comportava assim; só o comentário foi atualizado.
- **Testes:** 13 testes novos em `poc/test/backup-export.test.ts`. Teste específico: 44/44, código 0. `npm test`: código 0, Node `v24.22.0`, 84/84. A mutação da comparação exata fez 2 testes falharem e foi revertida com novo build.
- **Não alterados:** `poc/package.json`, os lockfiles e o ambiente. A restauração **não** foi implementada.

## 24. Incremento 2 da PoC: restauração em pasta nova

**Data do ambiente:** 18/10/2026 · **Autorização:** incremento 2 (restauração em pasta nova criada pelo aplicativo), com escopo fechado. **Plataforma:** a mesma do §22. **Baseline:** separada, fora do repositório.

- **Código:**
  - `poc/src/backup/restore.ts` (novo):
    - `restoreBackup` executa, nesta ordem:
      1. pré-validação completa com `verifyBackupArchive`, mais a recusa de `inbox/.txn_*.json`;
      2. destino: nome com um só segmento; pasta-pai e vault ativo comparados por caminho real, sem diferenciar maiúsculas no Windows; sobreposição nos dois sentidos recusada; dados do aplicativo fora dos dois; destino inexistente; espaço livre maior ou igual ao total declarado;
      3. confirmação, com um resumo;
      4. criação exclusiva da pasta, dos diretórios e dos arquivos, cada item com intenção registrada no diário antes de ser criado;
      5. extração em streaming, conferindo tamanho e SHA-256 de cada arquivo;
      6. validação simétrica dos registros com `scanVault`;
      7. avisos de referência ausente;
      8. relatório num dos quatro estados.
    - `findIncompleteRestores` detecta, no reinício, diários sem estado terminal; ela os apresenta como Interrompido, sem “Abrir”.
    - `resolveIncompleteRestore` com `remove` apaga só itens do diário cuja identidade (dispositivo e inode) confere: os arquivos primeiro, depois os diretórios de baixo para cima e só quando vazios. Com `keep`, não altera nada. Nos dois casos apaga o diário e deixa o marcador mínimo enquanto a pasta existir.
    - Também inclui `unverifiedCopyMarkerFor`, `dismissUnverifiedCopy` e `saveRestoreReport`, que recusa salvar dentro da cópia ou do vault ativo e não sobrescreve.
  - Extensões:
    - `backup-fs.ts`: `mkdirExclusive`, `rmdir`, `ensureDirectory`, `freeSpace`, `journalAppend` com fsync;
    - `verify-archive.ts`: funções de leitura exportadas para reuso;
    - `inventory.ts`: `schemaVersions` derivado dos registros;
    - `errors.ts`: categoria `io`.
- **Testes:** `poc/test/backup-restore.test.ts`, com 42 testes contando os subtestes. Teste específico: 42/42. `npm test`: código 0, Node `v24.22.0`, **126/126** (84 anteriores e 42 novos). Detalhes em [TEST_PLAN §14](TEST_PLAN.md).
  - Primeira execução: 7 falhas, todas de expectativa do teste:
    - três caminhos inseguros são recusados já pelo `strictFileNames` do yauzl, com o código `invalid-central-directory`;
    - o ZIP “criptografado” fabricado violava antes uma regra de tamanho, e a fixture passou a usar o método 8;
    - a simulação de fim de processo ainda deixava gravar o estado final no diário, e passou a bloquear toda escrita posterior.
  - A mutação de `rmdir` para remoção recursiva fez o AC-16 com arquivo estranho falhar e foi revertida com novo build.
- **Limitações e decisões conservadoras:**
  1. O limite de caminho absoluto no destino não é verificado antes da extração. Faltam um valor de plataforma medido e o AC-07. Um caminho longo demais falha na criação e termina como Falhou.
  2. Os índices não são gravados pela restauração. O AC-02 os reconstrói da cópia e compara com os da origem.
  3. O marcador é local ao dispositivo, nos dados do aplicativo. “Abrir” e os avisos de interface dependem do aplicativo nativo.
  4. As referências ausentes são procuradas nos campos `*_id` e `*_ids` do frontmatter. Links no corpo ficam para os diagnósticos do índice de notas.
  5. Uma falha do próprio diário deixa a restauração sem estado terminal, e o reinício a mostra como Interrompido.
- **Não implementado:** AC-07 (valores), AC-13, AC-18, AC-19, a parte de interface do AC-17, a recuperação da Inbox e a integração nativa. Nenhum TC foi aprovado. Q-01, Q-02, Q-04, Q-05, Q-07, Q-08, Q-10 e V0 continuam abertas.
- **Não alterados:** `poc/package.json`, os lockfiles, os contratos e o ambiente.

## 25. Incremento 3 da PoC: medições do AC-19

**Data do ambiente:** 18/10/2026 · **Autorização:** executar o AC-19, medindo memória e tempo da exportação e da restauração em fixtures sintéticas progressivas, sem novas dependências. **Plataforma e estado:** em [TEST_PLAN §15.1](TEST_PLAN.md).

- **Código:**
  - `poc/bench/ac19-fixture.ts` (novo): gerador determinístico das séries, com semente `atlas-ac19-v1`;
  - `poc/bench/ac19-worker.ts` (novo): uma operação medida por processo;
  - `poc/bench/ac19-run.ts` (novo): orquestração, registro em JSONL e resumo;
  - `poc/src/backup/export.ts` e `restore.ts`: gancho opcional `phase`, que só marca o início das fases e não muda o comportamento;
  - `poc/tsconfig.json`: `bench/**/*.ts` incluído na compilação.
- **Evidência:** `poc/bench/results/ac19-2026-10-18.jsonl` (dados brutos, sem caminhos locais) e `ac19-2026-10-18.md` (resumo gerado).
- **Comandos e resultados:** em [TEST_PLAN §15.2](TEST_PLAN.md).
  - Três séries, 5 execuções por degrau: 70 exportações e 70 restaurações, todas com sucesso, em 43,8 minutos.
  - `npm test` depois das medições: código 0, 126/126.
  - Antes das medições houve uma sondagem de 1 execução por série, descartada e usada só para escolher os degraus.
- **Resultados principais desta máquina** (detalhes em [TEST_PLAN §15.3 e §15.4](TEST_PLAN.md)):
  1. Série (i), de 4 MiB a 3 GiB de anexos: o maxRSS da exportação estabiliza em cerca de 123 MiB; o da restauração vai a 121 MiB, com crescimento residual sublinear no hash prévio do ZIP. O critério de streaming foi observado como atendido, com ressalva.
  2. Série (ii): cerca de 8,3 KiB de maxRSS por entrada na exportação e 11,7 KiB na restauração; a restauração leva cerca de 5,3 ms por arquivo pequeno, dominada pelos fsync do diário e dos arquivos.
  3. Série (iii): a validação usa cerca de 55 MiB mais duas vezes o maior registro (cerca de 315 MiB com 128 MiB), o que o §7.4 admite.
- **Bloqueado ou fora do escopo:** em [TEST_PLAN §15.5](TEST_PLAN.md).
  - Metas de tempo dependem da Q-07; a medição nativa e o TC-21 dependem da prova nativa; o ZIP64 pertence ao AC-13.
  - O cache frio não foi obtido; F-2.v1 não foi usado.
  - **Nenhum valor de limite do AC-07 foi proposto ou fixado.**
- **Não alterados:** dependências, lockfiles, `poc/package.json` e contratos. Q-01, Q-02, Q-04, Q-05, Q-07, Q-08, Q-10 e V0 continuam abertas.
- **Pendência documental** *(resolvida no §26)*: as linhas de estado do VAULT_CONTRACT §7.4 (“não implementado”) e §7.5 (“AC-19 … não executados”) ficaram desatualizadas. Não foram editadas, porque o pedido não incluía o contrato.

## 26. Estados do contrato depois do AC-19 e proposta de valores do AC-07

**Data do ambiente:** 18/10/2026 · **Autorização:**
1. corrigir os estados do VAULT_CONTRACT §7.4 e §7.5;
2. preparar a proposta de valores do AC-07 como PROPOSTA;
3. atualizar os registros.

- **VAULT_CONTRACT:** só o estado factual foi alterado.
  - §7.4: estado do streaming, agora implementado na PoC e medido pelo AC-19 num equipamento, sem garantia geral.
  - §7.5: linhas “Valores de segurança”, “Capacidade” e “Testes de validação”.
  - As redações anteriores foram preservadas. Requisitos, categorias, classes e critérios não mudaram.
- **Proposta:** [PROPOSTA_AC07_LIMITES](PROPOSTA_AC07_LIMITES.md), em estado PROPOSTO.
  - **Segurança:** bytes reais com tolerância zero; igualdade de contagens; teto do tamanho do manifesto antes da leitura, com fórmula conferida contra o serializador real; recusa de caracteres de controle; caminho relativo de 150 caracteres e 450 bytes (alternativa A) ou 1.024 caracteres (alternativa B); segmento de 255; profundidade de 32, com evidência fraca.
  - **Capacidade:** só verificações em execução e curvas de referência, sem teto.
  - **Razão de compressão sem valor proposto:** faltam as amostras comprimíveis de F-2.v1 e os ZIPs maliciosos de F-3.
- **Fontes consultadas:**
  - páginas da Microsoft Learn *Maximum Path Length Limitation* e *Naming Files, Paths, and Namespaces*, em 18/10/2026;
  - consulta somente leitura do valor `LongPathsEnabled` deste equipamento, igual a 1 e não generalizável.
- **Comandos executados:**
  - `Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name LongPathsEnabled`, que retornou 1;
  - um script Node descartável contra `dist/src/backup/manifest.js`, para conferir o tamanho do manifesto (resultados no §2.3 da proposta). O script foi apagado e não ficou no repositório.
  - Nenhum teste foi executado, porque não houve alteração de código.
- **Arquivos alterados:**
  - `docs/VAULT_CONTRACT.md` e `docs/PROPOSTA_AC07_LIMITES.md` (novo);
  - registros: `docs/TEST_PLAN.md` (nota no AC-07), `docs/README.md` (índice), `docs/REQUIREMENTS_TRACEABILITY.md`, `docs/CHANGELOG.md` e este arquivo.
- **Não alterados:** código, dependências e lockfiles. Nenhum valor foi codificado ou aprovado. AC-07 continua PLANEJADO. Q-01, Q-02, Q-04, Q-05, Q-07, Q-08, Q-10 e V0 continuam abertas.

## 27. Decisão D-015: valores de limite do AC-07

**Data do ambiente:** 18/10/2026 · **Decisão da proprietária:** aprovar a [PROPOSTA_AC07_LIMITES](PROPOSTA_AC07_LIMITES.md) com a alternativa B de caminho (1.024 caracteres, apoiada em caminhos longos) e registrá-la como decisão.

- **Registro:**
  - [DECISIONS](DECISIONS.md): linha D-015 e justificativa;
  - [VAULT_CONTRACT §7.5](VAULT_CONTRACT.md): título, tabela “Valores decididos (D-015)” e linha de estado. A redação anterior foi preservada como nota;
  - §7.2 item 7 e §7.7 item 2: referências e recusa de U+0001–U+001F.
- **Documentos dependentes:**
  - DATA_MODEL §2.1 (caminhos de anexos);
  - ESPECIFICACAO_V1 F-07 (diagnósticos);
  - TEST_PLAN AC-07 (casos a acrescentar);
  - PROPOSTA_AC07_LIMITES (estado);
  - ARCHITECTURE_DECISIONS ADR-006, OPEN_QUESTIONS Q-05, REQUIREMENTS_TRACEABILITY e CHANGELOG.
- **Decidido:**
  - tolerância zero para bytes reais;
  - igualdade de contagens;
  - teto do manifesto com P = 3.072;
  - recusa de caracteres de controle;
  - caminho relativo de até 1.024 caracteres e 3.072 bytes;
  - segmento de até 255;
  - profundidade de até 32;
  - capacidade só por verificação em execução, com o caminho absoluto conferido contra o limite que a plataforma oferece de fato.
- **Não adotado:** a alternativa A e o destino típico de 100 caracteres.
- **Pendente:**
  - razão de compressão (S-1), que depende de F-2.v1 e de F-3 maliciosos;
  - a forma de detectar o suporte a caminhos longos;
  - nomes reservados de dispositivo e nomes terminados em espaço ou ponto;
  - metas da Q-07.
- **Consequência aceita:** caminhos acima de 259 caracteres podem não abrir no Explorador. Num ambiente sem caminhos longos, a restauração desses vaults termina em falha controlada.
- **Comandos executados:** só edição de documentos e uma verificação de consistência (tabelas e links). Nenhum teste foi executado, porque não houve alteração de código.
- **Não alterados:** código, dependências e lockfiles. Nenhum valor foi implementado. AC-07 continua PLANEJADO. Q-01, Q-02, Q-04, Q-05, Q-07, Q-08, Q-10 e V0 continuam abertas.

## 28. Incremento 4 da PoC: limites da D-015 e AC-07

**Data do ambiente:** 18/10/2026 · **Autorização:** implementar na PoC o teto do manifesto, a recusa de caracteres de controle, os limites de comprimento, segmento e profundidade, a verificação de espaço livre na exportação e a do caminho absoluto no destino, com os testes do AC-07, sem a razão de compressão.

- **Código:**
  - `poc/src/backup/manifest.ts`: `PATH_LIMITS`, `pathLimitProblem`, `manifestSizeBound`;
  - `verify-archive.ts`: limites de caminho por entrada; teto do manifesto conferido pelo tamanho declarado antes da leitura;
  - `inventory.ts`: caminho fora dos limites bloqueia a exportação (simetria, §7.2 item 7); temporários não entram nessa regra porque nunca são exportados;
  - `export.ts`: `exportSpaceRequirement` e falha `insufficient-space`, de capacidade, antes de criar o temporário;
  - `restore.ts`: `DestinationPathLimits`, `DEFAULT_DESTINATION_PATH_LIMITS` (259 e 247) e a opção `pathLimits`. A verificação `absolute-path-too-long`, de capacidade, roda na fase de destino, antes da confirmação.
- **Testes:** `poc/test/backup-limits.test.ts`, com 17 testes. `npm test`: código 0, **143/143**. Três mutações foram detectadas e revertidas. Detalhes em [TEST_PLAN §16](TEST_PLAN.md).
- **Decisões técnicas conservadoras, sem alterar a D-015:**
  1. A PoC não detecta o suporte a caminhos longos. Usa 259/247 por padrão, o valor da D-015 para quando o suporte não é comprovado, e aceita o limite real informado por quem chama. A detecção fica para o backend nativo.
  2. Os limites de caminho valem para arquivos, não para pastas vazias não canônicas, que não entram no backup.
  3. O espaço livre da exportação é medido na pasta do destino final, onde o temporário é criado.
- **Limitações:**
  - caracteres de controle e segmentos acima de 255 não podem ser criados no NTFS, então o bloqueio na exportação foi exercitado pela função compartilhada;
  - o limite de 3.072 bytes é redundante com o de 1.024 unidades;
  - a falta de espaço real não foi testada.
- **Não implementado:** razão de compressão (S-1), AC-13, nomes reservados de dispositivo e nomes terminados em espaço ou ponto, integração nativa. TC-14 não foi aprovado.
- **Não alterados:** dependências, lockfiles, `poc/package.json` e contratos. As linhas de estado do VAULT_CONTRACT §7.5 e da D-015 foram atualizadas com o fato da implementação, com o estado anterior preservado.

## 29. AC-13: conclusão automática da PoC; aceite Windows pendente

**Data:** 19/10/2026 · **Escopo autorizado:** revisar e concluir os testes ZIP64 iniciados, executar a suíte completa e os casos reais de F-3, registrar evidências e planejar a próxima etapa. Base Git `0fa1eaf7df348358fc85372dfec89c95a269cfe6`, alterações locais na branch `coderabbit/complete-zip64-backup-validation/9a96eb20`.

- **Revisão de `poc/src/backup/export.ts`:** a opção experimental `forceZip64` já estava implementada e versionada na base recebida; força as entradas e o EOCD para a fixture. Sem a opção, `yazl` decide pela necessidade (Z-B). Não foi necessário alterar esse arquivo.
- **Implementação/testes:**
  - `poc/test/backup-zip64.test.ts`: reforçadas as verificações de sentinelas ZIP64, bytes restaurados e recusas de conteúdo/localizador/registro final adulterados antes de qualquer confirmação ou escrita; EACCES/EPERM injetados em exportação/restauração; cleanup associado ao contexto dono da fixture;
  - `poc/test/zip-structure.ts`: leitura completa dos trechos, rodapé com comentário coerente, limites de arquivo/entradas/extras e conferência da contagem central;
  - `poc/test/heavy/ac13-heavy.test.ts` (novo): promoção automática real por contagem e por arquivo acima de 4 GiB, restauração e integridade, fora do glob cotidiano;
  - `poc/test/backup-restore.test.ts`: expectativa de caminho em maiúsculas compatível com Windows ou Linux, sem relaxar a recusa e a verificação de nenhuma escrita.
- **VERIFICADO:** `mise exec node@24.22.0 -- npm test` em `poc/`, código 0; runtime `v24.22.0`, typecheck/build e **152/152** testes passaram, sem pulados. Permissão POSIX real também exercitada com sucesso em sonda temporária. Casos, comandos, hashes e limitações em [TEST_PLAN §17](TEST_PLAN.md).
- **F-3 real:** comando pesado do TEST_PLAN §17, código 0, **2/2**, sem pulados, em 199,5 s. 65.539 entradas e arquivo de 4.294.967.297 bytes geraram ZIP64 automaticamente e foram restaurados com hashes conferidos; fixtures removidas.
- **Ambiente:** Ubuntu 26.04.1 x64; Node `24.22.0`; npm `11.19.1`; versões exatas de bibliotecas preservadas. Dependências preparadas por cópia temporária dos manifests sem o pacote de runtime Windows; nenhum manifesto/lockfile rastreado alterado.
- **Conclusão formal delimitada:** implementação e suíte automática do AC-13 concluídas na PoC. **AC-13 completo não aprovado:** validação com extratores do Windows 11 permanece pendente, indisponível neste sandbox Linux. Nenhum TC completo nem gate V0 aprovado.
- **Invariantes:** nenhuma alterada ou violada. Arquivos Markdown/YAML continuam canônicos, UUIDs e relações mantidos; corpos e anexos preservados byte a byte; backup com manifesto SHA-256 e restauração em pasta nova; OR, D-001 e progresso/null reaplicados pela suíte completa. D-012 respeitada com falhas e bloqueios explícitos.
- **Próximo passo PROPOSTO:** comprovar a extração Windows; depois submeter F-2.v1 para aprovação e, após ela, medir amostras comprimíveis/F-3 e propor S-1 antes de codificá-lo. Nomes reservados/finais com espaço ou ponto exigem decisão; Inbox depende de Q-01/Q-02/Q-04; prova nativa depende de Q-07/Q-08. Nenhuma dessas implementações foi iniciada.

## 30. Proposta concreta F-2.v1 para revisão

**Data:** 19/10/2026 · **Estado: PROPOSTO.** Continuidade do planejamento após o AC-13 automático, base Git `8606c9d2fb0d94252145a81413c9061b56008d89`.

- Criada [PROPOSTA_F2_V1](PROPOSTA_F2_V1.md): composição de 21 arquivos sintéticos, semente/versionamento, variantes store/deflate, protocolo MP e casos F-3 para investigar S-1.
- Explicitada a possível sobreposição entre razões de dados legítimos e de expansão. Sem intervalo válido, a evidência deve voltar para decisão; nenhum limite será inventado.
- Atualizados índice, TEST_PLAN §12.2/§18, OPEN_QUESTIONS, rastreabilidade e CHANGELOG. Código, dependências e contratos não alterados; invariantes preservadas.
- **PENDENTE:** aprovação da composição antes de gerar amostras e ZIPs de F-3; decisão sobre S-1 após medições. Sem nova execução de testes de software nesta etapa documental; resultados anteriores só são reutilizáveis com os mesmos insumos. Validação Windows do AC-13, decisões nativas/UX e Inbox continuam pendentes. Nenhum gate aprovado.

## 31. F-2.v1 aprovado, criado e medido; S-1 exige decisão

**Data:** 19/10/2026 · **Autorização:** “composição aprovada, pode seguir com a criação”, para a composição/experimentos da PROPOSTA_F2_V1. Aprovação posterior à proposta do §30; não decide S-1.

- **Implementado:** quatro módulos `poc/bench/f2-*.ts` e `poc/test/f2-compression.test.ts`; corpus determinístico com PNG/PDF válidos, relações/UUIDs e cinco registros LF/cinco CRLF; executor com processos isolados, checkpoints e criação exclusiva de saída; limpeza dos temporários próprios. Sem novas dependências ou mudanças no código do produto.
- **VERIFICADO:** suíte `npm test` (runtime/typecheck/build), **164/164**, código 0; duas gerações idênticas, corpus de 21 arquivos/22.021.291 bytes; **75/75** operações em 15 cenários ×5. Sessenta restaurações com inventário/hash dos corpos iguais e quinze recusas de corrupção antes da confirmação/destino. PNG/PDF também conferidos por Python zlib/pypdf estrito. Comandos, ambiente, hashes e limites em [TEST_PLAN §19](TEST_PLAN.md).
- **Resultado:** razões legítimas e de expansão iguais (até 1.028,393772 nos níveis 6/9). Não existe intervalo no corpus para o critério vigente de S-1. Alternativas PROPOSTAS em [PROPOSTA_AC07_LIMITES §6](PROPOSTA_AC07_LIMITES.md); requer decisão da proprietária antes de alterar contrato/implementar.
- **Preservado:** Markdown/YAML canônico, UUID v4, OR por tags, D-001, corpo Markdown, progresso/null, manifesto SHA-256 e restauração em pasta nova; D-012 respeitada. Sem código nativo/V1, limite S-1 ou gate aprovado. Validação Windows do AC-13 permanece pendente.

## 32. S-1 explícito e alternativa A — 19/10/2026

**DECIDIDO:** política A (D-016). **VERIFICADO:** filtro por entrada, inclusive manifesto, antes de descompressão; comparação exata BigInt; política copiada antes de callbacks; exportador store simétrico. 172/172 testes e 11/11 casos funcionais ([TEST_PLAN §20](TEST_PLAN.md)).

**PROPOSTO:** candidato 128:1, com recusas legítimas documentadas em PROPOSTA_AC07_LIMITES §6.1. **PENDENTE:** aprovação numérica e ativação padrão; hoje a opção precisa ser explícita. AC-07 permanece parcial. Nenhum aplicativo nativo/GUI criado; pendências Windows/Inbox preservadas.

## 33. AC-13: extração pelos componentes do Windows 11 — 19/10/2026

**Contexto:** retomada após o trabalho registrado nos §29–§32 (feito pelo CodeRabbit em sandbox Linux). Estado recebido conferido: base `54a0cf1`, árvore limpa, `npm test` no Windows 11 com runtime pinado `24.22.0`: 172/172. Executada a pendência PROPOSTA nos §5/§29, sem mudança de produto ou contrato.

- **Implementado:** `poc/bench/ac13-windows.ts`, executor explícito (fora de `npm test`). Exportador, restaurador e dependências não alterados.
- **VERIFICADO:** 12/12 extrações (clássico com nome não ASCII, ZIP64 forçado, 65.539 entradas, arquivo de 4.294.967.297 bytes) × (`Expand-Archive`, `tar.exe`, `Shell.Application`/zipfldr), com caminhos, tamanhos e SHA-256 iguais ao manifesto. Evidência em [TEST_PLAN §21](TEST_PLAN.md) e `poc/bench/results/ac13-windows-2026-10-19.jsonl`.
- **PENDENTE:** abertura manual no Explorador do Windows 11 (interação da proprietária). AC-13 completo, TC-13–TC-15 e gate V0 não aprovados. Esta evidência não dá motivo para reabrir DQ-07/Z-B.
- **Correção de registro:** o cabeçalho e o §1 citavam 152/152; a contagem vigente é 172/172 (§32).
- **Continua dependendo da proprietária:** valor numérico de S-1 (128:1 proposto, D-016); regras de nomes reservados e finais com espaço ou ponto; Q-01/Q-02/Q-04 para a Inbox; Q-07/Q-08 para a prova nativa.

## 34. CI no GitHub Actions — 19/10/2026

**Autorização:** pedido da proprietária para criar o arquivo de CI, registrar, abrir a PR e conferir o primeiro run. Ferramenta de verificação; não muda produto, stack ou contratos.

- **Arquivo:** `.github/workflows/ci.yml`. Gatilhos: `pull_request`, `push` na `main` e `workflow_dispatch`. Permissão `contents: read`. Job único em `windows-latest` (plataforma prioritária, DQ-01), timeout de 20 min: `actions/checkout@v5`, `actions/setup-node@v5` (Node `24.22.0`, cache npm pelo `poc/package-lock.json`), `npm ci --no-audit --no-fund` e `npm test` em `poc/`. Os scripts usam o runtime pinado em `node-win-x64`.
- **Fora do CI:** `ATLAS_AC13_HEAVY=1` e `bench/ac13-windows.js --heavy` (~9 GB e dezenas de minutos), executores de bench e a abertura manual no Explorador. O CI não substitui essas evidências nem aprova AC, TC ou gate.
- **Primeiro run (39294547302):** FALHOU, 161/172. Causa: no runner, `TEMP` usa nome curto 8.3 (`C:\Users\RUNNER~1\...`); exportador e restaurador relatam o destino pelo caminho real (`runneradmin`), conforme o contrato, mas 11 testes de `backup-export` e `backup-restore` comparavam com o caminho não resolvido. Não é defeito do produto.
- **Correção (commit `67f2ff0`):** os helpers `workspace()` desses dois arquivos de teste passam a usar `realpath(mkdtemp(...))`. Nenhum código de `src/` alterado. Reproduzido localmente com `TEMP`/`TMP` apontando para um caminho 8.3: 161/172 antes e **172/172** depois; `npm test` normal, 172/172.
- **Segundo run (39295018674, commit `67f2ff0`):** PASSOU. `npm ci` instalou 19 pacotes; runtime `v24.22.0`; typecheck/build e **172/172** testes, 0 falhas/pulados. Este registro documental não altera o código verificado por esse run.

## 35. Aplicativo V1 (Electron) — 19/10/2026

**Autorização:** a proprietária pediu para retomar a criação do projeto e delegou as decisões e autorizações pendentes (“pode implementar direto da forma que pensar ser melhor”). Decisões registradas como D-017 a D-027 em [DECISIONS](DECISIONS.md). Branch `feat/v1-app-foundation`, empilhada sobre as PRs #2 e #3; o merge delas foi bloqueado pela política de permissões da sessão e fica com a proprietária.

### 35.1 Implementado

- **Stack (D-017):** Electron `44.9.0`, que embute Node `24.22.0`; React `19.3.1`, Vite `8.3.4`, TypeScript `7.0.2`, esbuild `0.28.2`; Lucide e Inter (`@fontsource`, OFL). O renderer roda com `contextIsolation`, `sandbox` e CSP, sem `nodeIntegration`, e acessa o disco só pela API IPC tipada do preload.
- **Núcleo (`app/src/vault`):** cópia de `poc/src` no commit `2dc0726` (persistência, adaptador e backup verificados), com quatro mudanças:
  - `record.ts` grava bytes completos e deixa a validação de campos para o domínio, porque a captura pode ter `title: null`;
  - padrão S-1 128:1 aplicado pelo serviço (D-018);
  - recusa de nomes reservados, finais com espaço ou ponto e `<>:"|?*` (D-019) em `manifest.ts`;
  - módulos experimentais da PoC removidos.
- **Repositório (`repository.ts`):** valida todas as entidades do schema 1 (D-020).
  - Arquivo inválido gera diagnóstico e não é regravado; temporários e manifestos são listados, nunca apagados.
  - Referências ausentes geram aviso; UUID e `note_type` são imutáveis.
  - Edição só de YAML anexa os bytes originais do corpo (D-006).
  - Conflito externo é devolvido com a versão do disco, sem sobrescrever.
- **Inbox (`inbox.ts`):** manifesto `inbox/.txn_{id}.json`, com as etapas INIT → TMP_WRITTEN → FILES_RENAMED → INBOX_UPDATED.
  - Promoção por hard link, sem substituir destino alheio; cópia exclusiva como alternativa.
  - Recuperação no arranque.
  - Se nenhum destino foi promovido e faltam temporários, a conversão é descartada e a captura continua pendente (D-023). Destino com conteúdo divergente bloqueia e mantém o manifesto.
- **Domínio (`src/domain`):** validação, OR, progresso (D-003 + D-022), D-001, links relativos e backlinks com markdown-it, além de `success_criteria` e defaults de criação (D-020).
- **Interface:** sidebar com Visão geral (hub e captura rápida), Inbox, Atlas, Projetos (filtro), Tarefas, Notas, Organização e Configurações e backup (D-025). Inclui:
  - salvamento explícito e Ctrl+S, com estados salvo, alterado, salvando, erro e conflito;
  - fechar com alterações pendentes oferece Salvar, Descartar ou Cancelar;
  - atalhos Alt+1–6;
  - tema que segue o SO, com escolha manual Light/Dark (D-026);
  - prévia de impacto ao retirar tag de grupo, aviso de títulos duplicados e seção “Sem grupo”;
  - nota permanente a partir de outra nota (D-008), seletor de links, backlinks, links quebrados marcados e anexos em `assets/` (D-027);
  - exportação com inventário e restauração em pasta nova, com relatório.
- **Empacotamento:** `electron-builder` `26.15.3`, NSIS x64 sem assinatura de código. `Atlas de Interesses Setup 0.1.0.exe` tem 107,6 MB; o executável desempacotado ocupa 371,7 MB.
- **CI:** novo job `app-tests` em `.github/workflows/ci.yml` (`npm ci`, `npm test`, `npm run e2e` em `windows-latest`). Ainda não executado no GitHub.

### 35.2 Verificado (Windows 11 Pro 26200, x64, NTFS)

Comandos executados em `app/`. Resultados detalhados em [TEST_PLAN §22](TEST_PLAN.md).

- `npm ci`: código 0, 314 pacotes, binário do Electron baixado pelo `postinstall`.
- `npm test` (runtime, typecheck do processo principal e do renderer, compilação e `node --test`): código 0, **154/154**.
- `npm run build` e `node e2e/journeys.mjs`: **9/9 jornadas**.
- Mesmo E2E com `ATLAS_E2E_EXE` no executável empacotado: **9/9**.
- Medições da D-027 em 3 execuções:
  - indexação de 1.000 registros: 713–979 ms (meta ≤ 2 s);
  - salvamento, mediana: 5,5–7,1 ms (meta ≤ 200 ms);
  - RSS: 73–74 MiB.

### 35.3 Pendente / limites

- **Merge:** PRs #2 e #3 e esta branch dependem de merge pela proprietária. O job `app-tests` só roda no GitHub depois do push.
- **Ações humanas:**
  - abertura manual do AC-13 no Explorador;
  - teste de usabilidade com a proprietária (Q-08);
  - assinatura de código do instalador.
- **Não executado:**
  - E2E de diálogos nativos (escolher pasta, salvar ZIP, anexar). Esses fluxos são cobertos pelo serviço (`test/service.test.ts`) e pelo motor de backup; o E2E abre o vault por `--vault`;
  - falta de espaço real, permissões NTFS negadas na interface e queda de energia;
  - leitores de tela e auditoria de contraste de cada combinação da interface.
- **Fora da V1:** busca global (V2), canvas (V3), grafo (V4), sync e Android (V5).
- **Gate V0 e aceite da V1:** dependem do aceite humano da proprietária. Os testes acima são evidência e não substituem esse aceite (D-012).

## 36. V2 — busca global e catálogo de fontes — 19/10/2026

**Autorização:** a proprietária pediu para retomar e seguir para o próximo passo, com decisões delegadas. Decisão D-028. Branch `feat/v2-search`, a partir da `main` em `3c0be80`, que já inclui as PRs #2, #4 e #5.

- **Implementado:**
  - `app/src/domain/search.ts`: índice puro e descartável, consulta com frase e exclusão, filtros combináveis, trechos e catálogo de fontes derivado;
  - `app/src/renderer/screens/Search.tsx`: abas Busca global e Catálogo de fontes;
  - entrada Busca na sidebar e atalhos Ctrl+K e Alt+7.
- **Sem mudança:** schema, contratos de vault, dependências.
- **VERIFICADO (Windows 11 Pro 26200):**
  - `npm test`: **160/160**, sendo 6 novos em `search.test.ts`;
  - `npm run build` e `node e2e/journeys.mjs`: **10/10 jornadas**. A nova jornada 8 cobre busca sem acento, frase exata no corpo, exclusão, filtro sem resultado e catálogo com a fonte gravada na nota;
  - desempenho com 1.000 notas de cerca de 1 KB: construção do índice em 43 ms e consulta em 4,4 ms.
- **Pendente:**
  - validação de usabilidade com a proprietária;
  - E2E no executável empacotado não repetido nesta etapa (o CI roda o E2E no build);
  - busca fuzzy e entidade `Source`, adiadas pela D-028.
- **Revisão do CodeRabbit na PR #6** (três comentários, todos procedentes e corrigidos):
  - frase com aspa ainda aberta já é buscada como frase, enquanto a pessoa digita;
  - Ctrl+K com a Busca aberta devolve o foco ao campo;
  - o texto combinado para a exclusão é calculado uma vez por índice, e a varredura só roda quando há `-termo`.
  O `build:test` agora limpa `dist-test/`: antes, testes compilados de outras branches podiam continuar sendo executados. `npm test`: 160/160; E2E 10/10, com a frase incompleta e o Ctrl+K.
- **Próximo no roadmap:** V3, mapa visual sobre as entidades existentes, com zoom/pan, filtros, retorno ao contexto e alternativa em listas.

## 37. V3 — mapa visual — 19/10/2026

**Autorização:** a proprietária pediu para seguir para a V3 com as mesmas regras. Decisão D-029. Branch `feat/v3-map`, criada sobre `feat/v2-search` (PR #6 ainda sem merge no momento da criação).

- **Implementado:**
  - `app/src/domain/map.ts`: layout radial determinístico, somente leitura, e lista equivalente;
  - `app/src/renderer/screens/Map.tsx`:
    - SVG com zoom e pan por roda, arraste, botões e teclado;
    - nós focáveis com dica, seleção com destaque e painel;
    - filtros e “Ver como lista”;
  - histórico de navegação com `BackButton` no Item, na Nota e no Grupo;
  - entrada Mapa na sidebar e atalho Alt+8.
- **Sem mudança:** schema, contratos e dependências.
- **VERIFICADO (Windows 11 Pro 26200):**
  - `npm test`: **163/163**, sendo 3 novos em `map.test.ts`: posições, arestas de pertencimento, item compartilhado no anel interno, Sem grupo, arquivados, determinismo, ausência de sobreposição com 60 itens, filtros, notas e equivalência com a lista;
  - `npm run e2e`: **11/11 jornadas**. A nova jornada 9 confere:
    1. um nó por item;
    2. painel com os dois grupos;
    3. abrir o item e voltar com o mesmo zoom e a mesma seleção;
    4. lista com o item nos dois grupos;
    5. SHA-256 de todos os arquivos do vault igual antes e depois do uso do mapa (dados íntegros).
  - **Inspeção visual:** vault fictício com 4 grupos e 30 itens, nos temas Light e Dark. O ajuste inicial enquadra todo o mapa; os rótulos dos itens aparecem a partir de 55% de zoom ou na seleção.
- **Pendente:**
  - usabilidade com a proprietária;
  - leitor de tela no SVG (os nós têm rótulo acessível; não foi testado com NVDA ou Narrador);
  - vault com centenas de itens por grupo, que forma arcos externos e não foi medido visualmente;
  - E2E no executável empacotado não repetido nesta etapa.
- **Próximo no roadmap:** V4, grafo de links e relações derivadas, claramente distinguidos, com limites para conjuntos grandes.

## 38. V4 — grafo de conhecimento — 19/10/2026

**Autorização:** a proprietária pediu para seguir para a V4 com as mesmas regras. Decisão D-030. Branch `feat/v4-graph`, criada sobre `feat/v3-map`; as PRs #6 e #7 ainda estavam sem merge.

- **Implementado:**
  - `app/src/domain/graph.ts`: relações persistidas e derivadas com explicação, links quebrados, foco e profundidade, limite de nós, layout em anéis (com foco) ou por forças determinístico (global);
  - `app/src/renderer/screens/Graph.tsx`:
    - zoom e pan por mouse e teclado;
    - foco por busca e “Focar aqui”;
    - profundidade de 1 a 3;
    - tipos de relação com legenda de traço;
    - painel de nó e de aresta com a explicação;
    - aviso de limite e “Ver como lista”;
  - “Ver no grafo” no Item e na Nota; entrada Grafo na sidebar e Alt+9.
- **Sem mudança:** schema, contratos e dependências.
- **VERIFICADO (Windows 11 Pro 26200):**
  - `npm test`: **166/166**, sendo 3 novos em `graph.test.ts`;
  - `npm run e2e`: **12/12 jornadas**. A nova jornada 10:
    1. abre o grafo pela nota;
    2. confere o painel com a explicação do link persistido;
    3. na lista, confere “Link no texto” como persistido e a origem na captura como derivada;
    4. confere que o SHA-256 de todos os arquivos do vault não muda;
  - layout de 150 nós (de 306 candidatos) em 126 ms;
  - **inspeção visual:** vault fictício com 4 projetos, 8 tarefas, 18 notas e links quebrados; ajuste a 38%, com os tracejados distinguíveis.
- **Pendente:**
  - usabilidade com a proprietária;
  - leitor de tela no SVG;
  - rótulos de nós ocultos abaixo de 50% de zoom (aparecem na dica, na seleção e ao aproximar);
  - E2E no executável empacotado não repetido nesta etapa.
- **Roadmap:** V2 a V4 implementadas. A V5 (sync, offline, autenticação, conflitos, backup automático e Android) exige **arquitetura explícita** antes de código: escolha de serviço de sincronização, modelo de conflitos e conta. Será proposta em documento próprio antes de implementar.
