# Decisões de produto

**Atualização:** 18/10/2026. Decisões documentais não significam implementação validada. A aceitação das recomendações da comparação pela proprietária orienta esta consolidação.

| ID | Regra vigente | Estado | Consequência |
| --- | --- | --- | --- |
| D-001 | `work` exige contexto, `reading` aceita contexto, `permanent` tem contexto nulo | DECIDIDO | Validação por tipo |
| D-002 | Captura preservada; resultado principal e registros derivados rastreáveis; commit recuperável | DECIDIDO | Proibir processamento aparente sem escrita |
| D-003 | Progresso por tarefas elegíveis; sem tarefas retorna null; canceled excluída | DECIDIDO | Percentual não conclui projeto sozinho |
| D-004 | Grupos por OR de UUIDs de tags; renomeação isolada | DECIDIDO | Não persistir vínculo direto grupo↔item |
| D-005 | UUID v4 imutável por entidade | DECIDIDO | Nova entidade recebe novo UUID |
| D-006 | Alteração exclusiva de YAML preserva bytes do corpo | DECIDIDO | Separar edição de metadados e de texto |
| D-007 | Backup ZIP e hashes; restauração em pasta nova | DECIDIDO | Provar recuperação na V0 |
| D-008 | Criar nova permanente, preservar contextual, incluir link da nova para origem | DECIDIDO na reconciliação | Substitui mudança de tipo in-place da REC |
| D-009 | Links Markdown relativos como representação canônica | DECIDIDO na reconciliação | Substitui promessa de wikilinks no guia antigo |
| D-010 | Hub conceitual central; layout interno sujeito a protótipo | DECIDIDO na reconciliação | Retira proibição absoluta de sidebar interna |
| D-011 | Markdown local como fonte; índices reconstruíveis | DECIDIDO | Banco/cache não pode se tornar fonte exclusiva |
| D-012 | Separar status declarado de evidência | DECIDIDO | PoC e testes inexistentes não recebem PASS |
| D-013 | Política técnica de backup da Q-05: manifesto M-B, exclusões E-C, consistência C-A, estrutura de limites L-C, links S-A, anexos opacos, regras de validação e restauração como cópia independente. **Emenda de 18/10/2026 (DQ-06):** acrescentada a categoria de limite “comprimento do caminho absoluto no destino”. **Emendas de 18/10/2026, bloco 2:** destino criado pelo aplicativo (DQ-19); limites classificados em segurança e capacidade, sem teto derivado de F-2 (DQ-03/DQ-05); nenhum caminho de cache dentro do vault (DQ-13). **Emendas pós-auditoria de 18/10/2026:** exportação simétrica à restauração, com registros inválidos bloqueando (A-01); padrão de temporários `.tmp-{UUID}.md` (A-09); versões não suportadas bloqueiam (A-10) | DECIDIDO em 18/10/2026, parcial; emendado em 18/10/2026 | Detalhe em [VAULT_CONTRACT §7](VAULT_CONTRACT.md). Pendências em aberto: valores dos limites de segurança (*decididos em 18/10/2026 pela D-015, exceto a razão de compressão*), AC-13, detecção nativa de pontos de reparo, recuperação da Inbox (Q-02/Q-04), visual da GUI (Q-08), política de migração (Q-10). Complementa D-007 sem alterá-la; não implementada |
| D-014 | Conteúdo canônico do vault: registros, anexos em `assets/` e `settings.yml` (opcional, só configuração portátil). Configuração do dispositivo, caches e índices ficam fora do vault. Versão do schema derivada dos registros (DQ-10 a DQ-13) | DECIDIDO em 18/10/2026; não implementada | Detalhe em [DATA_MODEL §1, §2 e §10](DATA_MODEL.md); resolve o item pendente de VAULT_CONTRACT §7.2 sem alterar a regra da D-013; complementa D-011; não fecha Q-01 nem Q-10 |
| D-015 | Valores dos limites do backup (AC-07), pela [PROPOSTA_AC07_LIMITES](PROPOSTA_AC07_LIMITES.md) com a **alternativa B** de caminho: bytes reais com tolerância zero; contagens iguais; teto do manifesto; recusa de U+0001–U+001F em caminhos; caminho relativo ≤ 1.024 caracteres UTF-16 e ≤ 3.072 bytes UTF-8; segmento ≤ 255 caracteres; profundidade ≤ 32; capacidade só por verificação em execução, com o caminho absoluto no destino conferido contra o limite que a plataforma oferece de fato | DECIDIDO em 18/10/2026 pela proprietária; implementada na PoC Node em 18/10/2026, exceto a razão de compressão ([TEST_PLAN §16](TEST_PLAN.md)) | Detalhe em [VAULT_CONTRACT §7.5](VAULT_CONTRACT.md). Preenche valores da estrutura L-C da D-013 sem alterar suas regras. **Pendente:** razão de compressão (sem valor; exige F-2.v1 e F-3 maliciosos). Não fecha Q-05 nem Q-07 |

