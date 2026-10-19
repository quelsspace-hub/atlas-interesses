# Roadmap de implementação

**Estado:** prova técnica V0 em andamento. PoCs locais delimitadas foram executadas em 17–18/10/2026 (persistência, D-003/D-004, Tag, links/backlinks, D-001 e nova permanente; ver §2.1 e [status](IMPLEMENTATION_STATUS.md)); isso não conclui V0. O restante do roadmap descreve etapas propostas, não código existente.

## 1. Fechar decisões por etapa

Antes de cada etapa, fechar as decisões de produto que alterem o contrato ou comportamento usado por essa etapa. Os seis contratos confirmados em DECISIONS não são reabertos. Q-01 deve ser fechada para congelar o schema e cada campo correspondente antes de sua fatia V1; Q-02 permanece pendente, inclusive quanto aos tipos de destino da Inbox, e deve ser decidida antes da conversão; Q-03 deve ser fechada antes dos critérios finais de tarefas/progresso. Nenhuma dessas decisões é necessária para a PoC mínima de um registro, que usa envelope experimental reduzido.

Q-04 (falhas/conflitos) e Q-05 (backup/restauração) contêm mecanismos técnicos que podem ser investigados por PoCs autorizadas. Experimentos não aprovam mudanças de produto nem encerram a questão sem decisão/aceite. A primeira PoC não depende da Inbox, backup completo ou UI. Registrar separadamente escolha de produto, resultado técnico e aceite.

**Saída por etapa:** decisões e critérios somente para o contrato que será exercitado; não congelar o schema inteiro por antecipação.

## 2. V0.4 — Prova técnica em duas camadas

### 2.1 Persistência e domínio

**Primeiro recorte executado:** leitura/validação e edição de metadados de um registro sintético em diretório temporário, com corpo preservado, UUID estável, colisão, conflito e falhas. Não congela schema V1. Detalhes, comandos e cobertura parcial estão em `poc/README.md` e `TEST_PLAN.md`.

**Etapa delimitada executada:** funções puras de OR e cálculo de progresso com recortes sintéticos, sem associação persistida nem seleção de tarefas arquivadas. A evidência parcial de TC-04/TC-05 está no TEST_PLAN e no status. Isso não conclui esses cenários completos.

**Etapa delimitada executada:** renomeação de Tag via persistência existente e reconstrução de índice efêmero Tag/Group/Item a partir do disco. A fixture demonstra um único Item em dois grupos; nenhuma GUI é coberta. TC-04 permanece parcial.

**Etapa delimitada executada:** extração de links Markdown relativos e reconstrução de backlinks em fixture, com markdown-it; TC-07/08 parciais.

**Etapa delimitada executada (18/10/2026):** regra pura D-001 e criação de nova permanente D-008 em fixture, com origem preservada byte a byte e backlink reconstruído do disco; TC-09/TC-22 parciais, sem GUI ou restart de aplicativo. **Etapas futuras, não autorizadas por esta prova:** Inbox recuperável (Q-02/Q-04), backup/restauração e provas nativas. Backup: contrato parcialmente formalizado em 18/10/2026 (D-013, VAULT_CONTRACT §7) e critérios AC-01–AC-14 planejados. A PoC depende de autorização, da instalação da biblioteca ZIP recomendada e dos valores de limites da Q-07 para AC-07; o restante pode ser exercitado antes. **Atualização de 18/10/2026 (bloco 2):** com o dimensionamento progressivo (DQ-03), AC-07 depende só dos valores de segurança, calibrados após F-2.v1 e F-3; a capacidade é verificada em execução. Critérios AC-01 a AC-19 planejados, incluindo AC-19 (streaming); nenhum executado. Cada prova precisa de autorização e contratos de produto prévios para os comportamentos que exercitar.

**Saída:** código mínimo, testes executáveis, fixtures e instruções. Exemplos documentais atuais podem orientar fixtures; não constituem a suíte.

### 2.2 Integração nativa

Provar seleção do vault, permissões, reinício, fechamento com conteúdo pendente, erros de disco e empacotamento. Registrar SO, versões e tamanho/RAM. Uma suíte Node/disco não substitui prova GUI nativa.

**Gate:** requisitos críticos demonstrados, decisão ADR-008 fechada e limitações aceitas pela proprietária.

## 3. V0.5–V0.6 — Preparar implementação

Conferir clone limpo, comandos documentados, protótipos e requisitos rastreáveis. Criar marco recuperável. Fechar V0 somente com evidência, incluindo restauração de backup. Repositório/documentação existentes não encerram V0 sozinhos.

## 4. V1 — Sequência proposta

| Passo | Entrega | Dependência | Verificação principal |
| --- | --- | --- | --- |
| 1 | Estrutura da stack aprovada e contratos de vault | Gate V0 e autorização | Ambiente reproduzível |
| 2 | Adapter de arquivos, validação e índice | Passo 1 | Round-trip, conflito, restart |
| 3 | Tags, grupos e regra OR | Passo 2 | UUID/OR/renomeação |
| 4 | Itens, listas e detalhe | Passo 3 | Persistência e Sem grupo |
| 5 | Projetos, tarefas e progresso | Passo 4 | Nullability, estados e prazos |
| 6 | Notas, links e nova permanente | Passo 2 e 4 | Corpo, origem e backlinks |
| 7 | Inbox e reconciliação | Passos 4–6 | Injeção de falhas e idempotência |
| 8 | Hub, telas, configurações e acessibilidade | Contratos e protótipos | Jornadas e estados de erro |
| 9 | Backup/restauração integrados | Vault estável | Hashes, arquivo inválido e pasta limpa |
| 10 | Aceite nativo e regressão | Todos | Persistência após reabrir e aceite humano |

Não adiar provas críticas de backup para o passo 9: sua viabilidade pertence à PoC. O passo 9 integra a experiência de produto.

## 5. V2–V5

- **V2:** busca global no corpo e metadados; filtros combináveis; catálogo de fontes se necessário. Índice descartável. **Implementada em 19/10/2026 (D-028; IMPLEMENTATION_STATUS §36).**
- **V3:** mapa visual sobre entidades existentes; zoom/pan, filtros, retorno ao contexto e alternativa em listas. **Implementada em 19/10/2026 (D-029; IMPLEMENTATION_STATUS §37).**
- **V4:** grafo de links e relações derivadas claramente distinguidos; limites para conjuntos grandes. **Implementada em 19/10/2026 (D-030; IMPLEMENTATION_STATUS §38).**
- **V5:** arquitetura explícita de sync, offline, autenticação, conflitos, backup automático e Android. **Arquitetura decidida e parte Windows implementada em 19/10/2026 (D-031; [PROPOSTA_V5_ARQUITETURA](PROPOSTA_V5_ARQUITETURA.md); IMPLEMENTATION_STATUS §39). Android pendente.**

Cada versão tem tarefa, critérios, testes e aceite próprios. Não antecipar recursos futuros por disponibilidade de biblioteca.

## 6. Evidência de conclusão

Para cada passo registrar objetivo, arquivos, revisão, comandos, dados fictícios, resultados, riscos e próxima ação em [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md). Uma tarefa parcialmente validada permanece parcial.
