# Plano de testes da V0/V1

**Estado:** cenários completos de V0/V1 permanecem PLANEJADOS e nenhum TC completo está aprovado. A PoC cobre subcasos de TC-01–09, TC-16 e TC-22; evidências parciais estão nas seções 4–8.

A proprietária confirmou que a PoC e testes ainda não existiam antes da autorização atual. Os IDs desta edição foram definidos para rastreabilidade; não são reconstrução dos supostos 13 testes do handoff antigo. A PoC de um registro não é aplicativo nem suíte do produto.

## 1. Camadas e pré-condições

- **Domínio:** regras puras com dados sintéticos.
- **Arquivo:** bytes reais em diretório temporário isolado.
- **Integração:** operações em vários arquivos, falhas e reconstrução de índices.
- **Nativo:** aplicativo real, permissões e ciclo de vida no SO escolhido.
- **Manual/aceite:** jornadas e UX com a proprietária.

Antes de cada etapa, fechar somente os contratos de produto dos quais ela depende, implementar runner e registrar versões/comandos. A prova delimitada de um registro não depende do fechamento de Q-01–Q-03. O vault de `docs/examples` é ilustrativo; usar dados sintéticos em diretório temporário. Não testar em dados pessoais.

## 2. Cenários e oráculos

| ID | Tema | Preparação | Ação | Resultado esperado | Camada |
| --- | --- | --- | --- | --- | --- |
| TC-01 | Frontmatter e tipos | Arquivo com YAML válido, inválido, chave duplicada e versão desconhecida | Ler/validar; tentar salvar sem correção | Diagnóstico preserva original; tipos reais, null e listas não viram strings | Arquivo |
| TC-02 | Identidade estável | Item persistido com UUID v4 | Renomear título, reiniciar e restaurar backup | Mesmo UUID e caminho; relações preservadas | Domínio/arquivo |
| TC-03 | Colisão de UUID | Destino já existente com conteúdo distinto | Tentar criar novo registro no mesmo caminho | Recusar substituição e manter hash original | Arquivo |
| TC-04 | OR e renomeação de tag | Dois grupos compartilham tag; item e item sem tags | Consultar grupos, renomear tag e reconstruir índice | Um arquivo em duas vistas; sem tags acessível; consumidores não regravados | Domínio/arquivo |
| TC-05 | Progresso | Projetos com todo/done/canceled e tarefa de outro projeto | Calcular tasks/manual/none e concluir última tarefa | 50%, null sem elegíveis, isolamento por projeto; status do projeto preservado | Domínio |
| TC-06 | Round-trip D-006 | Corpos UTF-8, CRLF/LF, espaços, fences e sem newline final | Editar somente YAML e comparar bytes e SHA-256 do corpo | Corpo exatamente igual; não comparar apenas texto normalizado | Arquivo |
| TC-07 | Links e backlinks | Notas com link relativo, âncora, URL e exemplos em código | Indexar, apagar cache e reiniciar | Relações locais válidas; código/URLs não viram backlinks locais | Domínio/arquivo |
| TC-08 | Renomeação e aliases | Notas com títulos duplicados e links por UUID no caminho | Renomear uma e reconstruir índice | Destino correto; seletor desambigua; alias não muda identidade | Domínio/arquivo |
| TC-09 | Nova permanente | Nota work/reading com conteúdo e contexto | Criar permanente e reiniciar | Novo UUID; contexto null; origem byte a byte intacta; backlink reconstruído | Arquivo/aceite |
| TC-10 | Conversão Inbox | Captura pending; destinos de Item, Task e Note | Converter cada tipo; projeto com tarefas; repetir clique | Origem preservada; principal correto; nenhuma duplicata | Integração |
| TC-11 | Falha em transação | Fixture de conversão com vários outputs | Interromper cada write/rename e antes/depois de atualizar captura; recuperar duas vezes | Estado consistente ou diagnóstico recuperável; nunca processed sem resultados | Integração |
| TC-12 | Manifesto/temporário inválido | Manifesto alterado, caminho externo, hash divergente e órfão | Executar reconciliação | Não sobrescrever nem apagar dados alheios; preservar evidência de conflito | Integração |
| TC-13 | Backup restaurável | Vault fictício com registros canônicos (inclusive arquivados), anexos binários, conteúdo não canônico, nomes Unicode e corpos CRLF/LF | Exportar fora do vault, com decisão explícita sobre o não canônico; restaurar em pasta nova | Manifesto M-B exato (inventário, contagem, tamanhos, hashes); cópia independente com bytes iguais; índices reconstruídos; relatório; vault ativo não alterado nem substituído (AC-01, AC-02, AC-10, AC-14, AC-19) | Integração |
| TC-14 | Backup corrompido/inseguro | ZIP com hash ou tamanho errado, extra, ausente, duplicado (inclusive por caixa ou forma Unicode), traversal, caminho absoluto, link, método não aceito, criptografado, manifesto inválido, acima dos limites ou com cabeçalho que declara menos bytes | Tentar restaurar | Recusar antes de disponibilizar; nenhuma escrita fora do destino, comprovada por inspeção do sistema de arquivos; vault ativo inalterado (AC-06 a AC-08, AC-13, AC-15 a AC-17) | Integração |
| TC-15 | Consistência do backup | Transação pendente, link no vault, escrita concorrente injetada de forma determinística, falha durante a geração do ZIP | Solicitar backup | Bloquear ou abortar com diagnóstico; nenhum arquivo com o nome final; vault inalterado (AC-03 a AC-05, AC-09, AC-11) | Integração |
| TC-16 | Conflito externo | Editor com revisão antiga; arquivo alterado por outro processo | Salvar edição do app | Detectar conflito; preservar conteúdo local e externo | Integração/nativo |
| TC-17 | Permissão e fechamento | Vault selecionado; edição não salva; permissão revogada/disco cheio simulado | Salvar, fechar/cancelar, reabrir app real | Sem falso salvo; escolha de fechamento respeitada; dados recuperados | Nativo |
| TC-18 | Arquivamento e referência | Projeto/tag/nota referenciados; tarefas arquivadas | Arquivar, filtrar, abrir link e recuperar | Referências válidas; regra de progresso Q-03 aplicada; estado explícito | Domínio/aceite |
| TC-19 | Movimentação de arquivo | Nota referenciada por várias notas | Mover por ferramenta externa e, se suportado, pela UI | Diagnosticar quebra; reparo explícito recuperável; sem promessa de hash igual em edição de links | Integração |
| TC-20 | Evolução do schema | Campos desconhecidos e schema futuro | Editar metadados ou tentar abrir em modo editável | Preservar campos compatíveis; impedir downgrade silencioso | Arquivo |
| TC-21 | Empacotamento e medição | SO/fixture/runtime definidos em Q-07 | Instalar/abrir binário, medir início, RAM e indexação | Medições registradas com método; gates definidos antes do aceite | Nativo |
| TC-22 | Contexto de Note | work sem item, reading independente, permanent com item | Validar/criar notas de cada tipo | Rejeitar work inválida e permanent contextual; aceitar reading null | Domínio |
| TC-23 | Acessibilidade e telas | Protótipo/app com temas e estados | Teclado, foco, janela estreita, contraste e leitura de erros | Ações acessíveis; texto/ícone complementam cor; problemas registrados | Manual |
| TC-24 | Jornadas completas | Vault fictício limpo | Capturar → projeto → tarefas → notas → permanente → backup → restaurar | Fluxo íntegro após reiniciar; aceite registrado pela proprietária | Aceite |

### Contratos confirmados: critérios planejados de TC-01

Os critérios abaixo complementam o cenário de validação de tipos/campos; **continuam planejados, não implementados e não executados**:

- Item.status aceita exatamente `backlog`, `planned`, `active`, `paused`, `completed`, `archived`; `canceled` é estado de Task, não de Item.
- Item.priority e Task.priority são opcionais; quando informadas, o enum é `low`, `medium`, `high`. Não ampliar com `urgent`.
- Group.sort_order e Task.sort_order devem estar presentes como inteiros; exemplos com `0` não estabelecem default para chave ausente.
- InboxCapture.capture_kind deve estar presente com um dos sete valores `thought`, `link`, `task`, `project`, `course`, `note`, `undecided`; o último não estabelece default automático.

## 3. Critérios de aprovação

Falhas de perda de dados, sobrescrita silenciosa, UUID instável, backup não restaurável e falso estado salvo impedem aprovação. Simulação de Node/disco não aprova fechamento nativo. Teste manual documentado não substitui automação de invariantes críticas.

Q-03 precisa ser fechada antes de TC-05/18 finais; Q-04 antes de TC-11/12; Q-05 antes de TC-13–15 (parcialmente formalizada em 18/10/2026 por D-013; para aprovar TC-13–15 faltam: os valores dos limites de segurança, que dependem da medição do §12 (*desde 18/10/2026, decididos pela D-015, exceto a razão de compressão; falta implementá-los e executar o AC-07*; atualização do bloco 2: capacidade é verificada em execução, sem valor fixo; redação do bloco 1: “os valores dos limites, que dependem de DQ-03 e da medição do §12”); a execução de todos os critérios AC aplicáveis, inclusive AC-15 a AC-19; AC-13, porque a política ZIP64 Z-B foi formalizada em 18/10/2026 mas a compatibilidade não foi verificada; a canonicidade de configuração e anexos da Q-10 (decidida pela D-014 no bloco 2, sem testes); e o critério nativo AC-12. Redação anterior: “faltam valores de limites e ZIP64 da Q-07”); Q-07 antes de TC-21; Q-08 antes de aceite de navegação. Provas exploratórias podem comparar alternativas, com resultados identificados como tal.