## Seis contratos confirmados na auditoria corretiva

A proprietária reafirmou as regras abaixo e autorizou sua correção documental. Fonte: `ESPECIFICACAO_V1.md` original preservada no [ZIP histórico](reference/fontes-originais.zip); localização exata em [SOURCES.md](SOURCES.md). Estas regras não estão abertas em P-01/P-05 ou Q-01/Q-03.

| Contrato | Regra vigente | Fonte original |
| --- | --- | --- |
| Item.status | `backlog`, `planned`, `active`, `paused`, `completed`, `archived` | §2.3, linha 69 |
| Item.priority | Opcional: `low`, `medium`, `high` | §2.3, linha 70 |
| Task.priority | Opcional: `low`, `medium`, `high` | §2.4, linha 104 |
| Task.sort_order | Inteiro obrigatório | §2.4, linha 107 |
| Group.sort_order | Inteiro obrigatório | §2.1, linha 30 |
| InboxCapture.capture_kind | Obrigatório: `thought`, `link`, `task`, `project`, `course`, `note`, `undecided` | §2.6, linha 152 |

A obrigatoriedade é do registro persistido. Não se aprova nesta correção default automático nem nova regra de nulidade. O valor `canceled` permanece em Task.status.

## Propostas que ainda precisam ser fechadas

- P-01: demais campos e defaults propostos de DATA_MODEL; os seis contratos confirmados acima não são reabertos.
- P-03: sete telas principais, Projetos como filtro e Configurações como área utilitária.
- P-04: detalhes de transação, edição externa, backup e migração do contrato de vault. Atualização de 18/10/2026: a parte de backup foi parcialmente formalizada em D-013; transação, edição externa e migração continuam propostas.
- P-05 (escopo remanescente): semântica de tarefas arquivadas no progresso; prioridade e obrigatoriedade de sort_order já estão confirmadas.

Esses pontos estão escritos de forma concreta para revisão e PoC; não são alegações de aprovação de valores que a proprietária ainda não escolheu individualmente. Veja [questões em aberto](OPEN_QUESTIONS.md).

## Histórico de propostas superadas pela correção autorizada

- **P-02 — SUPERADA:** propunha sete estados de Item, incluindo `canceled`, e tratava o enum como aberto. O contrato original aprovado tem os seis estados registrados acima; não houve aprovação específica para ampliá-lo.
- **Prioridades — ampliação SUPERADA:** a consolidação incluiu `urgent` em Item.priority, com base na REC, e o estendeu a Task.priority. A correção preserva `low`, `medium`, `high` para ambos.
- **P-05 — PARCIALMENTE SUPERADA:** a redação anterior agrupava “prioridade/ordem de tarefas e semântica de tarefas arquivadas no progresso”. Prioridade e sort_order deixaram de ser propostas; apenas a semântica de arquivamento permanece pendente.
- **Obrigatoriedade — propostas SUPERADAS:** Group.sort_order, Task.sort_order e InboxCapture.capture_kind haviam sido classificados como opcionais na consolidação. A especificação original os marca “Sim” na coluna Obrigatório. Os defaults `0` e `undecided` e a nulidade/default das prioridades não ficam aprovados por esses exemplos ou pela presente correção.

