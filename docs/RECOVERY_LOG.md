# Registro de recuperação e reconciliação

**Data:** 18/10/2026. A proprietária forneceu DATA_MODEL v2.0-REC e baseline v1.0-REC no chat, PDF e seis arquivos de Doc. Inicial; confirmou ausência de PoC/testes; solicitou comparação caso a caso e aceitou as recomendações apresentadas. A tarefa seguinte autorizou reescrever e aprofundar a documentação.

## 1. O que foi recuperado

| Problema inicial | Tratamento |
| --- | --- |
| Campos/caminhos apagados e saída de shell no modelo | Reconstrução a partir de REC e originais, com proposta técnica explícita |
| Referências vazias em AGENTS e índice | Caminhos existentes e ordem de leitura completa |
| Texto raso e declarações de conclusão sem evidência | Especificações detalhadas e estado real de V0 |
| Pasta reference anunciada mas ausente | Arquivo histórico criado com fontes e hashes |
| Mesma regra divergente em vários documentos | Responsável documental e precedência definidos |
| Paleta do guia divergente do PDF | Extração das amostras vetoriais e conferência visual |
| Relação de origem dependente só de memória | Nova nota com link persistido para origem |

## 2. Escolhas de reconciliação aceitas

- Nova permanente preserva contextual e possui UUID próprio. Substitui conversão in-place da REC.
- Links Markdown relativos são canônicos. Substitui promessa de wikilinks e resolução por título como mecanismo principal.
- Hub conceitual central; layout interno poderá ser validado em protótipo.
- Modelo REC é base para revisar campos omitidos; a revisão de contrato está em DATA_MODEL como PROPOSTA, sem fingir aprovação dos detalhes ainda abertos.
- **Registro superado pela auditoria corretiva (§7):** a consolidação preservou distinção entre planejamento e execução, mas tratou indevidamente o enum já aprovado de Item.status como pendente em Q-01.
- Consolidar mapa de navegação com acesso claro a Projetos/Configurações; composição final permanece Q-08.

## 3. Complementos propostos para eliminar lacunas

| Tema | Diferença | Solução proposta |
| --- | --- | --- |
| Nomes de Group/Tag | name/slug vs title | Usar title; UUID no caminho, sem slug redundante |
| Item | REC omite summary/start_date/provider/objective | Recuperar opcionais para apoiar fluxos iniciais |
| Critérios de sucesso | String REC vs lista original | Lista de strings para critérios observáveis |
| URL de Item | url vs external_url | Nome external_url da REC |
| Status de Item | Planejamento no original, cancelamento na REC | Proposta histórica de sete estados SUPERADA; vigem os seis estados originais (§7) |
| Task | Prioridade/ordem presentes no original | Proposta histórica de ambas opcionais PARCIALMENTE SUPERADA: prioridade opcional; sort_order obrigatório (§7); detalhes no corpo |
| Note | Origem da captura e metadados de fonte omitidos na REC | Restaurar origin_capture_id/source_title/source_year opcionais |
| Inbox | content no YAML vs corpo | Corpo como conteúdo original, sem cópia concorrente |
| Destinos da Inbox | REC limita a project/task/note | Aceitar os seis tipos de Item, Task e Note |
| Manifesto | Estrutura fixa project/tasks | outputs genérico, revisão técnica pendente |
| Configuração/anexos | settings.yml/assets ausentes na REC | Complementos propostos, sem formato inventado como definitivo |

## 4. Correção do histórico de validação

Na ocasião da recuperação documental, a proprietária confirmou que não havia PoC/testes anteriores a recuperar; isso invalidou relatos antigos de aprovação como evidência. Não se preservou “11 aprovados + 2 parciais” como fato. O histórico foi guardado no ZIP. Desde 17/10/2026 existe PoC parcial, com execução e limites registrados em IMPLEMENTATION_STATUS; ela não valida o produto nem os antigos relatos.

Os testes planejados agora têm novos IDs definidos nesta consolidação. ADRs ausentes receberam propostas novas; nenhum texto foi atribuído a uma decisão histórica inexistente.

## 5. Preservação

As 21 versões iniciais do checkout e os sete anexos foram arquivados antes da reescrita, com manifest de tamanho/hash. A pasta `_originais` antiga foi retirada da documentação ativa e seu conteúdo está no arquivo histórico. A documentação recebida em mensagens é resumida neste registro; não se declara uma transcrição literal dessas mensagens no ZIP.

## 6. Limites

Esta recuperação não implementa PoC, testes de produto, stack ou interface. Exemplos são sintéticos. Propostas concretas permitem revisão e prova técnica; o status e as questões em aberto impedem confundi-las com implementação ou aprovação final.

## 7. Auditoria corretiva autorizada dos seis contratos

A revisão identificou divergências introduzidas pela consolidação; a proprietária reafirmou os contratos originais e autorizou a correção documental. Fonte exata e linhas estão em [SOURCES.md](SOURCES.md); o original e o ZIP não foram editados.

- Item.status: `backlog`, `planned`, `active`, `paused`, `completed`, `archived`; retirada a inclusão proposta de `canceled`, que pertence a Task.status.
- Item.priority e Task.priority: opcionais, com `low`, `medium`, `high`; retirada a ampliação proposta com `urgent`.
- Task.sort_order e Group.sort_order: inteiros obrigatórios; superada a classificação como opcionais com default `0`.
- InboxCapture.capture_kind: obrigatório, com `thought`, `link`, `task`, `project`, `course`, `note`, `undecided`; superada a classificação como opcional com default `undecided`.

P-02 está superada. P-05 e Q-01/Q-03 mantêm apenas os pontos ainda não decididos; os seis contratos não são reabertos. Não se estabelecem novos defaults, nulidade ou comportamentos. Os 12 exemplos já contêm valores compatíveis e permanecem intactos. Esta correção é documental; nenhum cenário TC de software foi executado.