## 4. Evidência da primeira PoC, antes das regras D-003/D-004

**Data do ambiente:** 17/10/2026 · **Ambiente:** Windows x64, Node local 24.22.0, npm 10.8.2. **Comando final:** `npm test` dentro de `poc/`. Typecheck e build TypeScript passaram; 11 testes passaram e 0 falharam.

| TC | Subcaso comprovado | Limite; TC completo continua pendente |
| --- | --- | --- |
| TC-01 | Frontmatter válido, YAML inválido, chave duplicada e validação do envelope reduzido | Não cobre schema futuro nem todos os tipos/campos |
| TC-02 | Alterar título, reler e manter UUID v4 | Não cobre reinício do app ou restauração de backup |
| TC-03 | Criação exclusiva recusa colisão e preserva bytes existentes | Não cobre matriz de SO/volumes ou corrida entre processos |
| TC-06 | Corpos LF/CRLF com UTF-8, espaços, linhas vazias, fence e sem newline final; comparação byte a byte e SHA-256 | Não cobre todas as codificações/casos do vault |
| TC-16 | Alteração externa durante staging detectada na conferência pré-rename; externo e rascunho local preservados | Janela após a conferência e antes do rename permanece; não é compare-and-swap |
| TC-17 | Nenhum | Falhas sintéticas locais não comprovam permissão, GUI ou I/O nativo |

Os hashes medidos dos corpos LF e CRLF, execução inicial com falha e correção da fixture, limitações e versões estão em [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md). Nenhum TC completo recebe PASS por esses subcasos.

## 5. Evidência das regras puras, antes da renomeação no disco

**Data do ambiente:** 17/10/2026 · **Comando:** `npm test` dentro de `poc/` · **Resultado final:** typecheck/build passaram; 24 testes passaram, 0 falharam. A suíte inclui os casos de persistência da etapa anterior, novamente executados.

| TC | Subcaso comprovado nesta etapa | Parte ainda não demonstrada |
| --- | --- | --- |
| TC-04 | Participação por OR de UUIDs: basta uma tag; grupo/item vazio; IDs diferentes mesmo com rótulo igual; Item em vários Groups; nenhuma mutação | Rename de Tag no arquivo sem reescrever consumidores, reindexação e vistas com o mesmo registro |
| TC-05 | null sem tarefas elegíveis; canceled excluída; abertas=0; todas done=100; mistura dos quatro status; isolamento por projeto/avulsas; percentual fracionário sem arredondamento; dados e status não mutados | Seleção e efeito de tarefas com `archived_at`, manual/none, persistência/UI e encerramento automático de projeto |

As fixtures usam recortes experimentais, sem `archived_at`; Q-03 segue pendente. Nenhum TC completo recebe PASS por estes subcasos. Os limites da gravação e a ausência de compare-and-swap atômico permanecem como registrados na seção 4 e no README da PoC.

## 6. Execução parcial: renomeação de Tag e índice reconstruído

**Data do ambiente:** 17/10/2026 · **Comando:** `npm test` dentro de `poc/` · **Resultado final:** typecheck/build passaram; 26 testes passaram, 0 falharam. Baseline anterior reproduzida antes das alterações: 24 testes passaram, 0 falharam.

| Parte de TC-04 | Evidência | Limite |
| --- | --- | --- |
| Regra OR em memória | Interseção por UUID, nomes independentes, Item em dois grupos e ausência de mutação | Não demonstra persistência ou renderização |
| Renomeação isolada no disco | UUID/caminho estáveis; novo título relido; corpo Tag bytes/hash igual; bytes/hashes de Groups e Items e `tag_ids` inalterados | Fixture reduzida; sem regra nova de aliases |
| Reconstrução do índice | Leitura dos arquivos após descartar índice anterior; mapas novos; título pelo mesmo UUID; mesmos Item ID nos dois grupos; Item sem correspondência segue geral | Fixture válida apenas; sem política geral para inválidos/referências ausentes/arquivados |
| Exibição em interface | Nenhuma | GUI fora do escopo, não demonstrada |

Teste distingue UUID de igualdade de títulos: duas Tags de IDs diferentes começam com o mesmo título; somente uma é referenciada pelos grupos. A reconstrução segue os `tag_ids` da fixture sem copiar arquivo de Item. TC-04 completo continua pendente.

## 7. Execução parcial: links Markdown e backlinks

**Data do ambiente:** 18/10/2026 · **Parser:** markdown-it 15.0.3, CommonMark, `html:false`, `linkify:false` · **Comando:** `npm test` · **Resultado final:** typecheck/build passaram; 29 testes passaram, 0 falharam. Baseline de 26 testes reproduzida antes das alterações.

| TC | Subcaso comprovado | Limite; cenário completo permanece pendente |
| --- | --- | --- |
| TC-07 | Links inline/reference para Notes canônicas; resolução por caminho/UUID; backlinks reconstruídos; code, URL, anchor-only, destino vazio, imagem e destinos não-Nota/ausente/fora diagnosticados ou excluídos; hashes de todos arquivos iguais após indexação | Sem restart de app, outros dialetos Markdown, validação de heading, concorrência, watcher ou UI |
| TC-08 | Títulos duplicados continuam distintos por UUID/path; rename do título do destino mantém caminho do link, corpo e backlinks; rebuild usa mapas novos | Sem seletor/alias/UI e sem mover arquivo |

A extração usa tokens `link_open`/`href`, não regex textual. Destinos fora da raiz não são consultados; cada componente interno é verificado sem seguir symlink; diagnósticos preservam arquivos. A fixture exige caminhos canônicos e notas válidas; Nota inválida interrompe a construção. Sintaxe/lacunas estão em [poc/README.md](../poc/README.md). Nenhum TC completo está aprovado.

## 8. Execução parcial: contexto D-001 e nova permanente D-008

**Data do ambiente:** 18/10/2026 · **Comando:** `npm test` dentro de `poc/` · **Resultado final:** typecheck/build passaram; 37 testes passaram, 0 falharam. Baseline de 29 testes reproduzida antes das alterações. Sem dependências novas.

| TC | Subcaso comprovado | Limite; cenário completo permanece pendente |
| --- | --- | --- |
| TC-22 | Função pura: work com UUID aceito e com null/ausente/não UUID rejeitado; reading com null ou UUID aceito; permanent só com null; Item desconhecido rejeitado quando o conjunto de Items é informado; tipo desconhecido rejeitado; sem mutação | Sem índice de Items integrado, sem criação/edição de Notas work/reading e sem UI |
| TC-09 | Nova permanente a partir de work e de reading: UUID novo, `context_item_id: null`, origem com bytes e SHA-256 iguais, nenhum outro arquivo alterado, um arquivo novo; backlink reconstruído do disco com índice e storage novos; recusas sem gravação (origem permanent/inexistente, UUID repetido, id inválido, título vazio, link de origem não interpretável); colisão concorrente sem sobrescrita; falha de criação sem sucesso aparente | Sem restart do aplicativo, editor, GUI ou cache persistente; envelope reduzido sem timestamps/tags (Q-01) |

Duas mutações temporárias confirmaram que os testes falham sem a guarda do link de origem e com contexto copiado da origem; o código foi restaurado antes da execução final. Detalhes em [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) §12. Nenhum TC completo está aprovado.

## 9. Correção autorizada: ordem de operação de D-003

**Data do ambiente:** 18/10/2026 · **Comando:** `npm test` · **Resultado final:** typecheck/build passaram; 37 testes passaram, 0 falharam. `calculateProjectProgress` passou a calcular `100 * done / eligible`, como na documentação oficial §5.3; os oráculos fracionários de TC-05 usam a mesma ordem. A evidência da seção 5 descreve a ordem anterior e é preservada como histórico. TC-05 completo permanece pendente (Q-03, manual/none, persistência, UI). Ver [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) §13.

## 10. Critérios planejados de backup e restauração (Q-05 / D-013)

**Estado:** PLANEJADOS; nenhum implementado ou executado, exceto os subcasos registrados no §13 (incremento 1 da PoC, 18/10/2026), no §14 (incremento 2), o AC-19 no §15 (incremento 3), o AC-07 no §16 e o AC-13 automático no §17. Fonte das regras: [VAULT_CONTRACT §7](VAULT_CONTRACT.md), D-007, D-013 e ESPECIFICACAO_V1 F-07. Revisão de 18/10/2026 dos critérios AC-01 a AC-12 de [PROPOSTA_Q05_BACKUP](PROPOSTA_Q05_BACKUP.md) §5, que permanecem lá como versão anterior; esta seção é a versão vigente. Um procedimento documentado não aprova cenário algum.