## Emendas registradas

### D-013 — emenda de 18/10/2026 (DQ-06)

- **Autorização:** a proprietária aceitou a DQ-06 do bloco 1 de [PROPOSTA_BLOQUEIOS_Q05](PROPOSTA_BLOQUEIOS_Q05.md).
- **Problema:** o caminho restaurado precisa caber no limite de caminho da plataforma. No Windows, ele é de 260 caracteres sem suporte a caminhos longos, e isso não depende só do caminho relativo.
- **Mudança:** acrescentada a categoria “comprimento do caminho absoluto no destino” à estrutura de limites L-C. Ela é distinta de “comprimento e profundidade de caminho”, que se refere ao caminho relativo da entrada.
- **Redação anterior das categorias**, preservada: número de entradas; tamanho por arquivo; tamanho total descompactado; razão de compressão por entrada; comprimento e profundidade de caminho.
- **Impacto:** [VAULT_CONTRACT §7.5](VAULT_CONTRACT.md) e TEST_PLAN AC-07. Não há migração, porque nada está implementado. O valor numérico continua PENDENTE.
- **Alternativa rejeitada:** não acrescentar a categoria e manter só o caminho relativo (opção da DQ-06). *Campo completado em 18/10/2026 (A-12).*
- **Testes:** AC-07. **Decisão:** proprietária, DQ-06 (bloco 1).

### Complementos de D-013 no mesmo bloco (sem novo ID e sem alterar a regra)

- DQ-05 (critérios de fixação dos valores) e DQ-07 (ZIP64 Z-B, com AC-13 pendente) preenchem pendências que a própria D-013 deixava abertas. Estão registrados em [VAULT_CONTRACT §7.5](VAULT_CONTRACT.md).
- DQ-01, DQ-02, DQ-04, DQ-08 e DQ-09 (plataforma prioritária, fixtures, protocolo de medição e abordagem dos testes de links e pontos de reparo) estão registrados em [TEST_PLAN §12](TEST_PLAN.md).

### D-013 — emendas de 18/10/2026 (bloco 2)

**Autorização:** a proprietária aceitou as DQ-03 e DQ-10 a DQ-25 de [PROPOSTA_BLOQUEIOS_Q05](PROPOSTA_BLOQUEIOS_Q05.md), as cinco respostas da revisão do plano e as três respostas da seção F.3, e autorizou a edição documental. Detalhe normativo em [VAULT_CONTRACT §7](VAULT_CONTRACT.md).

1. **Destino da restauração (DQ-19, VAULT_CONTRACT §7.7 item 1).**
   - **Problema:** aceitar pasta vazia existente abre uma janela entre “verificar que está vazia” e “escrever”, e impede provar que tudo na pasta foi criado pela restauração.
   - **Alternativa rejeitada:** aceitar pasta vazia existente.
   - **Mudança:** pasta nova criada pelo aplicativo, com criação exclusiva, dentro de uma pasta-pai escolhida pela pessoa. A pasta-pai é resolvida para o caminho real e não pode se sobrepor ao vault ativo. A pasta criada e o seu conteúdo são verificados sem seguir links.
   - **Redação anterior, preservada:** “Destino: pasta nova ou vazia, fora do vault ativo (DECIDIDO: pasta nova).”
   - **Impacto:** fica mais alinhada a D-007 e à documentação oficial §6 (“pasta nova”). Afeta AC-08 e AC-16. Não há migração.
   - **Testes:** AC-08 e AC-16. **Decisão:** proprietária, DQ-19 opção A e resposta F.3 item 3. *Campos completados em 18/10/2026 (A-12).*
