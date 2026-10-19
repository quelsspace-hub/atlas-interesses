# Modelo de dados e schemas — Atlas V1

**Versão:** 3.0-PROPOSTA-CONSOLIDADA · 18/10/2026

**Natureza:** contrato detalhado para revisão na V0. Regras de produto D-001–D-012 permanecem decididas. D-014 (18/10/2026) define o conjunto canônico do vault e a configuração portátil (§1 e §2). Os seis contratos reconfirmados na auditoria corretiva estão registrados em [DECISIONS.md](DECISIONS.md); demais propostas de campos e defaults continuam sujeitas a fechamento antes da implementação. Não há banco, parser ou migração implementados.

## 1. Regras globais

- Um registro por arquivo `.md`, com YAML Frontmatter e corpo Markdown.
- UUID v4 de 36 caracteres em `id`, gerado uma vez. Nome do arquivo: `{id}.md`.
- Timestamps: strings ISO-8601 UTC, por exemplo `2026-10-18T12:00:00.000Z`.
- Datas sem horário: strings `YYYY-MM-DD`; não converter automaticamente em meia-noite UTC.
- Strings de data e cores devem ser citadas no YAML. `null`, booleanos e inteiros não usam aspas.
- Arrays vazios são `[]`. Não serializar enums como uma string contendo todas as alternativas.
- `schema_version: 1` identifica o formato proposto inicial de cada registro. A versão deste documento não é a versão dos dados. O campo `schema_version` de cada registro é a **única** fonte da versão do schema dos registros (D-014). A versão do schema apresentada ao usuário é **derivada** dos registros válidos; se houver mais de uma (por exemplo, durante uma migração), todas são apresentadas, com diagnóstico. Nenhum outro arquivo guarda uma versão do schema dos registros. Versão não suportada bloqueia a exportação e a restauração, sem migração automática (D-013, emendas A-01 e A-10). Em um vault sem registros, nenhuma versão é apresentada; a interface e o relatório informam “sem registros” (A-14).
- Conteúdo canônico do vault (D-014): os registros, os anexos em `assets/` e o `settings.yml` opcional (§2). Anexos e `settings.yml` não são registros e não guardam dados de entidades; a fonte de verdade das entidades continua sendo os registros Markdown (D-011).
- Obrigatório significa que a chave deve existir; campos anuláveis usam `null` quando sem valor. Opcionais podem estar ausentes; ao ler, ausência equivale ao default descrito.
- Campos desconhecidos devem ser preservados ao editar metadados; versão não suportada não deve ser regravada automaticamente.
- Referências devem apontar para UUID existente da entidade correta. Referências ausentes geram diagnóstico, não exclusão automática.

## 2. Pastas canônicas recebidas na REC

```text
vault/
├── groups/{id}.md
├── tags/{id}.md
├── items/{id}.md
├── tasks/{id}.md
├── notes/work/{id}.md
├── notes/reading/{id}.md
├── notes/permanent/{id}.md
└── inbox/{id}.md
```

Manifestos temporários ficam em `inbox/.txn_{capture_id}.json`; temporários de escrita usam `.tmp-{UUID v4 aleatório}.md` na pasta do destino, isto é, o nome é exatamente `.tmp-` + UUID v4 + `.md` (A-09, 18/10/2026; formato já usado pela PoC). *Redação anterior: “temporários de escrita usam `.tmp_{id}.md` na pasta do destino”.* Não guardar cache como fonte canônica. Os caminhos antigos por tipo de Item e notas por pasta de projeto foram substituídos pela organização REC, mantendo relações no YAML.

### 2.1 Conteúdo canônico e configuração portátil — DECIDIDO (D-014, 18/10/2026)

```text
vault/
├── (pastas de registros acima)
├── assets/...        # anexos: qualquer arquivo regular, em qualquer subpasta
└── settings.yml      # opcional: somente configuração portátil
```

- **Registros:** arquivos com nome `{UUID}.md` nas pastas acima.
  - Um arquivo com esse nome que não valide (YAML, UUID, pasta coerente com o tipo, versão de schema suportada) é um **registro inválido**. Ele bloqueia a exportação até ser corrigido e não pode ser incluído pelo inventário (D-013, emenda A-01).
  - Outros arquivos nessas pastas, inclusive `.md` com outro nome, são conteúdo não canônico (inventário E-C) e não são validados como registros.
  - Os temporários `.tmp-{UUID}.md` são excluídos.

  *Redação anterior: “Registros: arquivos `{id}.md` válidos nas pastas acima. Um `.md` fora desse padrão, ou que não valide, não é registro canônico.”*