| ID | Fonte | Preparação | Ação | Resultado observável |
| --- | --- | --- | --- | --- |
| AC-01 | D-007; D-013 (M-B, E-C, P-6); D-014; F-07 | Fixture sintética: pastas canônicas, registros arquivados, anexos binários em `assets/` com subpasta, `settings.yml` com `settings_version` e uma chave desconhecida, CRLF/LF, nomes Unicode, um arquivo não canônico, uma pasta de cache de outra ferramenta, arquivos de sistema (`Thumbs.db`, `desktop.ini`, `.DS_Store`) na raiz e dentro de `assets/`, uma pasta vazia não canônica e um `.tmp-{UUID}.md` órfão; preferências do dispositivo registradas fora do vault (bloco 2; redação anterior: “um cache reconstruível” dentro do vault) | Exportar, escolhendo “incluir” para o não canônico e para o grupo de arquivos de sistema | Inventário **exato**: a lista de incluídos é igual ao conjunto esperado e a de excluídos (`.tmp-{UUID}.md`) igual ao esperado, cada um com motivo; a pasta de cache de outra ferramenta aparece como não canônica e nunca é excluída em silêncio; arquivos de sistema aparecem como grupo; a pasta vazia é listada sem entrar no manifesto; `settings.yml` incluído com a chave desconhecida preservada; preferências do dispositivo ausentes do ZIP; `.tmp-{UUID}.md` órfão não apagado (hash igual); `file_count`, `size` e `sha256` de cada entrada iguais aos bytes de origem; manifesto sem `manifest.json`, ordenado e sem `path` repetido; `manifest_version` e `created_at` UTC presentes; ZIP final só existe após verificação. **Extensão (A-01, A-09; PLANEJADA):** o `.tmp-{UUID}.md` órfão é reconhecido como temporário; um `settings.yml` inválido ou com `settings_version` não suportado bloqueia a exportação; sem `settings.yml`, a exportação prossegue |
| AC-02 | D-007; D-013 (P-8, DQ-15–DQ-17); D-014; F-07 | ZIP do AC-01 | Restaurar em pasta nova criada pelo aplicativo | Bytes e SHA-256 de cada arquivo iguais aos da origem; mesmos UUIDs e caminhos; pastas canônicas, incluindo `assets/`, presentes mesmo vazias; índices de Tag/Group/Item e de links/backlinks reconstruídos iguais; versão do schema relatada como derivada dos registros; relatório no estado Verificado, com os campos do VAULT_CONTRACT §7.7 item 7 e sem conteúdo de corpo; relatório não gravado no destino; vault ativo com hashes iguais e não substituído nem ativado |
| AC-03 | D-007; D-013 (E-C, DQ-20) | Vault com `inbox/.txn_*.json` pendente | Exportar | Exportação recusada com diagnóstico (captura e estágio); nenhum ZIP temporário ou final remanescente; vault inalterado. **Extensão (DQ-20), bloqueada até existir o mecanismo de recuperação da Inbox (VAULT_CONTRACT §4, PROPOSTO):** após uma recuperação bem-sucedida, o inventário é refeito e a exportação prossegue; com recuperação incompleta, continua bloqueada; a transação nunca é cancelada automaticamente |
| AC-04 | D-013 (C-A); TC-15 | Adapter de armazenamento com ponto de injeção determinístico entre a primeira leitura de um arquivo escolhido e a verificação final (mesmo padrão de subclasse da PoC; sem temporizadores nem `sleep`) | Exportar em seis variantes: alterar conteúdo com mesmo tamanho; alterar tamanho; remover o arquivo; criar arquivo novo numa pasta já inventariada; criar arquivo novo numa pasta nova, fora do inventário inicial (A-07); substituir o arquivo por link | Em todas: aborto com diagnóstico que identifica o caminho; nenhum arquivo com o nome final; ZIP temporário fora do vault; nenhum outro arquivo do vault alterado pela exportação. Variante adicional documentada como **limite conhecido**, não falha: alterar e restaurar os mesmos bytes entre as leituras não é detectado |
| AC-05 | D-013 (C-A, DQ-22); F-07 | Falha sintética durante a escrita ou a verificação do ZIP (EIO, falta de espaço simulada); variante de cancelamento; variante com um arquivo alheio de mesmo nome do temporário criado antes da operação | Exportar | Nenhum arquivo com o nome final; vault com hashes iguais; nenhuma mensagem de sucesso. **Extensão (DQ-22):** o ZIP temporário criado pela operação é removido; o arquivo alheio de mesmo nome é preservado com o mesmo hash; falha de remoção é informada com o caminho |
| AC-06 | F-07; D-013 (S-A, P-7); TC-14 | ZIPs adulterados: hash errado, tamanho errado, extra, ausente, duplicado, duplicado por caixa e por forma Unicode, `../escape`, caminho absoluto, letra de unidade, entrada de link, método não aceito, criptografado, manifesto inválido, `manifest_version` desconhecido. **Extensão (A-08, A-10; PLANEJADA):** registro com versão de schema não suportada; `settings.yml` com `settings_version` não suportado; entrada `inbox/.txn_*.json` | Restaurar cada um | Recusa antes de disponibilizar, com diagnóstico da causa; versão não suportada aparece em categoria própria, distinta de integridade e de estrutura. **Inspeção do sistema de arquivos:** snapshot recursivo (lista, tipo por `lstat`, SHA-256) do pai do destino, de um diretório sentinela fora do destino (alvo das entradas de travessia) e do vault ativo, antes e depois: idênticos; os arquivos-alvo de travessia/absolutos não existem. Um adapter que registra todos os caminhos de escrita mostra que nenhum está fora do destino autorizado |
| AC-07 | D-013 (L-C, emendas DQ-06 e DQ-03/DQ-05); TC-14 | **Segurança:** ZIPs que excedem a razão de compressão, com cabeçalho que declara menos bytes do que contém, com manifesto incoerente com o número de entradas, com caminho relativo inseguro ou acima do limite de comprimento ou profundidade. **Capacidade:** espaço livre insuficiente simulado, caminho absoluto no destino acima do limite da plataforma, vault acima dos limites do ZIP clássico (deve usar ZIP64 Z-B, não falhar) | Restaurar; para capacidade, também exportar | Segurança: recusa antes de disponibilizar, e os bytes extraídos contados não ultrapassam o declarado. Capacidade: falha controlada, com diagnóstico, quando houver impossibilidade real; nenhum teto derivado de F-2 é aplicado. Nos dois casos, nenhum artefato incompleto é apresentado como válido. **Extensão (A-01; PLANEJADA):** na exportação, um arquivo muito comprimível é gravado com o método store e o backup continua restaurável; um caminho relativo acima do limite de segurança bloqueia a exportação. **Depende dos valores de segurança**, fixados pelos critérios de VAULT_CONTRACT §7.5 após medição (nenhum aprovado). *Nota de 18/10/2026:* proposta de valores em [PROPOSTA_AC07_LIMITES](PROPOSTA_AC07_LIMITES.md), PROPOSTO e não aprovado; a razão de compressão continua sem valor proposto. *Atualização de 18/10/2026:* valores decididos pela D-015 (alternativa B), em [VAULT_CONTRACT §7.5](VAULT_CONTRACT.md). Casos a acrescentar: manifesto acima do teto, caracteres U+0001–U+001F, caminho acima de 1.024 caracteres ou 3.072 bytes, segmento acima de 255, profundidade acima de 32, e caminho absoluto no destino acima do limite disponível. Razão de compressão excluída até a decisão do S-1. AC-07 continua PLANEJADO e não executado. *Atualização de 18/10/2026:* executado na PoC Node; ver §16 |
| AC-08 | Oficial §6; F-07; D-013 (emenda DQ-19) | Nome de destino que já existe (pasta vazia ou não); pasta-pai dentro do vault ativo; pasta-pai que contém o vault ativo; pasta-pai cujo caminho passa por uma junção e cujo caminho real cai dentro do vault ativo; pasta-pai legítima com junção no caminho fora do vault ativo; vault ativo aberto por um caminho com junção, ou com outra grafia de maiúsculas e minúsculas, e pasta-pai real dentro dele (A-04); cancelamento na confirmação (A-03); espaço livre insuficiente simulado | Restaurar | Recusa sem escrita (inspeção como no AC-06) em todos os casos, exceto a pasta-pai legítima com junção, que é aceita e tem a nova pasta criada pelo aplicativo depois da confirmação. No cancelamento, nenhuma pasta é criada. Redação anterior da preparação: “Destino não vazio, destino dentro do vault ativo, espaço livre insuficiente simulado” |
| AC-09 | D-013 (S-A); DQ-08; DQ-09 | Variantes na plataforma prioritária Windows 11 x64/NTFS (DQ-01): (a) junção; (b) symlink de arquivo e de diretório, com **pré-condição ambiental** de elevação ou Modo de Desenvolvedor habilitados manualmente pela proprietária; (c) outros pontos de reparo | Exportar | Exportação bloqueada com diagnóstico do caminho; o alvo não é lido (registro de leituras do adapter). A PoC Node cobre só (a) e (b); (c) exige validação no backend nativo (§12). Todas as variantes estão PLANEJADAS, nenhuma executada |
| AC-10 | D-013 (E-C, DQ-15) | Vault com conteúdo não canônico e com arquivos de sistema da lista fechada | Exportar com “excluir” e com “cancelar”, para o não canônico e para o grupo de arquivos de sistema | “Excluir”: o relatório lista o arquivo (ou o grupo) como excluído e o manifesto não o contém; “cancelar”: nenhum ZIP gerado; nenhum caso omite um arquivo em silêncio; um arquivo fora da lista fechada nunca é tratado como arquivo de sistema. **Extensão (A-01; PLANEJADA):** um registro inválido (`{UUID}.md` que não valida) não aparece como opção de inclusão e bloqueia a exportação até ser corrigido; um `.md` com outro nome numa pasta de registros aparece como não canônico e, se incluído, é restaurado como bytes, sem validação de registro |
| AC-11 | D-012; F-07 | Todos os casos de falha acima | Inspecionar resultado e estados | Nenhum estado ou mensagem de “concluído” antes da verificação final |
| AC-12 | Gate V0; TC-17; TC-21; D-013 (P-8) | Aplicativo **nativo** na plataforma-alvo de Q-07 | Exportar e restaurar pela GUI, fechar, reabrir | Repete AC-01, AC-02 e AC-06 no aplicativo real, inclusive permissões. A suíte Node/disco **não substitui** este critério; sem ele TC-13–15 não recebem PASS completo |
| AC-13 | VAULT_CONTRACT §7.5 (ZIP64 Z-B, DQ-07) | Fixture com ZIP64 forçado (F-3) | Gerar com ZIP64 forçado, restaurar e extrair pelo extrator nativo do Windows 11 | Gravação e leitura corretas com ZIP64; resultado da extração nativa registrado; incompatibilidade inaceitável reabre DQ-07. **VERIFICADO na PoC Node/Linux em 19/10/2026 (§17); compatibilidade com os extratores do Windows 11 PENDENTE. AC-13 completo não aprovado** |
| AC-14 | D-013 (P-7, DQ-17) | Backup íntegro com um registro que referencia UUID inexistente | Restaurar | Restauração concluída como cópia verificada, no estado **Verificado com avisos**; o relatório contém o diagnóstico da referência ausente; nenhuma correção ou exclusão automática |
| AC-15 | D-013 (DQ-23, DQ-24); TC-14 | Restauração interrompida de forma determinística após k arquivos (injeção no adapter) | Simular o reinício com uma nova instância | O diário existe nos dados do aplicativo, fora do vault e do destino, gravado antes de cada item criado (a pasta de destino, cada diretório e cada arquivo; A-02) e sem conteúdo de arquivos; no reinício, o destino aparece como não verificado e “Abrir” não é oferecido |
| AC-16 | D-013 (DQ-19, DQ-23); TC-14 | Destino de restauração falha com um arquivo estranho acrescentado depois e um sentinela fora do destino | “Remover cópia incompleta” | Inspeção como no AC-06: só os arquivos e diretórios registrados no diário foram removidos, os diretórios de baixo para cima e só quando vazios (A-02); o arquivo estranho e o sentinela têm o mesmo hash; a pasta de destino continua existindo por causa do arquivo estranho; nada fora do destino é tocado; diário detalhado apagado; marcador mínimo presente enquanto a pasta de destino existir. Variante sem arquivo estranho: tudo é removido, inclusive a pasta de destino, e não resta marcador |
| AC-17 | D-013 (DQ-23, DQ-24); TC-14 | Destino de restauração falha | “Manter para diagnóstico”; depois, dispensar o aviso | **Dados (PoC):** nenhum arquivo do destino é alterado; o diário detalhado é apagado; o marcador mínimo (caminho real, “não verificado”, data, SHA-256 do ZIP) permanece até a dispensa explícita, que o remove. **Interface (depende do aplicativo nativo; não verificável na PoC; A-13):** ao abrir a pasta, o aviso aparece |
| AC-18 | D-013 (DQ-18); TC-23; TC-24; AC-12 | Restauração no estado Verificado e vault atual com alteração pendente | Acionar “Abrir vault restaurado” | Confirmação nomeia os dois vaults; o fluxo de alterações pendentes (UX §4) é aplicado antes; o vault anterior mantém os hashes; “Abrir” não aparece nos estados Falhou ou Interrompido; a lista de vaults recentes só muda após a abertura. **Depende de GUI e do UX §4 (PROPOSTO)** |
| AC-19 | VAULT_CONTRACT §7.4 (streaming); D-013 (DQ-03); TC-21; §12.3 | F-3 em degraus, em três séries independentes: (i) número fixo de **anexos em `assets/`** com tamanho individual crescente; (ii) arquivos de tamanho fixo em número crescente; (iii) **registros Markdown** de tamanho individual crescente (revisão de 18/10/2026, A-06) | Exportar, verificar e restaurar em cada degrau, medindo pico de memória e tempo por fase (protocolo MP), com as fases de hash, compactação e extração separadas da validação de registros | Curvas registradas por série, fase e degrau. O requisito de streaming só é considerado atendido se, na série (i), o pico de memória das fases de hash, compactação e extração não acompanhar o tamanho dos anexos. Na série (ii), a dependência do número de entradas é registrada e comparada com o que o requisito admite para metadados. Na série (iii), a memória da validação de registros pode acompanhar o maior registro, como o contrato admite; ela é registrada e não reprova o critério. Nenhum resultado é presumido antes da execução |