2. **Critérios e classes de limite (DQ-03, DQ-05, VAULT_CONTRACT §7.5).**
   - **Problema:** o critério 1 (“máximo observado em F-2 multiplicado por uma margem”) e o teto de tempo do critério 2 transformariam um conjunto sintético em teto para o tamanho do vault.
   - **Mudança:** limites de segurança da restauração, fixados por critérios técnicos, separados de limites de capacidade do ambiente, verificados em execução. Número de entradas, tamanho por arquivo e tamanho total passam a ser limites de capacidade, sem teto derivado de F-2. Os controles de segurança continuam obrigatórios.
   - **Redação anterior dos critérios 1 e 2, preservada:** “1. ser maior ou igual ao máximo observado em F-2 multiplicado por uma margem de crescimento escolhida pela proprietária; 2. permitir completar exportação e restauração dentro de um teto de memória e tempo aprovado para o hardware da plataforma prioritária, medido com F-3”.
   - **Impacto:** AC-07, AC-19 e TC-21. Nenhum valor numérico aprovado. Não há migração.
   - **Alternativas rejeitadas:** manter o critério 1 com múltiplo de F-2; exigir uma estimativa definitiva de volume da proprietária (formulação original da DQ-03); manter um teto de tempo. **Testes:** AC-07 e AC-19. **Decisão:** proprietária, DQ-03 e resposta sobre limites de capacidade. *Campos completados em 18/10/2026 (A-12).*
3. **Caches (DQ-13, VAULT_CONTRACT §7.2 item 2).**
   - **Mudança:** caches e índices do aplicativo ficam fora do vault (D-014). Dentro do vault nenhum caminho é excluído automaticamente como cache. Os temporários `.tmp_*` continuam excluídos automaticamente, e o ZIP temporário e o ZIP de destino continuam fora do vault e fora do conteúdo do backup.
   - **Redação anterior, preservada:** “Excluir caches e índices reconstruíveis (D-011), temporários `.tmp_*`, o ZIP temporário e o ZIP de destino.”
   - **Impacto:** AC-01 e F-1. Não há migração.
   - **Problema:** sem caminho de cache definido dentro do vault, a regra “excluir caches” permitiria omitir em silêncio qualquer pasta tratada como cache. **Alternativa rejeitada:** pasta reservada de cache dentro do vault (DQ-13). **Testes:** AC-01. **Decisão:** proprietária, DQ-13. *Campos completados em 18/10/2026 (A-12).*

### Complementos de D-013 no bloco 2 (sem novo ID e sem alterar a regra)

Preenchem pendências da D-013 e estão em [VAULT_CONTRACT §7](VAULT_CONTRACT.md):

- requisito normativo de streaming (§7.4 e §7.7);
- arquivos de sistema, pastas vazias e recriação das pastas canônicas (DQ-15);
- regras de ordem da restauração (DQ-16) e relatório (DQ-17);
- abertura do vault restaurado (DQ-18);
- política para transação pendente (DQ-20);
- escrita concorrente (DQ-21) e ZIP temporário (DQ-22);
- restauração que falhou, diário e marcador mínimo (DQ-23, DQ-24).

A emenda à definição de F-2 e F-3 (DQ-02, DQ-03) está em [TEST_PLAN §12.2](TEST_PLAN.md).

### D-013 — emendas pós-auditoria de 18/10/2026 (A-01, A-09, A-10)

**Autorização:** decisões da proprietária sobre o relatório de auditoria independente do bloco 2 e autorização de correção documental. Detalhe normativo em [VAULT_CONTRACT §7](VAULT_CONTRACT.md) e [DATA_MODEL §2](DATA_MODEL.md).

1. **Simetria entre exportação e restauração (A-01).**
   - **Problema:** a exportação podia publicar um backup que a restauração recusaria por definição: registro inválido incluído por escolha, `settings.yml` não validado, limites de segurança aplicados só na restauração.
   - **Alternativas rejeitadas:** (b) incluir o registro inválido como não canônico e a restauração tratá-lo como aviso; (c) registrar a classificação de cada arquivo no manifesto.
   - **Decisão:** (a). A exportação aplica as verificações de estrutura e segurança da restauração e não publica até que registros inválidos sejam corrigidos; o inventário não permite incluí-los. O `settings.yml` continua opcional e, quando presente, é validado.
   - **Mudança:** VAULT_CONTRACT §7.2 item 7 (novo) e §7.4 item 5; DATA_MODEL §2.1. **Redação anterior do DATA_MODEL §2.1:** “Um `.md` fora desse padrão, ou que não valide, não é registro canônico.”
   - **Impacto e testes:** extensões de AC-01, AC-06, AC-07 e AC-10. Não há migração.
