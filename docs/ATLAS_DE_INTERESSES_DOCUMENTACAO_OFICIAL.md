# Atlas de Interesses — documentação oficial do produto

**Versão:** 2.0-CONSOLIDADA · **Data:** 18/10/2026

**Responsável:** proprietária do projeto

**Estado:** documentação consolidada e PoC local parcial executada; gate técnico V0 permanece pendente.

## 1. Uso e autoridade

Este documento define propósito, escopo e princípios. A consolidação incorpora a documentação inicial, as versões REC fornecidas pela proprietária e a aceitação das recomendações da comparação. Veja [registro de reconciliação](RECOVERY_LOG.md).

| Classificação | Significado |
| --- | --- |
| DECIDIDO | Regra de produto aprovada; não alterar silenciosamente |
| PROPOSTO | Solução concreta recomendada, ainda sujeita a decisão/PoC |
| PENDENTE | Pergunta que falta resolver ou comprovar |
| RELATADO | Afirmação de fonte anterior sem prova atual |
| VERIFICADO | Verificação delimitada com evidência e ambiente registrados |

A qualidade desta documentação não comprova funcionamento de software. A confirmação recebida durante a recuperação de 18/10/2026 era de que não havia PoC/testes anteriores a recuperar, invalidando relatos antigos de aprovação. Desde 17/10/2026 existe uma PoC local parcial, com evidências delimitadas em [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md); isso não é aplicativo V1 nem conclusão do gate técnico V0.

## 2. Visão e missão — DECIDIDO

O Atlas de Interesses é um sistema pessoal de organização de interesses, projetos, tarefas e conhecimento. Conecta um atlas navegável de assuntos a uma central de execução e uma base de conhecimento local.

Sua missão é transformar curiosidade em conhecimento organizado e conhecimento em trabalho concreto, preservando relações sem exigir classificação completa no momento da captura.

### Resultados esperados

- Capturar uma frase, ideia ou link rapidamente.
- Explorar áreas temáticas e recuperar itens ainda sem classificação.
- Organizar projetos, cursos, interesses, ideias, trilhas e metas.
- Executar ações com prazos, próximas ações e progresso compreensível.
- Registrar descobertas, decisões e leituras no contexto de itens.
- Elaborar notas permanentes reutilizáveis e manter ligação com suas origens.
- Ler arquivos fora do aplicativo, reconstruir índices e restaurar backups íntegros.

### Limites

A V1 não inclui IA integrada, mapa com zoom, grafo global, busca global avançada ou sincronização. O produto não exige canvas para operar e não duplica itens para exibi-los em grupos diferentes.

### Cenário de referência

A pessoa captura um artigo sobre UX Design. Processa a captura em nota de leitura, marca a tag UX Design e pode associá-la a um item. Um projeto com essa tag aparece nos grupos Design e Tecnologia que a compartilham. Tarefas registram a execução do projeto. Quando uma descoberta amadurece, a pessoa cria uma nova nota permanente ligada à nota de origem. O conhecimento passa a ser reutilizável em outros projetos sem duplicar a nota permanente.

A participação de **itens** em grupos é definida pela regra OR. A exibição direta de **notas** nos grupos continua proposta: não assumir que Note e Item são a mesma entidade (Q-06).

## 3. Princípios inegociáveis — DECIDIDO

1. **Markdown como fonte de verdade:** um registro canônico em arquivo com YAML e corpo Markdown; índices e caches reconstruíveis.
2. **Identidade estável:** UUID v4 gerado na criação, preservado ao editar, renomear e restaurar.
3. **Grupos derivados por tags:** uma tag em comum é suficiente; não persistir relações espelhadas grupo↔item.
4. **Tags classificam, links conectam:** relações de conhecimento explícitas estão no corpo Markdown.
5. **Um registro, múltiplas visualizações:** listas e filtros consultam os mesmos arquivos.
6. **Dados antes da visualização:** listas e detalhes funcionam antes de mapas e grafos.
7. **Arquivamento antes de exclusão:** preservar referências e permitir recuperar registros arquivados.
8. **Hub conceitual central:** “ATLAS DE INTERESSES” fica no centro do mapa de navegação. Sidebar operacional interna pode ser avaliada em protótipo; não é decisão visual fechada.
9. **Local-first V1:** acesso nativo a arquivos locais e uso offline; sincronização é V5.
10. **Integridade do corpo:** edição exclusiva de metadados mantém os bytes do corpo, incluindo quebras, acentos e espaços.
11. **Decisão humana:** IA auxilia pesquisa, escrita e implementação; a proprietária decide escopo e mudanças de regras.

## 4. Vocabulário — DECIDIDO

| Entidade | Finalidade | Relações principais |
| --- | --- | --- |
| Group | Área temática que consulta itens | `tag_ids` |
| Tag | Classificador reutilizável | UUID referenciado por grupos, itens e notas |
| Item | Projeto, curso, interesse, ideia, trilha ou meta | Tags; contexto de notas |
| Task | Ação avulsa ou de um projeto | `project_id`, no máximo um projeto |
| Note | Conhecimento de trabalho, leitura ou permanente | Contexto opcional conforme tipo; links no corpo |
| InboxCapture | Conteúdo capturado para processar depois | Referência ao resultado principal da conversão |

**Vault:** pasta canônica de dados. **Backlink:** inverso de um link persistido no corpo. **Próxima ação:** tarefa aberta marcada para destaque. **Fonte:** material consultado; catálogo próprio previsto para V2, se necessário.

## 5. Regras centrais