AC-01 a AC-11, AC-13 e AC-14 podem ser exercitados por uma PoC Node com disco real, após autorização e escolha da biblioteca. Para os valores do AC-07, resta decidir somente a razão de compressão S-1, dependente de F-2.v1 e F-3 maliciosas; os demais valores foram aprovados pela D-015 e executados na PoC (§16). A capacidade é verificada em execução, sem teto derivado de F-2. AC-13 tem política definida (Z-B); a parte automática foi executada em 19/10/2026 (§17), e a extração nativa do Windows continua pendente. AC-12 exige a prova nativa.

**Atualização de 18/10/2026 (bloco 2; AC-15 a AC-19 acrescentados pela DQ-25):**

| Grupo | Critérios |
| --- | --- |
| Exercitáveis na PoC Node após autorização | AC-01 a AC-06, AC-08, AC-10, AC-11, AC-14 a AC-16, a parte de dados de AC-17, extensão de AC-05, AC-09 (a) e (b), a parte de gravação e leitura de AC-13, o mecanismo de AC-07 com valores de teste e AC-19 |
| Exigem aplicativo nativo ou ferramenta do SO | AC-12, AC-18, AC-09 (c), a parte de interface de AC-17, extração de AC-13 pelo Explorador |
| Dependem de configuração do sistema | AC-09 (b): Modo de Desenvolvedor ou elevação, a reconferir antes da execução |
| Bloqueados por dependências | Extensão de AC-03 (mecanismo da Inbox); valores finais de AC-07 (medição); AC-18 (UX §4) |

Ligação com os TC:

| TC | Critérios |
| --- | --- |
| TC-13 | AC-01, AC-02, AC-10, AC-14, AC-19 |
| TC-14 | AC-06, AC-07, AC-08, AC-13, AC-15, AC-16, AC-17 |
| TC-15 | AC-03, AC-04, AC-05, AC-09, AC-11 |
| TC-21 | AC-19 |
| TC-23 e TC-24 | AC-18, AC-12 |

Todos continuam PLANEJADOS; nenhum foi executado.

## 11. Registro de execução futuro

```text
Data:
Revisão do código e alterações locais:
SO / runtimes / dependências:
Fixture e hashes:
Cenários:
Comando exato:
Resultado e código de saída:
Evidência (log/arquivo/captura):
Falhas e limitações:
Responsável / aceite:
```

O runner `npm test`, typecheck e build definidos em `poc/package.json` cobrem a PoC local. Não existe ainda runner ou aplicativo para executar os cenários completos da V1. Resultados de auditoria documental não recebem IDs TC de software.

## 12. Plataforma, fixtures e protocolo de medição (Q-07, bloco 1 de 18/10/2026)

**Base:** a proprietária aceitou DQ-01, DQ-02 e DQ-04 a DQ-09 de [PROPOSTA_BLOQUEIOS_Q05](PROPOSTA_BLOQUEIOS_Q05.md); DQ-03 continuava pendente naquele bloco e foi decidida no bloco 2 (dimensionamento progressivo, §12.2). Esta seção define **como** testar e medir. Nenhuma fixture foi construída, nenhuma medição foi realizada e nenhum critério foi executado. O protocolo não substitui os critérios de aceitação.

### 12.1 Plataforma prioritária (DQ-01)

Windows 11 x64 em NTFS é a plataforma prioritária para desenvolver e validar a V0. Define a **prioridade de validação**, não compatibilidade universal: macOS, Linux e outros ambientes não estão suportados nem validados sem evidência própria, e exigirão repetir AC-09, AC-12, AC-13 e as medições. Ambiente observado em 18/10/2026 (IMPLEMENTATION_STATUS §16): Windows 11 Pro 10.0.26200, Intel Core i5-1334U, 15,7 GiB de RAM. Isso descreve o equipamento disponível; não é meta de hardware aprovada.

### 12.2 Famílias de fixture (DQ-02) e dimensionamento progressivo (DQ-03)