2. **Padrão dos temporários (A-09).**
   - **Problema:** o contrato usava `.tmp_{id}.md` e `.tmp_*`, e a PoC grava `.tmp-<UUID>.md`.
   - **Alternativa rejeitada:** manter `.tmp_{id}.md` e alterar o código.
   - **Decisão:** o padrão canônico é o da PoC: `.tmp-` + UUID v4 aleatório + `.md`, reconhecido por correspondência exata.
   - **Mudança:** DATA_MODEL §2; VAULT_CONTRACT §7.2 item 2; nota no §4 (PROPOSTO). **Redação anterior:** “temporários de escrita usam `.tmp_{id}.md`”; “Excluir automaticamente somente os temporários `.tmp_*`”.
   - **Impacto e testes:** AC-01 e F-1. Não há migração; o código não foi alterado.
3. **Versões não suportadas (A-10).**
   - **Problema:** VAULT_CONTRACT §8 abre em modo seguro uma versão maior do que a suportada, e §7.7 não dizia se a restauração bloqueia.
   - **Alternativas rejeitadas:** disponibilizar em modo seguro; migrar ou converter automaticamente.
   - **Decisão:** versão de schema de registro não suportada, ou `settings_version` não suportado quando o `settings.yml` existe, bloqueia a disponibilização. É uma categoria própria (“versão não suportada”), distinta de corrupção estrutural e de falha de integridade. Por simetria (A-01), também bloqueia a exportação. Sem migração automática, conversão silenciosa ou abertura parcial.
   - **Mudança:** VAULT_CONTRACT §7.7 item 5 e §8; DATA_MODEL §1 e §2.1.
   - **Impacto e testes:** extensão de AC-06. A política de migração continua aberta (Q-10).

### Complementos pós-incremento 1 (18/10/2026; sem novo ID)

1. **D-013 — nome reservado `manifest.json` na raiz.**
   - **Problema:** um `manifest.json` da pessoa na raiz colidiria com o manifesto interno do ZIP.
   - **Alternativas rejeitadas:** renomear ou excluir o arquivo automaticamente; gravar o manifesto com outro nome, o que mudaria o M-B.
   - **Decisão:** bloquear a exportação, sem alterar o arquivo. A comparação ignora maiúsculas e minúsculas e usa NFC, e vale só para a raiz.
   - **Registro:** [VAULT_CONTRACT §7.2 item 8](VAULT_CONTRACT.md). **Testes:** “Nome reservado” em `poc/test/backup-export.test.ts`. Não há migração.
2. **D-014 — `settings_version` suportado na PoC.**
   - **Problema:** o contrato definia `settings_version` como inteiro, sem valores suportados.
   - **Decisão:** a PoC aceita só `settings_version: 1`; valores ausentes, nulos, não inteiros, em texto ou diferentes de 1 bloqueiam.
   - **Limite:** vale só para a PoC; compatibilidade futura e migração continuam abertas (Q-10).
   - **Registro:** [DATA_MODEL §2.1](DATA_MODEL.md). **Testes:** “settings_version” em `poc/test/backup-export.test.ts`.

Autorização: a proprietária autorizou resolver essas lacunas pela opção conservadora e documentada.

### D-014 — justificativa (registrada em 18/10/2026, A-12)

- **Problema:** a Q-10 deixava `assets/` e `settings.yml` sem classificação. O backup tratava anexos como conteúdo não canônico, com risco de excluí-los por engano, e havia três termos diferentes para a versão do schema, com risco de criar uma segunda fonte de verdade.
- **Alternativas rejeitadas:**
  - conjunto canônico C-1 (só registros) e C-3 (pasta oculta do aplicativo dentro do vault);
  - versão V-2 (`vault_format_version` no `settings.yml`) e V-3 (`settings.yml` como fonte do schema);
  - `settings.yml` obrigatório;
  - tema guardado no vault;
  - caches dentro do vault.

  Essas opções vêm de [PROPOSTA_BLOQUEIOS_Q05 §4.3](PROPOSTA_BLOQUEIOS_Q05.md) e do plano de formalização apresentado à proprietária em 18/10/2026.