- **Anexos:** todo arquivo regular sob `assets/`, em qualquer subpasta e de qualquer formato, preservado com os bytes intactos. Ainda não há regra de nomes, organização, formatos aceitos ou tamanho de entrada; essa política pertence à Q-10. *Complemento de 18/10/2026 (D-015):* como todo caminho do vault, os caminhos de anexos seguem os limites de segurança do backup ([VAULT_CONTRACT §7.5](VAULT_CONTRACT.md)): até 1.024 caracteres UTF-16 e 3.072 bytes UTF-8; até 255 caracteres por segmento; até 32 segmentos; sem U+0000–U+001F. Um caminho fora disso bloqueia a exportação. Isso não define organização, formatos nem tamanho de anexos, que continuam na Q-10.
- **`settings.yml`:** **opcional**. A ausência significa ausência de configuração portátil e não invalida o vault. Quando existe, contém `settings_version` (inteiro, versão do formato do próprio arquivo) e somente chaves de configuração portátil aprovadas individualmente. Nenhuma chave está aprovada além de `settings_version`. Chaves desconhecidas são preservadas sem interpretação, como na regra de campos desconhecidos do §1. Quando presente, o arquivo é validado na exportação e na restauração: YAML inválido ou `settings_version` não suportado bloqueia (A-01, A-10). **Versão suportada pela PoC — decisão de 18/10/2026 (pendência B do incremento 1):** apenas `settings_version: 1`, como inteiro YAML. Valor ausente, nulo, não inteiro ou em texto (`"1"`) é inválido; qualquer outro inteiro é versão não suportada. A decisão vale só para a PoC e não define compatibilidade futura, migração ou comportamento de produção, que continuam abertos (Q-10). `settings_version` não é a versão do schema dos registros.
- **Fora do vault** (dados do aplicativo no dispositivo, fora do backup): localização do vault ativo, vaults recentes, tema Light/Dark, estado da interface, caches e índices, diário e marcador de restauração. Caches e índices do aplicativo nunca ficam dentro do vault.
- **Outras versões, distintas do schema dos registros:** `manifest_version` (formato do manifesto de backup, [VAULT_CONTRACT §7.1](VAULT_CONTRACT.md)) e a chave `schema_version` do manifesto de transação da Inbox ([VAULT_CONTRACT §4](VAULT_CONTRACT.md), PROPOSTO), que designa o formato desse manifesto. Renomeá-la fica com Q-02/Q-04.
- **Continuam abertos:** lista de chaves portáteis, política de entrada de anexos, schema futuro e edição externa (Q-10); congelamento de `schema_version: 1` (Q-01, §11).

Redação anterior, preservada: “Complementos **PROPOSTOS**: `settings.yml` para versão/configuração local do vault e `assets/` para anexos.”

## 3. Campos comuns

Group, Tag, Item, Task e Note possuem:

| Campo | Tipo | Presença / regra |
| --- | --- | --- |
| `id` | UUID v4 | Obrigatório, imutável |
| `schema_version` | inteiro | Obrigatório, `1` nesta proposta |
| `title` | string | Obrigatório, não vazio após remover espaços externos |
| `created_at` | timestamp | Obrigatório, não mudar ao editar |
| `updated_at` | timestamp | Obrigatório, atualizar após alteração persistida |
| `archived_at` | timestamp ou null | Obrigatório, null enquanto não arquivado |

**Proposta de normalização:** usar `title` para nomes visíveis de todas essas entidades, como na REC. Não persistir `name`/`slug` em paralelo. IDs nos caminhos tornam slug dispensável. O tipo é determinado pela pasta para Group, Tag e Task; Item usa `type` e Note usa `note_type`. Não adicionar `type: tag` apenas para repetir a informação do caminho.

## 4. Group

Área temática derivada de tags. Além dos campos comuns:

| Campo | Tipo | Presença / default | Regra |
| --- | --- | --- | --- |
| `description` | string | Opcional, `""` | Descrição curta; corpo contém texto longo |
| `color` | string ou null | Opcional, null | Hexadecimal `#RRGGBB`; não usar para identidade |
| `icon` | string ou null | Opcional, null | Nome de ícone; biblioteca ainda pendente |
| `tag_ids` | lista de UUID | Obrigatório, `[]` | Sem duplicatas; referências a Tag |
| `sort_order` | inteiro | Obrigatório | Ordenação na navegação |

Não persistir `item_ids`. Títulos repetidos devem gerar aviso, sem alterar identidade. Grupo sem tags existe e mostra estado vazio.

## 5. Tag

Classificador reutilizável. Além dos campos comuns:

| Campo | Tipo | Presença / default | Regra |
| --- | --- | --- | --- |
| `description` | string | Opcional, `""` | Ajuda a distinguir conceitos |
| `color` | string ou null | Opcional, null | Hexadecimal `#RRGGBB` |
| `aliases` | lista de strings | Opcional, `[]` | Sinônimos, sem duplicatas vazias |

