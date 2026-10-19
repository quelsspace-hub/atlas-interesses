# Atlas: PoC de persistência de um registro

**Estado:** PoC local parcial de persistência, regras puras D-001/D-003/D-004, renomeação de Tag, indexação efêmera de links/backlinks, criação de nova permanente D-008 e **exportação de backup** (incremento 1, 18/10/2026; ver `docs/IMPLEMENTATION_STATUS.md` §22). Os envelopes/tipos de teste são recortes experimentais, não entidades completas nem schema V1. Não altera os seis contratos confirmados, não decide defaults/nulabilidade e não resolve Q-01, Q-02 ou Q-03. A proposta de destinos da Inbox em Q-02 permanece pendente.

## Escopo

A prova de arquivo lê, valida e altera o `title` de um registro Markdown sintético com YAML Frontmatter contendo `id`, `title` e `sort_order`. `sort_order: 0` é apenas o valor literal da fixture; não há preenchimento de campos ausentes. O ID deve ser UUID v4. O arquivo fica em diretório temporário durante os testes.

As regras puras de domínio aceitam recortes com `tag_ids` para Item/Group e `project_id`/`status` para Task. A participação de grupo usa OR por UUID; o cálculo só recebe a coleção de tarefas que lhe é passada, não seleciona tarefas arquivadas nem representa projeto completo. Nenhuma relação é persistida.

A prova de Tag grava somente o registro Tag existente via `saveMetadata`; mantém UUID, caminho e corpo. A fixture contém duas Tags de UUIDs distintos com o mesmo título inicial, dois Groups que referenciam apenas uma e dois Items: um associado à Tag compartilhada e outro à Tag homônima distinta. Em seguida, enumera e relê arquivos Tag/Group/Item, cria mapas novos e calcula associações em memória. Bytes e hashes dos consumidores e `tag_ids` são comparados; a contagem confirma um arquivo por Item. A saída estruturada demonstra cálculos, não tela ou GUI. O índice é um recorte para fixture válida; tratamento geral de referências ausentes/arquivos inválidos e de registros arquivados permanece fora da prova.

A prova de links usa `markdown-it` `15.0.3` (MIT), preset CommonMark, `html: false` e `linkify: false`, lendo tokens `link_open` e `href`. Escopo aceito: links Markdown inline/reference para caminho relativo não vazio terminado em `.md`, com fragmento opcional; destino sob `notes/work`, `notes/reading` ou `notes/permanent`, basename `{UUID}.md` e `note_type` correspondente à pasta. Resolve relativo à nota de origem, por caminho/UUID, nunca título. Fragmento é retido, sem validação de heading.

Código inline, fences e imagens não viram relações. URLs externas, anchor-only, destino vazio, query local, arquivo não-Nota, Nota ausente, path fora da raiz e UTF-8 inválido geram diagnósticos tipados sem reescrever texto. `linkify` está desligado (URLs nuas não viram autolinks); autolinks CommonMark explícitos são tokens e URLs externas são diagnosticadas. HTML bruto e Wikilinks não são interpretados. A enumeração lê arquivos Markdown regulares diretamente nas pastas canônicas. Cada componente do path interno é classificado por `lstat` sem seguir symlink; destinos fora da raiz não são consultados. Nota malformada aborta a construção sem descarte silencioso. A fixture não define política geral de recuperação.

Os testes cobrem frontmatter inválido e chave duplicada, envelope inválido, UUID estável, corpo byte a byte e SHA-256, releitura, criação exclusiva, colisão de temporário sem remover arquivo alheio, conflito externo, falha de escrita parcial com cleanup, falha de rename preservando temporário diagnóstico e estado incerto pós-rename. Também cobrem OR, identidade por UUID, múltiplos grupos, progresso, isolamento, canceled, resultado fracionário e ausência de mutação.

A regra pura D-001 (`noteContextViolation`) aceita `work` somente com UUID v4 de Item, `reading` com `null` ou UUID v4 e `permanent` somente com `null`; chave `context_item_id` ausente e tipo desconhecido são rejeitados. Existência do Item só é verificada quando um conjunto de IDs é fornecido.

A prova de nova permanente (`createPermanentNoteFrom`) reconstrói o índice de Notas do disco, aceita origem `work` ou `reading` por UUID, gera UUID v4 novo (recusa UUID já usado por uma Nota indexada), valida D-001 e grava somente `notes/permanent/{UUID}.md` por criação exclusiva. O corpo é a elaboração fornecida seguida de `Origem: [título escapado](../{tipo}/{UUID}.md)`, formato copiado do exemplo documental, não decisão de UI; antes de gravar, confere que o link de origem é interpretado como link Markdown. A origem nunca é escrita. O envelope gravado é reduzido (`id`, `title`, `note_type`, `context_item_id`); timestamps, tags e demais campos continuam em Q-01.