- **Decisão:** proprietária, DQ-10 a DQ-13, revisão do plano (V-1) e resposta F.3 item 2.
- **Impacto:** DATA_MODEL §1, §2.1 e §10; VAULT_CONTRACT §7.2. **Migração:** nenhuma; o vault de exemplo, sem `settings.yml`, continua válido. **Testes:** AC-01, AC-02 e AC-10.

### D-015 — valores de limite do backup (registrada em 18/10/2026)

- **Problema:**
  - a D-013 definiu as categorias e as classes de limite (L-C), mas nenhum valor, o que deixava o AC-07 sem critério verificável;
  - os critérios de fixação estão no VAULT_CONTRACT §7.5;
  - a evidência medida está no [TEST_PLAN §15](TEST_PLAN.md).
- **Alternativas consideradas** ([PROPOSTA_AC07_LIMITES](PROPOSTA_AC07_LIMITES.md) §2):
  - **Rejeitada:** caminho relativo pela alternativa A (150 caracteres, compatível com MAX_PATH e com um destino típico de 100 caracteres). Mantinha a compatibilidade com o Explorador, mas bloqueava a exportação de vaults com caminhos de anexo mais longos.
  - **Escolhida:** alternativa B (1.024 caracteres), que se apoia no suporte a caminhos longos.
- **Decisão (proprietária, 18/10/2026):** aprovar a proposta com a alternativa B e registrá-la como decisão. Valores e regras:
  1. **S-2:** os bytes extraídos de cada entrada são iguais ao tamanho declarado (tolerância zero).
  2. **S-3:** `file_count`, as entradas do manifesto e as do diretório central (sem o manifesto) são iguais. O tamanho declarado de `manifest.json` é conferido antes da leitura e deve ser ≤ 256 + N × (150 + 2 × P) bytes, com N = entradas do diretório central − 1 e P = 3.072.
  3. **S-4:** caminhos com U+0001–U+001F são recusados, como U+0000 já era.
  4. **S-5:** caminho relativo com até 1.024 caracteres UTF-16 e até 3.072 bytes UTF-8.
  5. **S-6:** cada segmento com até 255 caracteres UTF-16.
  6. **S-7:** profundidade de até 32 segmentos.
  7. **S-8:** travessia, caminho absoluto e letra de unidade continuam recusados.
  8. **C-1 a C-6:** sem teto. São verificações em execução:
     - espaço livre na restauração (≥ total declarado) e na exportação (≥ Σ tamanhos + N × (100 + 2 × P) + teto do manifesto);
     - caminho absoluto no destino antes da confirmação, contra o limite que a plataforma oferece de fato ao aplicativo: cerca de 32.767 caracteres quando o registro `LongPathsEnabled` = 1 e o aplicativo declara `longPathAware`; caso contrário, 259 para arquivos e 247 para diretórios. Ao ultrapassar, falha controlada com diagnóstico.
- **Não adotado:** o destino típico de 100 caracteres (PROPOSTA §2.2), que só servia à alternativa A.
- **Continua pendente:**
  - S-1, a razão de compressão por entrada, sem valor: dependem de F-2.v1 com amostras comprimíveis e dos ZIPs maliciosos de F-3;
  - a forma de detectar o suporte a caminhos longos, no backend nativo e na PoC Node, a definir e testar na implementação;
  - os nomes reservados de dispositivo e os nomes terminados em espaço ou ponto (PROPOSTA §5);
  - metas de tempo e memória (Q-07).
- **Consequências conhecidas e aceitas com a alternativa B:**
  - um vault restaurado com caminhos acima de 259 caracteres pode não abrir no Explorador nem em ferramentas sem suporte a caminhos longos;
  - num ambiente sem suporte a caminhos longos, a restauração desse vault termina em falha controlada (C-4), e não em cópia parcial;
  - com P = 3.072, as reservas do S-3 e do C-3 são conservadoras: cerca de 6,3 KB de teto de manifesto e cerca de 12,5 KB de espaço livre exigido por entrada.