| Fixture | Finalidade | Composição | Estado |
| --- | --- | --- | --- |
| F-1 funcional | AC-01–AC-11, AC-14–AC-17 | Poucas dezenas de arquivos: todos os tipos de registro, arquivados, CRLF/LF, Unicode e nomes que diferem só por caixa, anexos binários em `assets/` com subpasta, `settings.yml`, arquivos de sistema, uma pasta vazia, um arquivo não canônico, uma pasta de cache de outra ferramenta (não canônica), um `.tmp-{UUID}.md` órfão; variantes com `.txn_*`, junção e symlink | Composição aprovada; atualizada no bloco 2 (D-014, DQ-13, DQ-15); não construída |
| F-2 referência | Comparação de medições entre versões | Conjunto **sintético**, reproduzível (gerador com semente registrada) e versionado (F-2.vN), com proporção de Markdown e anexos já comprimidos (PDF, imagem), incluindo amostras muito comprimíveis. Não representa nem limita o volume futuro do Atlas. A composição de F-2.v1 é proposta após a primeira rodada exploratória e aprovada pela proprietária; versões novas não invalidam as anteriores | **Modelo progressivo decidido (DQ-03, bloco 2).** F-2.v1 ainda não proposto nem aprovado. Não construída |
| F-3 estresse | Capacidade, limites de segurança e ZIP64 | Gerada no temporário, em degraus crescentes que variam separadamente o número de arquivos e o tamanho de arquivos individuais, registrando tempo, memória e disco por degrau (MP), até falha controlada ou limitação técnica real do ambiente. Inclui ao menos um caso acima de 65.535 entradas e um arquivo acima de 4 GiB, ou ZIP64 forçado pela biblioteca quando o tamanho real for inviável, e ZIPs maliciosos de expansão e de cabeçalho falso | Composição aprovada; degraus acrescentados no bloco 2 (DQ-03). Em 18/10/2026, os degraus do AC-19 foram gerados por `poc/bench/ac19-fixture.ts` (§15); o caso de ZIP64 e os ZIPs maliciosos de expansão e de cabeçalho falso não foram construídos |

*Emenda de 18/10/2026 (bloco 2, DQ-03).* Redação anterior, preservada:

- F-2: “Volume que represente o uso esperado da proprietária com margem de crescimento, com proporção realista de Markdown e anexos já comprimidos (PDF, imagem)”, com estado “Volume PENDENTE (DQ-03): aguarda estimativa da proprietária…”.
- Parágrafo seguinte: “A pendência de DQ-03 impede definir o volume concreto de F-2 e, por consequência, as margens e os valores dos limites.”

Com o modelo progressivo, nenhuma estimativa de volume é necessária. Os limites de segurança dependem de critérios técnicos e de medição; os de capacidade são verificados em execução ([VAULT_CONTRACT §7.5](VAULT_CONTRACT.md)).

### 12.3 Protocolo de medição MP (DQ-04)

1. Registrar SO, build, CPU, RAM, sistema de arquivos, runtime, versão da biblioteca, fixture (contagem, bytes, hash do conjunto) e estado (antivírus ativo, energia na tomada).
2. Tempo: `process.hrtime.bigint()` por fase (inventário, coleta, ZIP, verificação, extração, validação, reindexação).
3. Memória: `process.resourceUsage().maxRSS` e amostras de `process.memoryUsage()`. No app nativo, pico do processo por ferramenta do SO, com método registrado.
4. Disco: `fs.statfs` antes e depois; soma de bytes incluídos; tamanho do ZIP; espaço temporário máximo.
5. Volume: arquivos, bytes, maior arquivo, maior caminho relativo e profundidade, razão de compressão por entrada.
6. Pelo menos 5 execuções por cenário, com mediana e máximo; separar primeira execução (cache frio) das seguintes; nunca relatar média sem a dispersão.

Resultados de condições diferentes (cache frio ou aquecido, fixture, versão, ambiente) são registrados separadamente e identificados; nunca se misturam. Este protocolo não fixa valores de desempenho nem critérios numéricos.

### 12.4 Limites: categorias, critérios, valores e testes (DQ-05, DQ-06)

As categorias (com a emenda DQ-06, caminho absoluto no destino), as classes segurança × capacidade e os critérios de fixação (emendados no bloco 2) estão em [VAULT_CONTRACT §7.5](VAULT_CONTRACT.md), que é o documento responsável. **Nenhum valor numérico, margem ou teto está aprovado.** *(Até 18/10/2026. Desde então, os valores de segurança foram decididos pela D-015, exceto a razão de compressão, que depende de F-2.v1 e dos ZIPs maliciosos de F-3. A sequência abaixo foi seguida sem F-2.v1, porque a D-015 não usou F-2.)* Sequência (bloco 2): proposta e aprovação de F-2.v1 → construção de F-1, F-2 e F-3 → execução do MP, incluindo os degraus de F-3 e AC-19 → proposta de valores de segurança pelos critérios → decisão da proprietária → AC-07. A capacidade é verificada em execução e não recebe valor fixo. Redação anterior: “estimativa DQ-03 → construção de F-2/F-3 → execução do MP → proposta de valores pelos quatro critérios → decisão da proprietária → AC-07”.

### 12.5 Links e pontos de reparo (DQ-08, DQ-09)

| Variante de AC-09 | Teste planejado | Pré-condição ambiental | Executado | Resultado observado |
| --- | --- | --- | --- | --- |
| (a) Junção | Sim | Nenhuma: a sonda de 18/10/2026 mostrou que é criável na sessão atual | Não | — |
| (b) Symlink de arquivo e de diretório | Sim | Elevação ou Modo de Desenvolvedor, habilitados **manualmente pela proprietária** (a primeira sonda de 18/10/2026 obteve `EPERM`). O agente não altera configurações, não solicita elevação automaticamente e não contorna a restrição. **Pré-condição satisfeita em 18/10/2026:** a proprietária habilitou o Modo de Desenvolvedor; uma nova sonda, em sessão não elevada, criou symlinks de arquivo e de diretório (IMPLEMENTATION_STATUS §19). A satisfação vale para este equipamento e precisa ser reconferida antes da execução | Não | — |
| (c) Outros pontos de reparo | Sim, no backend nativo | Prova nativa (ADR-008) | Não | — |

A PoC Node atual **não comprova, por si só**, a detecção completa de todas as formas de ponto de reparo ou link relevantes no Windows: o Node não expõe a tag de reparo. A regra de bloqueio de VAULT_CONTRACT §7.6 permanece integral e não é reduzida por essa limitação. A detecção completa e confiável exige validação específica no backend nativo ou em mecanismo equivalente apropriado. Essa implementação não existe; é trabalho futuro, e a variante (c) continua pendente.

### 12.6 ZIP64 (DQ-07)

Política Z-B formalizada em VAULT_CONTRACT §7.5. **Atualização de 19/10/2026:** gravação, leitura, restauração e recusas de ZIP64 foram verificadas na PoC Node/Linux (§17). A compatibilidade com os extratores do Windows 11, incluindo o Explorador, permanece **PENDENTE**; AC-13 completo não está aprovado. Estado anterior: biblioteca, leitor e fluxo completo ainda não validados.
## 13. Execução parcial: exportação da PoC (incremento 1, 18/10/2026)

**Comando:** `npm test` em `poc/` · **Resultado:** código 0; runtime `v24.22.0`; verificação de tipos e build passaram; **71 testes passaram, 0 falharam** (37 anteriores e 34 novos em `test/backup-manifest.test.ts` e `test/backup-export.test.ts`). Execução na plataforma prioritária (Windows 11 x64/NTFS), sessão não elevada, com Modo de Desenvolvedor ativo. Duas mutações temporárias no build confirmaram que os testes discriminam: sem a nova varredura da C-A, 7 testes falham; sem a releitura do ZIP, o teste do ZIP corrompido falha. O build foi refeito a partir do código-fonte antes da execução final.

| Critério | Subcasos executados com sucesso | Ainda não coberto |
| --- | --- | --- |
| AC-01 | Inventário exato (canônicos, não canônicos, grupo de sistema na raiz e em `assets/`, temporário `.tmp-{UUID}.md` excluído e preservado, pasta vazia listada, pasta canônica vazia não listada); M-B ordenado, sem autorreferência, `manifest_version` e `created_at` UTC; tamanhos e SHA-256 conferidos com a origem; ZIP com exatamente os arquivos e o manifesto; nome final inexistente durante a verificação, temporário fora do vault; vault inalterado. Extensão A-01/A-10: `settings.yml` inválido, sem versão ou com versão 2 bloqueia; ausência não bloqueia | Nomes que diferem só por caixa (impossível no NTFS padrão; detecção implementada, não exercitada); preferências do dispositivo (não há aplicativo) |
| AC-03 | `inbox/.txn_*.json` bloqueia, sem ZIP, vault inalterado | Extensão (mecanismo de recuperação da Inbox) |
| AC-04 | Seis variantes injetadas depois da escrita do ZIP (mesmo tamanho, tamanho, remoção, arquivo novo em pasta existente, arquivo novo em pasta nova, substituição por symlink) abortam, sem nome final e com o temporário removido; limite conhecido (alterar e restaurar) demonstrado como não detectado | Escritores externos simultâneos reais; variante de junção como substituição |
| AC-05 | Falha de escrita (EIO) com remoção só do temporário próprio; ZIP temporário corrompido falha na releitura e não é publicado; cancelamento na decisão; arquivo alheio com o nome do temporário preservado; backup existente não sobrescrito; destino dentro do vault recusado | Falta de espaço real; cancelamento durante a escrita (não há essa ação na PoC) |
| AC-10 | Excluir não canônico e grupo de sistema; decisão ausente gera erro em vez de omissão; arquivo fora da lista fechada é não canônico. Extensão A-01: registro inválido bloqueia e não é oferecido; `.md` com outro nome é não canônico e é copiado como bytes | — |