A exportação (`src/backup/`) faz:

- inventário do vault sem seguir links, com classificação D-014/E-C e decisões explícitas;
- validação simétrica (registros inválidos, versões não suportadas, nomes ambíguos e links bloqueiam);
- manifesto M-B;
- ZIP temporário com criação exclusiva fora do vault, entradas sem compressão;
- nova varredura da C-A, releitura do ZIP e publicação por link físico, que nunca sobrescreve.

Usa `yauzl` 3.4.0 e `yazl` 3.3.1 (MIT), com versões exatas.

A restauração (`src/backup/restore.ts`) faz:

- pré-validação completa do ZIP antes de qualquer escrita;
- destino em pasta nova criada após confirmação, com pasta-pai e vault ativo comparados por caminho real;
- extração exclusiva em streaming, com diário nos dados do aplicativo gravado antes de cada item;
- validação dos registros, relatório com quatro estados e detecção de restauração incompleta no reinício;
- remoção limitada aos itens do diário e marcador mínimo de cópia não verificada.

Os limites da D-015 (VAULT_CONTRACT §7.5) valem na exportação e na restauração: teto do manifesto, recusa de caracteres de controle, caminho relativo de até 1.024 unidades UTF-16, segmento de até 255, profundidade de até 32, espaço livre na exportação e caminho absoluto no destino (padrão 259/247; a opção `pathLimits` informa um limite maior quando há suporte a caminhos longos). A razão de compressão ainda não tem valor e não é aplicada.

As medições do AC-19 (`bench/`, fora da suíte de testes) geram fixtures sintéticas no temporário do sistema, medem tempo e memória de cada operação num processo próprio e apagam tudo ao final:

```powershell
npm run build
node dist/bench/ac19-run.js --series i --steps 1048576,8388608 --runs 5 --out bench/results/saida.jsonl
node dist/bench/ac19-run.js --summarize bench/results/saida.jsonl
```

Use o Node pinado (`node_modules/.bin/node`). Os resultados de 18/10/2026 estão em `bench/results/` e são interpretados em [TEST_PLAN §15](../docs/TEST_PLAN.md). Descrevem uma máquina; não são limites.

Não inclui UI, Tauri, Inbox, abertura do vault restaurado, limite de razão de compressão, detecção de suporte a caminhos longos, progresso persistido, índice global/persistente, manutenção/reparo/movimentação de links, editor de Notas ou outras funcionalidades V1. Q-02 não foi ampliada por D-002 nesta prova.

## Ambiente e dependências

Ambiente executado: Windows x64, Node.js local `24.22.0` (`node-win-x64` em `poc/node_modules`), npm `10.8.2`, TypeScript `7.0.2`, `@types/node` `24.19.2`, `yaml` `2.9.1` e `markdown-it` `15.0.3`. As dependências têm versões exatas no manifesto e lockfile. O SHA-256 do executável instalado foi comparado com o publicado pelo Node.js para `win-x64/node.exe`: `ba93f9a70bd86fce3ebbb39ec758501458453467aa92a34a0a3602d1e3fc2b9c`. O Node global observado antes da instalação era `20.20.2` e está EOL; os scripts npm usam o runtime local pinado. Nenhum runtime foi instalado globalmente e nenhuma configuração de sistema foi alterada.

As escolhas são específicas desta prova, não uma aprovação da stack do aplicativo. `node:fs`, `node:crypto` e `node:test` cobrem I/O, SHA-256 e testes. `yaml` `parseDocument()` fornece `errors` e verifica unicidade de chaves por padrão; `markdown-it` fornece parsing CommonMark e tokenização de links, sem regex artesanal. Fontes consultadas em 2026-10-17:

- Node.js releases: https://nodejs.org/en/about/previous-releases
- Node.js 24.22.0 LTS: https://nodejs.org/en/blog/release/v24.22.0
- YAML parser docs: https://eemeli.org/yaml/
- YAML parser source: https://github.com/eemeli/yaml
- markdown-it docs: https://markdown-it.github.io/markdown-it/
- markdown-it token architecture: https://github.com/markdown-it/markdown-it/blob/master/docs/architecture.md
- markdown-it usage/options: https://github.com/markdown-it/markdown-it/blob/master/docs/usage.md