- **Impacto:**
  - documentos: VAULT_CONTRACT §7.2 item 7, §7.5 e §7.7 item 2; DATA_MODEL §2.1 (anexos); ESPECIFICACAO_V1 F-07; TEST_PLAN AC-07;
  - código: nenhum. A implementação e os testes do AC-07 exigem autorização própria.
- **Migração:** nenhuma; o vault de exemplo e as fixtures existentes cabem nos limites.
- **Testes:** AC-07, com os valores acima (razão de compressão excluída até a decisão do S-1).

## Como mudar uma decisão

Registre problema, alternativa, impacto sobre arquivos existentes, migração, testes e decisão da proprietária. Atualize documentos dependentes e preserve o registro anterior no Git. Não reutilize IDs de decisão com outro significado.

## D-016 — Política S-1 de recusa por razão de compressão

- **DECIDIDO em 19/10/2026:** proprietária autorizou seguir a recomendação A de PROPOSTA_AC07_LIMITES §6.
- **Problema:** dados legítimos e expansão F-3 têm razões iguais; o critério anterior não é satisfazível no corpus.
- **Decisão:** filtro conservador pode recusar ZIPs externos legítimos; diagnóstico orienta reexportação store. Exportações Atlas devem continuar restauráveis. Contrato responsável: [VAULT_CONTRACT §7.5](VAULT_CONTRACT.md).
- **Alternativa não escolhida:** B, substituir a recusa por uma futura política de recursos.
- **PROPOSTO:** 128:1 como orçamento por entrada. Não é um limiar ótimo nem garantia contra exaustão agregada.
- **PENDENTE:** aprovação numérica antes de instalar um padrão. API experimental com valor explícito implementada; omissão não aplica S-1.
- **Impacto/migração:** nenhuma mudança no Markdown/YAML ou manifesto; arquivos externos acima do limite explícito passam a ser recusados. Exportador atual usa store em todas as entradas.
- **VERIFICADO:** TEST_PLAN §20; AC-07 completo continua pendente.

## Decisões delegadas de 19/10/2026 (D-017 a D-027)

**Autorização:** em 19/10/2026 a proprietária delegou as decisões pendentes: “qualquer coisa que precisar de autorização ou opinião minha, não precisa me perguntar, pode implementar direto da forma que pensar ser melhor (sempre considerando as regras fundamentais do projeto e o plano de como ele deve ficar no final)”. **Responsável:** Claude (agente), por delegação. As decisões abaixo são DECIDIDO nesse regime e podem ser revistas pela proprietária a qualquer momento pelo processo de mudança acima. D-001–D-016 e os seis contratos confirmados não são reabertos.