Também executados, sem ID AC próprio: bloqueio por versão de schema não suportada ou ausente, id diferente do nome, `note_type` incoerente, UUID duplicado, `manifest.json` na raiz, nomes que diferem só pela forma Unicode e junção dentro do vault (validação simétrica A-01/A-10 e S-A).

**Fechamento das pendências do incremento 1 (18/10/2026):** `npm test` em `poc/`, código 0, **84 testes passaram, 0 falharam** (71 anteriores e 13 novos).
- **Nome reservado (VAULT_CONTRACT §7.2 item 8):** `manifest.json` e `Manifest.JSON` na raiz bloqueiam, sem ZIP e com o arquivo intacto; em subpastas, o mesmo nome é anexo ou não canônico. Uma mutação para comparação exata fez o caso `Manifest.JSON` falhar.
- **`settings_version` (DATA_MODEL §2.1):** a versão 1 é exportada; `"1"`, `1.5`, `null`, raiz em lista e chave duplicada são inválidos; `0` e `-1` são versões não suportadas.

Esses resultados são da PoC Node em disco real. Não aprovam TC-13–TC-15, que dependem também da restauração, de AC-07, AC-13 e AC-12 nativo.

## 14. Execução parcial: restauração da PoC (incremento 2, 18/10/2026)

**Comando:** `npm test` em `poc/` · **Resultado:** código 0; runtime `v24.22.0`; **126 testes passaram, 0 falharam** (84 anteriores e 42 novos em `test/backup-restore.test.ts`). Plataforma igual à do §13. Uma mutação temporária, `rmdir` trocado por remoção recursiva, fez o caso do arquivo estranho do AC-16 falhar. O build foi refeito antes da execução final.

| Critério | Subcasos executados com sucesso | Ainda não coberto |
| --- | --- | --- |
| AC-02 | ZIP exportado de fixture com Group, Tag, Item, notas ligadas, Inbox, anexo binário Unicode e `settings.yml`. Resultados: bytes e SHA-256 iguais; mesmos caminhos; pastas canônicas presentes, inclusive vazias; índices Tag/Group/Item e backlinks reconstruídos da cópia iguais aos da origem; `schemaVersions` [1]; estado Verificado; relatório sem conteúdo de corpo, salvo só fora da cópia e do vault ativo, sem sobrescrever; vault ativo inalterado | Fixture completa do AC-01 com arquivos de sistema e não canônicos |
| AC-06 | Os 15 ZIPs adulterados da lista e a entrada `inbox/.txn_*.json` são recusados na pré-validação. Travessia, caminho absoluto e letra de unidade são barrados pelo `strictFileNames` do yauzl (`invalid-central-directory`). Snapshot de toda a área de trabalho (pai, sentinela, vault ativo) idêntico; nenhuma criação registrada pelo adapter. Extensão A-10: `schema_version` 2 e `settings_version` 2 falham na validação, em categoria `unsupported-version`, só com escritas no destino e nos dados do aplicativo | — |
| AC-08 | Destino existente (vazio ou não), pasta-pai dentro do vault e que o contém, junção que cai no vault, vault ativo aberto por junção ou com outra caixa, espaço insuficiente simulado e nome com separador: todos recusados sem escrita. Cancelamento na confirmação: nenhuma pasta nem diário. Pasta-pai legítima por junção: aceita, com o caminho real no relatório | — |
| AC-14 | Referência ausente em `tag_ids` gera Verificado com avisos, com o caminho do registro; arquivo idêntico ao da origem | — |
| AC-15 | Fim de processo simulado na 3.ª intenção de arquivo: toda criação no destino foi precedida pela intenção no diário; o diário não contém corpo; uma nova leitura mostra Interrompido, sem “Abrir”. Cancelamento durante o progresso também termina como Interrompido | Fim de processo real (kill) |
| AC-16 | Com arquivo estranho: só os itens do diário são removidos; estranho, sentinela e vault ativo preservados; pasta mantida; diário apagado; marcador “não verificado” presente. Sem arquivo estranho: tudo removido, inclusive a pasta, sem marcador | — |
| AC-17 (dados) | “Manter”: cópia inalterada, diário apagado, marcador com caminho, estado, data e SHA-256 do ZIP; a dispensa remove o marcador sem tocar na cópia | Parte de interface (aplicativo nativo) |

Continuam não executados: AC-07, AC-13, AC-18, AC-19, AC-12 e a parte de interface do AC-17. TC-13–TC-15 não são aprovados. *(AC-19 executado depois na PoC Node; ver §15.)*

## 15. Execução do AC-19 na PoC Node (incremento 3, 18/10/2026)

**Escopo:** as três séries do AC-19 (§10), em F-3 por degraus (§12.2), com o protocolo MP (§12.3), sobre a exportação e a restauração da PoC. São medições de **um equipamento**: caracterizam o comportamento da PoC e servem de evidência para propor depois os valores do AC-07. **Não são limites, metas nem garantias.**

### 15.1 Ambiente (MP item 1)

| Item | Valor observado |
| --- | --- |
| SO | Windows 11 Pro, versão 10.0.26200 (build 26200), x64 |
| CPU e memória | 13th Gen Intel Core i5-1334U, 12 processadores lógicos; 15,7 GiB de RAM (16.849.256.448 bytes) |
| Sistema de arquivos | NTFS, volume C: de 476 GiB, com 288,6 GiB livres antes da execução; as fixtures ficam no temporário do sistema, no mesmo volume |
| Runtime e bibliotecas | Node `v24.22.0` (pinado em `poc/`); `yauzl` 3.4.0; `yazl` 3.3.1 |
| Estado | Proteção em tempo real do Microsoft Defender **ativa** (`Get-MpComputerStatus`); na tomada (`Win32_Battery.BatteryStatus` = 2); sessão não elevada; nenhuma configuração alterada |
| Fixture | Gerador `poc/bench/ac19-fixture.ts`, semente `atlas-ac19-v1`, bytes de anexos por AES-256-CTR (incompressíveis); base constante em todas as séries: uma Tag e `settings.yml`. O hash do conjunto por degrau (SHA-256 da lista do manifesto) está no resumo gerado |

### 15.2 Método

- **Processos:** cada operação (exportar ou restaurar) roda num processo Node próprio. Assim, `process.resourceUsage().maxRSS`, o pico do working set informado pelo SO, é o pico daquela operação.
- **Fases:** delimitadas por um gancho opcional `phase`, que só mede, acrescentado a `exportBackup` e `restoreBackup`.
  - Exportação: `inventory` e `rescan` (varredura com validação de registros); `hash`, `zip`, `rehash` e `verify` (conteúdo em streaming); `publish`.
  - Restauração: `pre-digest` e `pre-verify`; `destination`; `directories`; `extraction`; `validation` (registros); `references`.
- **Amostragem:** tempo por `process.hrtime.bigint()`; memória por `process.memoryUsage()` a cada 5 ms e em cada fronteira de fase.
- **Disco:** `fs.statfs` antes e depois de cada operação.
- **Execuções:** 5 por degrau. A 1.ª é separada; das outras 4 são relatados a mediana e o máximo.
- **Séries:**

  | Série | O que cresce | Degraus |
  | --- | --- | --- |
  | (i) | Tamanho de cada um de 4 anexos em `assets/` | 1, 8, 64, 256 e 768 MiB (de 4 MiB a 3 GiB no total) |
  | (ii) | Número de arquivos de 4 KiB, em pastas de 500 | 100, 1.000, 4.000 e 16.000 |
  | (iii) | Corpo de cada um de 4 registros Markdown em `notes/permanent/` | 64 KiB, 1, 8, 32 e 128 MiB |

- **Escolha dos degraus:** tempo total de cerca de 45 minutos, estimado por uma sondagem de 1 execução por série que foi descartada. O ZIP de cada degrau fica abaixo de 4 GiB e de 65.535 entradas, para não misturar o AC-19 com o ZIP64 do AC-13. Os maiores degraus **não** são limites técnicos encontrados: nenhuma operação falhou.

**Comandos executados** em `poc/`, com o Node pinado de `node_modules/.bin`:

```powershell
npm run build
node dist/bench/ac19-run.js --series i --steps 1048576,8388608,67108864,268435456,805306368 --runs 5 --out bench/results/ac19-2026-10-18.jsonl
node dist/bench/ac19-run.js --series ii --steps 100,1000,4000,16000 --runs 5 --out bench/results/ac19-2026-10-18.jsonl
node dist/bench/ac19-run.js --series iii --steps 65536,1048576,8388608,33554432,134217728 --runs 5 --out bench/results/ac19-2026-10-18.jsonl
node dist/bench/ac19-run.js --summarize bench/results/ac19-2026-10-18.jsonl
npm test
```

**Resultado geral:** as três séries terminaram com código 0 em 43,8 minutos. Todas as 70 exportações e 70 restaurações terminaram com sucesso, as restaurações no estado Verificado. As pastas temporárias foram apagadas. `npm test` depois das medições: código 0, 126/126.