## Executar

Em PowerShell, dentro desta pasta:

```powershell
npm ci
npm test
```

`npm ci` precisa de Node/npm capaz de executar o instalador. Após a instalação local, `npm test` verifica o Node pinado, executa TypeScript em modo estrito, compila e roda os testes nativos do Node. A saída documentada em [IMPLEMENTATION_STATUS.md](../docs/IMPLEMENTATION_STATUS.md) registra os comandos realmente executados.

## Limites da escrita

O adapter cria destinos com abertura exclusiva (`wx`), não com consulta prévia de existência. Para editar, calcula a revisão SHA-256 lida, grava e sincroniza um temporário ao lado do destino, relê o original imediatamente antes de `rename`, compara a revisão e confere o conteúdo persistido depois do rename. Conflitos preservam os bytes externos e carregam o rascunho local e hashes no diagnóstico. A limpeza só remove um temporário depois de a abertura exclusiva o criar; erro `EEXIST` não remove o arquivo alheio. Falha após possível substituição resulta em estado incerto; não há rollback automático.

A comparação de SHA-256 imediatamente antes de `rename` **não é compare-and-swap atômico**. Um escritor ainda pode alterar o destino entre essa comparação e o rename. A prova não afirma proteção contra todos os escritores concorrentes, queda de energia ou falha física de disco. `FileHandle.sync()` do temporário e releitura verificam somente os casos exercitados aqui; durabilidade e semântica de rename devem ser provadas por plataforma. Falhas locais simuladas não comprovam TC-17 nativo.

## Relação com TC planejados

- **TC-01:** subcasos de frontmatter válido, YAML inválido, chave duplicada e validação do envelope reduzido. Não cobre versão de schema futura ou todos os tipos do modelo.
- **TC-02:** subcaso de título alterado, UUID preservado e arquivo relido. Não cobre reinício do aplicativo nem restauração de backup.
- **TC-03:** colisão de destino não sobrescreve e conserva hash. Cobertura delimitada à criação exclusiva local.
- **TC-06:** corpos LF/CRLF com Unicode, espaços finais, linhas vazias, fence e sem newline final; compara bytes e SHA-256 antes/depois. Cobertura do subcaso de metadados apenas.
- **TC-16:** alteração externa entre leitura inicial e conferência pré-rename; preserva arquivo externo e rascunho. Não elimina a janela de corrida entre conferência e rename.
- **TC-04, OR em memória:** interseção por UUID, vazio, IDs diferentes com título igual, um Item em vários Groups e não mutação.
- **TC-04, rename/reconstrução:** rename isolado; UUID/caminho/corpo preservados; consumidores e referências não regravados; índice antigo descartado, arquivos relidos, mapas novos e associação recalculada. Fixture somente.
- **TC-04, GUI:** não demonstrada; TC-04 completo permanece pendente.
- **TC-05:** D-003 provado apenas para cálculo puro: todos os estados, canceled excluída, tarefas avulsas e outros projetos ignorados, null sem elegíveis e percentual fracionário sem arredondar, calculado na ordem oficial `100 * done / eligible` (correção de 18/10/2026; antes `done / eligible * 100`). Seleção de tarefas arquivadas permanece fora da cobertura/Q-03.
- **TC-07:** subcasos de links de saída/backlinks reconstruídos do disco; código, URLs externas e imagens excluídos; âncora isolada ignorada; alvos não-Nota, ausente e fora da raiz diagnosticados. Não cobre todo Markdown, anchors resolvidos, restart de aplicativo ou mudanças concorrentes.
- **TC-08:** subcaso de dois títulos iguais resolvidos por caminho/UUID; renomear título do destino conserva resolução e corpo. Alias não é usado como chave. Não cobre UI/seletor de notas.
- **TC-09:** subcaso de nova permanente a partir de work e reading: UUID novo, contexto null, origem com bytes/SHA-256 iguais, nenhum outro arquivo alterado, backlink reconstruído do disco; recusas e colisão sem gravação. Não cobre restart do aplicativo, editor ou GUI.
- **TC-22:** subcasos da função pura D-001 para os três tipos, chave ausente, referência inválida/desconhecida e tipo desconhecido. Não cobre criação/edição de Notas work/reading nem índice de Items.
- **TC-17:** não executado. Testes de falha Node não representam permissão, ciclo GUI ou I/O nativo.

Nenhum desses subcasos marca um TC completo como aprovado.