Avisar sobre nomes equivalentes por caixa/espaço, sem fundir entidades automaticamente. Renomear não altera `tag_ids` dos consumidores. Arquivar preserva referências; substituição por outra tag precisa de operação explícita e teste. Não manter lista inversa de grupos/itens no arquivo da Tag.

## 6. Item

Além dos campos comuns:

| Campo | Tipo | Presença / default | Regra |
| --- | --- | --- | --- |
| `type` | enum | Obrigatório | `project`, `course`, `interest`, `idea`, `learning_path`, `goal` |
| `tag_ids` | lista de UUID | Obrigatório, `[]` | Tags existentes, sem duplicatas |
| `status` | enum | Obrigatório | `backlog`, `planned`, `active`, `paused`, `completed`, `archived` |
| `priority` | enum | Opcional | `low`, `medium`, `high` |
| `summary` | string | Opcional, `""` | Resumo para listagens |
| `start_date` | data ou null | Opcional, null | Início informado pela pessoa |
| `target_date` | data ou null | Opcional, null | Prazo-alvo; alertar se anterior ao início |
| `external_url` | string ou null | Opcional, null | URL externa, substitui o nome antigo `url` |
| `provider` | string ou null | Opcional, null | Instituição/plataforma de curso |
| `progress_mode` | enum | Obrigatório | `tasks`, `manual`, `none` |
| `manual_progress` | inteiro ou null | Obrigatório | 0–100 em manual; null nos demais modos |
| `objective` | string ou null | Opcional, null | Resultado pretendido |
| `success_criteria` | lista de strings | Opcional, `[]` | PROPOSTO: lista de critérios observáveis |
| `origin_capture_id` | UUID ou null | Opcional, null | Captura que originou o item |

### Estados canônicos aprovados de Item.status

| Estado | Significado |
| --- | --- |
| `backlog` | Possibilidade ainda sem compromisso de execução |
| `planned` | Planejado para começar |
| `active` | Em execução/exploração atual |
| `paused` | Interrompido, com possibilidade de retomada |
| `completed` | Resultado considerado concluído pela pessoa |
| `archived` | Retirado das vistas correntes, preservado no acervo |

`active` cobre execução. `in_progress` e `canceled` pertencem a Task.status, não a Item.status. A proposta P-02 foi superada pela confirmação do contrato original; o histórico está em [DECISIONS.md](DECISIONS.md). Arquivar Item ajusta status e `archived_at` em conjunto. Desarquivar requer escolher status de destino, pois o formato não persiste status anterior. Não inferir conclusão do percentual.

**Defaults propostos por tipo:** project → tasks; course, learning_path e goal → manual; interest e idea → none. `tasks` só é válido para project. A pessoa pode escolher manual/none para projeto. Novos itens iniciam em backlog; esses defaults precisam do fechamento Q-01.

## 7. Task

Além dos campos comuns:

| Campo | Tipo | Presença / default | Regra |
| --- | --- | --- | --- |
| `status` | enum | Obrigatório, `todo` | `todo`, `in_progress`, `done`, `canceled` |
| `project_id` | UUID ou null | Obrigatório | Só Item com `type: project`; null para avulsa |
| `is_next_action` | booleano | Obrigatório, false | Destacar nas tarefas abertas |
| `due_date` | data ou null | Opcional, null | Prazo local sem horário |
| `priority` | enum | Opcional | `low`, `medium`, `high` |
| `sort_order` | inteiro | Obrigatório | Ordenação dentro do projeto ou da lista |
| `completed_at` | timestamp ou null | Obrigatório | Preencher em done; limpar ao reabrir |
| `origin_capture_id` | UUID ou null | Opcional, null | Captura de origem |

Detalhes longos ficam no corpo Markdown; não duplicar em `description`. Concluir/cancelar limpa `is_next_action` na proposta; reabrir não restaura a marca automaticamente. Sem subtarefas ou dependências na V1.

Para progresso, selecionar pelo `project_id` correto e contar todo/in_progress/done. **Q-03:** proposta conta também tarefas arquivadas nesses estados, para arquivamento de apresentação não alterar o histórico de progresso. Canceled continua excluída. Documentar decisão antes do teste final.

## 8. Note

Além dos campos comuns:

| Campo | Tipo | Presença / default | Regra |
| --- | --- | --- | --- |
| `note_type` | enum | Obrigatório | `work`, `reading`, `permanent` |
| `context_item_id` | UUID ou null | Obrigatório | Validação D-001 |
| `tag_ids` | lista de UUID | Obrigatório, `[]` | Tags existentes |
| `aliases` | lista de strings | Opcional, `[]` | Títulos anteriores para seleção/pesquisa, não chaves relacionais |
| `source_title` | string ou null | Opcional, null | Título da fonte |
| `source_author` | string ou null | Opcional, null | Autoria da fonte |
| `source_url` | string ou null | Opcional, null | URL da fonte |
| `source_year` | inteiro ou null | Opcional, null | Ano informado |
| `origin_capture_id` | UUID ou null | Opcional, null | PROPOSTO: restaurado do original para rastrear conversão |