**Arquivos de evidência:**
- dados brutos: `poc/bench/results/ac19-2026-10-18.jsonl`;
- resumo com tempo e pico de RSS por fase, disco e hash do conjunto por degrau: `poc/bench/results/ac19-2026-10-18.md`.

### 15.3 Resultados

Os valores trazem a mediana das execuções 2 a 5 e, entre parênteses, o máximo. Tempo em segundos (s) ou milissegundos (ms); maxRSS em MiB.

| Série | Degrau | Exportação: tempo | Exportação: maxRSS | Restauração: tempo | Restauração: maxRSS |
| --- | --- | --- | --- | --- | --- |
| (i) | 4 × 1 MiB | 433 ms (668 ms) | 62,3 (62,7) | 488 ms (1038 ms) | 57,7 (58,0) |
| (i) | 4 × 8 MiB | 1872 ms (4486 ms) | 77,5 (85,7) | 1391 ms (1646 ms) | 72,9 (73,5) |
| (i) | 4 × 64 MiB | 5940 ms (6007 ms) | 123,1 (123,4) | 5171 ms (5463 ms) | 83,9 (84,4) |
| (i) | 4 × 256 MiB | 30,1 s (37,5 s) | 123,4 (123,6) | 17,3 s (29,8 s) | 102,0 (103,4) |
| (i) | 4 × 768 MiB | 113,7 s (118,2 s) | 122,5 (124,2) | 96,4 s (107,9 s) | 120,7 (121,7) |
| (ii) | 100 arquivos | 614 ms (1840 ms) | 64,5 (65,1) | 2031 ms (2064 ms) | 57,4 (57,6) |
| (ii) | 1.000 arquivos | 3359 ms (3681 ms) | 103,6 (116,4) | 10,2 s (11,2 s) | 92,6 (93,1) |
| (ii) | 4.000 arquivos | 8385 ms (9131 ms) | 148,7 (149,3) | 26,3 s (26,8 s) | 183,3 (188,0) |
| (ii) | 16.000 arquivos | 29,8 s (31,6 s) | 227,8 (234,0) | 89,8 s (96,6 s) | 264,1 (273,1) |
| (iii) | 4 × 64 KiB | 252 ms (326 ms) | 53,9 (54,1) | 212 ms (357 ms) | 53,3 (53,4) |
| (iii) | 4 × 1 MiB | 321 ms (457 ms) | 74,5 (74,9) | 384 ms (928 ms) | 66,9 (67,3) |
| (iii) | 4 × 8 MiB | 1111 ms (1491 ms) | 114,6 (114,9) | 975 ms (1025 ms) | 103,7 (103,7) |
| (iii) | 4 × 32 MiB | 3354 ms (4657 ms) | 184,6 (186,0) | 2492 ms (3957 ms) | 170,6 (187,1) |
| (iii) | 4 × 128 MiB | 10,1 s (15,7 s) | 377,0 (377,2) | 9203 ms (14,0 s) | 315,9 (326,2) |

- **Disco:** o ZIP tem praticamente o tamanho dos dados (método store), de 1,0000 a 1,0094 vez os bytes incluídos. Na série (ii), com 4 KiB por arquivo, chega a cerca de 1,078 vez, por causa dos cabeçalhos. O espaço temporário máximo é o do ZIP na exportação e o da cópia restaurada na restauração.
- **1.ª execução:** ficou próxima das seguintes na maioria dos degraus. Houve exceções isoladas, como a restauração de (iii) 4 × 32 MiB, com 8,5 s na 1.ª contra 2,5 s de mediana, e a de (ii) 1.000, com 15,2 s contra 10,2 s.
- **Dispersão:** o máximo chegou a 2,4 vezes a mediana em degraus pequenos. Isso é atribuível a ruído do ambiente, com o antivírus ativo e o sistema em uso normal, mas a causa não foi isolada.

### 15.4 Interpretação contra o AC-19 e o VAULT_CONTRACT §7.4

- **Série (i), o critério do streaming.** Os anexos crescem 768 vezes (de 4 MiB para 3 GiB no total).
  - O maxRSS da exportação estabiliza em cerca de 123 MiB a partir de 4 × 64 MiB e não muda até 4 × 768 MiB.
  - Na restauração, a fase de extração fica entre 64 e 71 MiB (pico amostrado) de 4 × 8 MiB em diante.
  - O maxRSS da restauração sobe de 84 para 121 MiB entre 4 × 64 e 4 × 768 MiB. O pico está na fase `pre-digest` (hash do ZIP inteiro). O heap JS fica entre 8 e 11 MiB em todas as fases; o que cresce são os buffers externos ainda não coletados.
  - Na exportação, esses buffers estabilizam a partir de 4 × 256 MiB. A hipótese é coleta tardia de blocos, não retenção do arquivo: é consistente com os dados, mas não foi comprovada.
  - **Conclusão desta execução:** o pico de memória das fases de hash, compactação e extração **não acompanhou** o tamanho dos anexos. 3 GiB de dados ficaram abaixo de 125 MiB de pico do processo. O critério da série (i) é **observado como atendido nesta máquina**, com uma ressalva: o crescimento residual, sublinear, do `pre-digest` da restauração não foi mostrado estável acima de 4 × 768 MiB.
- **Série (ii), dependência do número de entradas**, que o §7.4 admite para metadados.
  - Entre 1.000 e 16.000 arquivos, o maxRSS cresce cerca de 8,3 KiB por entrada na exportação e 11,7 KiB na restauração. Esse acréscimo é coerente com inventário, manifesto, diretório central e mapa de entradas mantidos em memória.
  - O tempo da restauração é dominado pela extração, com cerca de 5,3 ms por arquivo a 16.000. Cada arquivo passa por três gravações do diário com fsync e pelo fsync do próprio arquivo.
  - Registrado; não reprova o critério.
- **Série (iii), validação de registros**, que o §7.4 (A-15) admite proporcional ao maior registro.
  - A fase de validação da restauração atinge cerca de 315 MiB com registros de 128 MiB; a varredura da exportação, cerca de 308 MiB. Isso é próximo da base, de cerca de 55 MiB, mais duas vezes o tamanho do registro.
  - As fases de hash, compactação e extração continuam baixas: 105 MiB no `zip` da exportação e 69 MiB na extração.
  - Registrado; não reprova o critério.

### 15.5 Evidência para o AC-07 e o que ficou bloqueado

- **Para a proposta posterior dos valores de segurança** (VAULT_CONTRACT §7.5), estas medições fornecem, **só para este equipamento**:
  - o custo de memória por entrada;
  - o custo de memória por byte do maior registro validado;
  - a ausência de dependência do tamanho de anexos nas fases de streaming;
  - as vazões observadas: cerca de 27 MiB/s na exportação e 32 MiB/s na restauração de anexos grandes, com Defender ativo.
- **Nenhum valor de limite foi proposto nem fixado.** Os critérios do §7.5 e a decisão da proprietária continuam necessários.
- **Bloqueado ou fora do escopo:**
  1. Metas de tempo e desempenho dependem da Q-07, aberta. Os tempos são só registrados, sem aprovação ou reprovação.
  2. A medição no aplicativo nativo (MP item 3 e TC-21) depende da prova nativa.
  3. Um cache verdadeiramente frio exigiria reinício ou privilégios. A 1.ª execução vem logo depois da geração da fixture e, portanto, provavelmente com cache quente.
  4. O ZIP64 com mais de 4 GiB ou mais de 65.535 entradas pertence ao AC-13.
  5. F-2.v1 não foi proposto nem aprovado e não foi usado.
  6. Outras plataformas não foram medidas.
- **Limitações do método:**
  - o pico por fase é amostrado: picos curtos entre amostras e trabalho síncrono longo podem escapar; o maxRSS do processo é exato;
  - o campo `peakExternal` dos dados brutos soma `external` e `arrayBuffers` e conta estes duas vezes; só serve como indicador relativo;
  - o maxRSS no Windows é o working set, não a memória comprometida.

**Estado:** AC-19 executado na PoC Node nesta máquina, com o critério da série (i) observado como atendido e a ressalva acima. TC-21 **não** é aprovado: depende da medição nativa e da Q-07.

## 16. Execução do AC-07 na PoC Node (incremento 4, 18/10/2026)

**Escopo:** os valores da D-015 ([VAULT_CONTRACT §7.5](VAULT_CONTRACT.md)), **sem a razão de compressão**, que continua sem valor. Plataforma igual à do §15.1.

**Comandos executados** em `poc/`:

```powershell
npm run typecheck
npm run build
node --test dist/test/backup-limits.test.js
npm test
```

**Resultados:**
- teste específico: 17/17;
- `npm test`: código 0, Node `v24.22.0`, **143/143** (126 anteriores e 17 novos em `test/backup-limits.test.ts`);
- nenhum teste foi pulado. Os dois casos que dependem de caminhos longos fazem uma sonda antes e seriam pulados, com motivo, num ambiente sem esse suporte; aqui foram executados;
- três mutações temporárias no build confirmaram que os testes discriminam:
  - sem o teto do manifesto: 2 falhas;
  - profundidade 33 aceita: 3 falhas;
  - sem a verificação do caminho absoluto no destino: 3 falhas;
  - o build foi refeito antes da execução final.