### 5.1 Notas e contexto — D-001

- `work` exige `context_item_id` válido.
- `reading` aceita um item ou `null`.
- `permanent` exige `context_item_id: null`.

Criar uma permanente a partir de uma contextual gera **novo UUID e novo arquivo**. A origem permanece íntegra; a nova nota inclui link Markdown para ela. O backlink é reconstruível desse link, inclusive após reiniciar. Esta decisão substitui a promoção por mudança do tipo no mesmo registro descrita nas versões REC.

### 5.2 Captura e processamento — D-002

A captura exige apenas conteúdo. Processá-la pode criar um dos seis tipos de Item, Task ou Note. A captura original é preservada. `converted_to_type` e `converted_to_id` apontam para o resultado principal; registros derivados recebem `origin_capture_id`.

Só marcar `processed` após confirmar os arquivos finais. A implementação deverá usar transação recuperável e reconciliação idempotente. As etapas e limites técnicos estão em [VAULT_CONTRACT.md](VAULT_CONTRACT.md).

### 5.3 Progresso — D-003

Para tarefas do projeto: `eligible = count(todo, in_progress, done)` e `done = count(done)`. Se `eligible > 0`, progresso é `100 * done / eligible`; caso contrário, `null`, exibido como “Sem tarefas”. `canceled` não participa.

O modo manual usa inteiro de 0 a 100; o modo `none` oculta o percentual. Chegar a 100% não conclui o projeto silenciosamente. O tratamento de tarefas arquivadas está proposto em Q-03.

### 5.4 Grupos e tags — D-004

`pertence(grupo, item) = existe tag em grupo.tag_ids também presente em item.tag_ids`.

Grupo vazio é permitido; item sem tags permanece na lista geral. Renomear Tag altera seu arquivo e a projeção visual por UUID, sem reescrever referências em grupos/itens.

### 5.5 Identidade, links e persistência — D-005 e D-006

UUID é a chave relacional. Títulos são rótulos. Links canônicos entre notas usam caminhos relativos em sintaxe Markdown. Os nomes dos arquivos usam UUID, evitando alteração de caminho ao renomear um título.

A preservação byte a byte vale para operações somente de metadados. Editar texto ou atualizar um link por movimentação é alteração explícita do corpo, deve ser rastreável e não pode ser apresentada como round-trip sem mudança.

## 6. Arquivos e backup — D-007

[DATA_MODEL.md](DATA_MODEL.md) descreve as pastas canônicas recebidas na REC e uma proposta reconciliada dos campos. [VAULT_CONTRACT.md](VAULT_CONTRACT.md) descreve escrita, índices, falhas e backup.

Backup manual ZIP inclui registros e anexos do vault e um `manifest.json` com versão, data, contagem e hashes SHA-256. O manifesto não inclui hash de si mesmo. Restauração ocorre em pasta nova e só é disponibilizada após verificar todos os arquivos. Estado transacional pendente precisa ser resolvido antes de gerar um backup consistente.

## 7. Experiência da V1

Sete telas principais: Visão geral, Atlas, Detalhe do item, Inbox, Tarefas, Notas e Organização. Acesso a Projetos é uma vista filtrada de itens; Configurações/Backup é uma área utilitária proposta, acessível por ação global. Esse mapa é uma proposta coerente para prototipar, não evidência de UI pronta.

O [Design System](DESIGN_SYSTEM.md) vem do PDF entregue, com Inter, temas Light/Dark, raios 6/12/24 e espaçamentos 8/16/24/40. A aplicação deve apresentar estados vazio, carregando, salvo, erro e conflito; teclado e texto complementam cor.

## 8. Roadmap oficial — DECIDIDO

| Versão | Entrega | Gate |
| --- | --- | --- |
| V0 | Contexto, UX, prova técnica, arquitetura e governança | Armazenamento, relações e restauração comprovados |
| V1 | Núcleo local: CRUD, notas/links, tarefas, Inbox e backup | Fluxos reais persistidos, testes e aceite |
| V2 | Pesquisa global e catálogo de fontes | Busca de corpo e índice reconstruível |
| V3 | Mapa visual com zoom/pan | Dados íntegros e alternativa em listas |
| V4 | Grafo de conhecimento | Relações explicáveis e navegação controlada |
| V5 | Sync e Android | Conflitos recuperáveis, offline definido e segurança validada |

V5 encerra o roadmap inicial, não impede evolução posterior. Veja [roadmap operacional](IMPLEMENTATION_ROADMAP.md) e [checklist](WORKFLOW_CHECKLIST_V0_V5.md).

## 9. Arquitetura candidata e governança

Tauri 2 + React + TypeScript continua candidata para o aplicativo e provas nativas. A PoC local Node não fecha a escolha. Validar acesso nativo ao vault, permissões, reinicialização, fechamento com alterações, tamanho e RAM antes de fechar a decisão.

ChatGPT coordena produto; ferramentas de pesquisa sintetizam fontes; Cursor implementa tarefas autorizadas; revisão independente verifica mudanças. Use uma implementação por tarefa e atualize [status](IMPLEMENTATION_STATUS.md) com evidência real. Documentação não concede aprovação de gates.

## 10. Critério de sucesso da V1

A pessoa consegue capturar, organizar, executar, produzir conhecimento permanente e restaurar seus dados sem perda, duplicação indevida ou dependência da interface. Os requisitos detalhados e critérios observáveis estão em [ESPECIFICACAO_V1.md](ESPECIFICACAO_V1.md); os testes planejados estão em [TEST_PLAN.md](TEST_PLAN.md).