A pasta deve corresponder a `note_type`. Work aponta para Item de qualquer um dos seis tipos; reading pode ser independente; permanent exige null. Para novos vínculos, sugerir itens ativos; referências históricas a itens arquivados continuam resolvíveis.

**Criação de permanente (D-008):** criar novo UUID e timestamps, tipo permanent e contexto null. O corpo novo é uma elaboração editável com link relativo para a nota de origem. A nota original não é regravada automaticamente. Um backlink durável é derivado do link persistido, nunca de memória exclusiva. Sem promessa de cópia byte a byte do corpo da nova nota; D-006 protege a original e operações somente de metadados.

## 9. InboxCapture

Não herda o conjunto de campos comuns integralmente. A captura exige apenas conteúdo no corpo e metadados gerados automaticamente.

| Campo | Tipo | Presença / default | Regra |
| --- | --- | --- | --- |
| `id` | UUID v4 | Obrigatório | Identidade da captura |
| `schema_version` | inteiro | Obrigatório, 1 | Formato proposto |
| `title` | string ou null | Opcional, null | Nome curto, não obrigatório para capturar |
| `capture_kind` | enum | Obrigatório | `thought`, `link`, `task`, `project`, `course`, `note`, `undecided` |
| `status` | enum | Obrigatório, `pending` | pending/processed/archived |
| `captured_at` | timestamp | Obrigatório | Momento da captura |
| `processed_at` | timestamp ou null | Obrigatório | Só preencher após commit da conversão |
| `archived_at` | timestamp ou null | Obrigatório | Arquivamento sem apagar conteúdo |
| `converted_to_type` | enum ou null | Obrigatório | Seis tipos de Item, task, note, ou null |
| `converted_to_id` | UUID ou null | Obrigatório | Resultado principal; nulo junto com tipo |

**Proposta Q-02:** conteúdo original no corpo Markdown, sem duplicação em `content` no YAML. A REC usava `content`; o original e os fluxos exigem preservar texto longo. Conversão em Note exige `origin_capture_id`, complemento listado acima. Uma captura gera um resultado principal; a conversão em projeto pode gerar tarefas derivadas com a mesma origem.

Pending: campos de conversão e processed_at nulos. Processed: resultado principal existente e processed_at preenchido. Archived preserva eventuais campos de conversão; desarquivar volta a processed se houver conversão, senão pending. Não reprocessar automaticamente uma captura convertida.

Para estes seis contratos, a fonte original confirma enums e obrigatoriedade; não estabelece defaults para `sort_order`/`capture_kind` nem nulidade ou default para as prioridades opcionais. Os valores dos exemplos não definem defaults. `undecided` é um valor permitido, sem exigir classificação definitiva na captura.

## 10. Contratos derivados

- Regra OR: interseção não vazia de UUIDs de tags.
- Percentual não é campo persistido quando `progress_mode: tasks`.
- Backlinks e grupos visíveis são calculados; não persistir listas espelhadas.
- Manifesto de transação não é entidade de produto: veja [contrato de vault](VAULT_CONTRACT.md).
- Anexos usam links relativos para `assets/`; política de formatos/tamanho ainda precisa de PoC. Desde 18/10/2026 (D-014), todo arquivo regular sob `assets/`, em qualquer subpasta, é conteúdo canônico preservado com os bytes intactos no backup (§2.1). A política de formatos, tamanhos e nomes continua aberta (Q-10) e, quando definida, vale na entrada do anexo, não no backup.

## 11. Exemplos e validação

O [vault fictício](examples/README.md) contém exemplos concretos com UUIDs válidos, datas citadas e links relativos. Todos seguem esta **proposta**, sem indicar aprovação do schema final.

Antes de congelar `schema_version: 1`, resolver Q-01 a Q-05, comprovar parsing/escrita, edição externa e restauração. Como não há dados reais existentes confirmados, não inventar migração já executada. Futuros dados incompatíveis exigirão migração explícita e backup anterior.

## Atualização de backup — S-1, 19/10/2026

**DECIDIDO:** [D-016](DECISIONS.md) permite recusar ZIPs externos legítimos por razão de compressão; exportações Atlas permanecem restauráveis via store. Regra central em [VAULT_CONTRACT §7.5](VAULT_CONTRACT.md). Nenhum schema de entidade muda. **PENDENTE:** limite numérico padrão; mecanismo explícito verificado apenas na PoC ([TEST_PLAN §20](TEST_PLAN.md)), não na aplicação V1.