| Item da D-015 | Subcasos executados com sucesso | Limitação |
| --- | --- | --- |
| Caracteres de controle | U+0001 e U+001F recusados; espaço aceito; ZIP com U+0001 recusado na pré-validação, sem confirmação nem escrita | O NTFS não permite criar esses nomes, então o bloqueio na exportação foi exercitado só pela função compartilhada com a varredura |
| Comprimento do caminho relativo | 1.024 unidades aceitas; 1.025 recusadas; o caminho mais denso possível, com 1.024 unidades de 3 bytes, cabe nos 3.072 bytes; ZIP acima do limite recusado; vault em disco acima do limite bloqueia a exportação | O limite de 3.072 bytes nunca é ultrapassado sozinho: cada unidade UTF-16 vale no máximo 3 bytes UTF-8. Fica como verificação redundante |
| Segmento | 255 aceito; 256 recusado, inclusive em ZIP | Não é possível criar no NTFS; a exportação foi exercitada pela função |
| Profundidade | 32 aceita; 33 recusada no ZIP e no vault em disco, este bloqueando a exportação | — |
| Teto do manifesto | Exatamente no teto: restauração Verificada. Um byte acima: recusa (`manifest-too-large`, segurança) antes de ler o manifesto | — |
| Coerência e bytes reais | `file_count` incoerente recusado; cabeçalho central que declara 1.024 bytes para 64 KiB comprimidos, recusado na pré-validação pela contagem de bytes reais (`too many bytes`), sem escrita | — |
| Espaço livre na exportação | Um byte abaixo do exigido: falha `insufficient-space` (capacidade) antes de criar o temporário; exatamente o exigido: exportação concluída | Espaço simulado pelo adapter; falta de espaço real não testada |
| Caminho absoluto no destino | Com limites injetados: arquivo um caractere acima e diretório um caractere acima, ambos recusados antes da confirmação, sem pasta criada; exatamente no limite, Verificado. Com o padrão 259/247, um caminho absoluto com mais de 600 caracteres é recusado; com 32.767, é restaurado e lido de volta | A PoC não detecta o suporte a caminhos longos (`LongPathsEnabled` e manifesto `longPathAware`); quem chama informa o limite. A detecção é do backend nativo |

**Não coberto:**
- a razão de compressão (S-1, sem valor) e os ZIPs maliciosos de expansão de F-3;
- AC-13 (ZIP64);
- o aplicativo nativo;
- nomes reservados de dispositivo e nomes terminados em espaço ou ponto (pendentes).

**Estado:** AC-07 executado na PoC Node para todos os valores da D-015 exceto a razão de compressão. Não é PASS completo: faltam o S-1 e a prova nativa, e TC-14 não é aprovado.

## 17. AC-13: conclusão automática da PoC e compatibilidade pendente (19/10/2026)

**Estado:** VERIFICADO para a parte automática da PoC Node. **AC-13 completo PENDENTE** da extração pelos componentes do Windows 11; não aprova TC-13–TC-15 nem o gate V0. A política Z-B e os contratos de produto não mudaram.

### 17.1 Ambiente e revisão

- Ubuntu 26.04.1 x64, Node `v24.22.0` instalado por mise, npm `11.19.1`, TypeScript `7.0.2` estrito, `yauzl` `3.4.0` e `yazl` `3.3.1`.
- Base Git `0fa1eaf7df348358fc85372dfec89c95a269cfe6`, branch `coderabbit/complete-zip64-backup-validation/9a96eb20`, com alterações locais descritas em IMPLEMENTATION_STATUS §29.
- O manifesto fixa um runtime Windows. Para esta execução, somente cópias temporárias de `package.json` e `package-lock.json` tiveram `node-win-x64` removido antes de `npm ci`; as demais versões/integridades são as do lockfile. Os arquivos rastreados não foram alterados. Não comprova compatibilidade geral do aplicativo com Linux.
- Fixtures sintéticas em diretórios temporários; nenhum vault pessoal. Os testes removem as próprias fixtures. Os casos pesados executam uma vez cada: provas de estrutura e integridade, sem pretensão de medição MP/AC-19.

### 17.2 Comandos e resultados observados

Em `poc/`:

```bash
mise exec node@24.22.0 -- npm test
ATLAS_AC13_HEAVY=1 mise exec node@24.22.0 -- node --test --test-reporter=tap --test-concurrency=1 dist/test/heavy/ac13-heavy.test.js
```

O primeiro comando executa runtime, typecheck, build e `node --test "dist/test/*.test.js"`. Os três testes iniciais de AC-13 entram nesse glob; os casos pesados são explícitos e ficam fora da suíte cotidiana.

Saída real da suíte principal, código **0**:

```text
ℹ tests 152
ℹ pass 152
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

| Caso | Evidência observada |
| --- | --- |
| ZIP clássico pequeno | Quatro entradas; sem EOCD ZIP64/localizador nem extra ZIP64 no diretório central |
| ZIP64 forçado | Localizador e EOCD ZIP64 presentes; contagem 4; sentinelas `0xffff`/`0xffffffff`; extra ZIP64 em cada entrada; manifesto relido igual; restauração em pasta nova, bytes e SHA-256 iguais à origem |
| ZIP64 adulterado | Conteúdo alterado → `hash-mismatch`; localizador fora do arquivo ou registro ZIP64 final ausente → `invalid-archive`. Todos na pré-validação, antes da confirmação, sem destino/dados do aplicativo criados e com origem intacta |
| Permissões sintéticas | `EACCES` e `EPERM` na criação do temporário e do destino: falha explícita, sem ZIP publicado/destino criado, sem estado de sucesso |
| Mais de 65.535 entradas reais | 65.536 anexos × 4 KiB + Tag + `settings.yml` + manifesto = **65.539 entradas**. Promoção ZIP64 automática, sem `forceZip64`; 65.538 arquivos extraídos e conferidos. Hash SHA-256 da lista do manifesto: `357c161d1f347a26ec113e3bd09e3a5ce4994d9cec40ac1f703f063566e06708`. Teste passou em 137,4 s, incluindo limpeza |
| Arquivo real acima de 4 GiB | **4.294.967.297 bytes**; promoção automática sem `forceZip64`; tamanhos clássicos em `0xffffffff`, tamanho ZIP64 relido exato e diretório central no offset **4.294.968.270**. Restauração Verificada, 3/3 arquivos. SHA-256 do anexo restaurado: `fbb82f7b353676bb562eb82157fcf0ea42c36492ca13ee56dbf82c08b6802c5c`. Teste passou em 61,9 s |

Saída real dos casos pesados, código **0**, em 199,5 s:

```text
ok 1 - AC-13 real: mais de 65.535 entradas promovem automaticamente para ZIP64 e restauram
ok 2 - AC-13 real: arquivo acima de 4 GiB promove tamanho e offsets para ZIP64 e restaura
# tests 2
# pass 2
# fail 0
# cancelled 0
# skipped 0
```

Os testes pesados usam o gerador/seed `atlas-ac19-v1` para a base. O arquivo grande tem origem esparsa de zeros, mas o ZIP usa store e a extração grava os bytes reais. O leitor auxiliar inspeciona rodapé/diretório central, usa leituras completas com limites de arquivo e não lê o ZIP inteiro; a integridade é conferida pelo verificador de produção e pela restauração.

**Regressão de I/O:** a suíte completa reexecutou EIO sintético, conflito, limpeza do temporário próprio, colisão sem sobrescrita, limites de espaço simulado, estruturas corrompidas e manutenção do diário. Uma sonda adicional em disco real, `mise exec node@24.22.0 -- node /tmp/atlas-check-permissions.mjs`, terminou com código 0: `chmod 0500` produziu EACCES real na exportação e na criação do destino; nenhum ZIP/destino falso, vault ativo intacto. Permissões restauradas e temporários removidos. Não simula disco fisicamente cheio nem permissões/GUI nativas do Windows.

**Falhas anteriores desta sessão:** execução inicial 144/146, por expectativa de caminho em maiúsculas do Windows no Linux; corrigida a expectativa conforme plataforma. Uma execução intermediária expôs cleanup global da fixture ao introduzir subtestes; substituído por cleanup no contexto proprietário. A execução final acima passou integralmente. A fixture de Markdown dos testes iniciais estava correta.

### 17.3 Limite de aceite e próxima etapa

**BLOQUEADO no sandbox Linux:** extração por `Shell.Application`/zipfldr, `tar.exe`, `Expand-Archive` e abertura manual no Explorador do Windows 11. Nenhum resultado dessas ferramentas foi inferido da leitura Node. Registrar extração e hashes separadamente na plataforma prioritária; incompatibilidade inaceitável reabre DQ-07, conforme VAULT_CONTRACT §7.5.

Próximo incremento **PROPOSTO**, antes de editar código estrutural: aprovar a composição F-2.v1; depois gerar amostras comprimíveis legítimas e F-3 maliciosas, medir razões e propor S-1 para decisão. Só após essa decisão implementar a razão de compressão do AC-07. Inbox depende das decisões Q-01/Q-02/Q-04; regras de nomes e prova nativa continuam com as dependências do relatório de 18/10, item 6.