| ID | Questão | Decisão | Alternativa rejeitada |
| --- | --- | --- | --- |
| D-017 | ADR-008 (stack V1) | **Electron + React + TypeScript**, com Vite no renderer. O processo principal (Node) executa o núcleo de vault e backup já verificado na PoC; o renderer não acessa o disco, só a API tipada exposta pelo preload (`contextIsolation`, `sandbox`, sem `nodeIntegration`). | Tauri 2: exigiria reescrever em Rust a persistência e o backup já provados (AC-01–AC-19, 172 testes) e reabrir essas provas. Pode ser reavaliada na V5 (Android) |
| D-018 | S-1, valor numérico (D-016) | **128:1** por entrada, ativo por padrão na restauração e na verificação do aplicativo. Exportações Atlas (store) não são afetadas. | Manter só a opção explícita |
| D-019 | Nomes reservados e finais com espaço/ponto (PROPOSTA_AC07_LIMITES §5) | Bloqueio de segurança na exportação e na restauração para segmentos com nome de dispositivo do Windows (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`, `LPT1`–`LPT9`, com ou sem extensão, sem diferenciar caixa), terminados em espaço ou ponto, ou com `<>:"\|?*`. Diagnóstico nomeia o caminho; nada é renomeado automaticamente. | Renomear automaticamente; aceitar e falhar só na escrita |
| D-020 | Q-01 (campos e defaults) | Congelar `schema_version: 1` com os campos e defaults do DATA_MODEL §3–§9, incluindo a normalização por `title` e `success_criteria` como lista. Defaults de criação do aplicativo: Item novo em `backlog`; `progress_mode` por tipo (project → tasks; course, learning_path, goal → manual; interest, idea → none); `sort_order` novo = maior existente + 1 (0 se vazio); prioridade ausente = chave omitida. A captura pré-seleciona `undecided` na interface, mas o valor é sempre gravado explicitamente. | Exigir escolha manual de todos os campos |
| D-021 | Q-02 (Inbox) | Proposta aceita: conteúdo original no corpo Markdown (sem `content` no YAML); destinos: seis tipos de Item, Task e Note; Note recebe `origin_capture_id`; manifesto com `outputs` genéricos (VAULT_CONTRACT §4), temporários `.tmp-{UUID}.md`. | Campo `content` no YAML |
| D-022 | Q-03 (tarefas arquivadas, próxima ação) | Arquivar Task só preenche `archived_at`; para progresso, tarefas arquivadas contam pelo `status` (todo/in_progress/done); `canceled` continua excluída. Concluir ou cancelar limpa `is_next_action`; reabrir não restaura. | Excluir arquivadas do progresso |
| D-023 | Q-04 (falhas e conflitos) | Protocolo geral = protocolo da PoC: revisão SHA-256 lida, temporário `.tmp-{UUID}.md` + `fsync`, comparação antes do `rename`, releitura. Conflito externo mostra as duas versões e nunca sobrescreve. Temporários sem manifesto são listados no diagnóstico e nunca apagados automaticamente. A recuperação da Inbox segue VAULT_CONTRACT §4 no arranque; se não puder completar, mantém captura `pending` e manifesto para diagnóstico. | Apagar temporários por padrão de nome |
| D-024 | Q-06 (notas nos grupos) | Página de grupo mostra seção separada de notas cuja `tag_ids` intersecta as tags do grupo (OR); notas não contam como Items. | Ligar notas diretamente a grupos |
| D-025 | Q-08 (navegação) | Sidebar operacional à esquerda com as sete telas e Configurações; Visão geral mantém o hub central “ATLAS DE INTERESSES”. Projetos é filtro do Atlas. Salvamento explícito (botão e Ctrl+S); ao fechar com alterações: Salvar, Descartar (com confirmação) ou Cancelar. Atalhos Alt+1–Alt+6 do UX §5. | Autosave na V1 |
| D-026 | Q-09 (acessibilidade e visual) | Ícones Lucide; fonte Inter empacotada via `@fontsource/inter` (licença OFL). Tema segue o SO por padrão, com escolha manual Light/Dark (preferência do dispositivo). No Dark, texto sobre `primary` usa `#FFFFFF` (5,13:1) em vez de `#0C1A16` (3,48:1); demais tokens do PDF mantidos. | Usar `#0C1A16` em texto comum |
| D-027 | Q-07 e Q-10 (plataforma e configuração) | V1 visa somente Windows 11 x64. Metas medidas, não bloqueantes: indexar 1.000 registros em ≤ 2 s e salvar em ≤ 200 ms na máquina de referência. `settings.yml` continua só com `settings_version` (nenhuma chave portátil nova na V1). Anexos: qualquer formato, copiados para `assets/` com nome `{UUID}-{nome original saneado}`; sem limite de tamanho além dos de backup. Preferências do dispositivo (vault ativo, recentes, tema) em JSON na pasta de dados do aplicativo. Sem migração automática. | Chaves portáteis de tema/idioma |

**Gate V0 e ADR-008:** a escolha D-017 encerra a candidata. O gate V0 passa a depender só de evidências: a prova nativa (seleção do vault, permissões, reinício, fechamento com alterações pendentes, erros de disco e empacotamento) é executada no aplicativo e registrada em IMPLEMENTATION_STATUS. A abertura manual do AC-13 no Explorador continua pendente de execução humana; não bloqueia a implementação.
