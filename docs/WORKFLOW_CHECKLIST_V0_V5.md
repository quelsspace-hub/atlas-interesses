# Checklist operacional V0–V5

**Atualização documental:** 18/10/2026 · **Execução:** 17/10/2026 no ambiente. Caixa marcada indica apenas a ação descrita, não aprovação de uma versão inteira. PoC parcial e testes correspondentes existem; aplicativo V1, suíte V1 completa e integração nativa ainda não existem.

## V0.1 — Contexto e documentação

- [x] Receber fontes originais, REC e PDF.
- [x] Confirmar com a proprietária que PoC e testes não foram criados.
- [x] Reconciliar promoção, links e regra de hub conforme recomendações aceitas.
- [x] Organizar documentação, fontes e exemplos fictícios.
- [ ] Fechar propostas do contrato de dados e falhas (Q-01 a Q-05).
- [ ] Obter aceite da baseline consolidada completa.

## V0.2 — Experiência

- [ ] Prototipar sete telas e área utilitária de configurações.
- [ ] Avaliar acesso a Projetos e navegação interna.
- [ ] Demonstrar captura, tarefas, notas e backup, com estados vazios/erros.
- [ ] Validar teclado, foco, contraste e janela estreita.
- [ ] Registrar aceite dos fluxos com a proprietária.

## V0.3 — Pesquisa técnica

- [ ] Conferir documentação atual das tecnologias candidatas.
- [ ] Comparar alternativas de acesso local e permissões.
- [ ] Definir SO inicial, fixture e metas de medição.
- [ ] Registrar decisões com fonte e consequência.

## V0.4 — PoC

- [x] Criar PoC local delimitada, dependências e comandos reproduzíveis após autorização específica.
- [ ] Testar leitura/escrita, UUID, OR, progresso e contexto de notas.
- [x] Provar rename isolado de Tag e reconstrução do índice derivado por UUID em fixture (subcaso TC-04; GUI não provada).
- [ ] Fechar política geral para registros inválidos/referências ausentes; testar arquivamento conforme Q-03.
- [ ] Testar links, backlinks e criação de permanente preservando origem.
- [x] Provar links/backlinks Markdown reconstruídos em fixture (subcasos TC-07/08; GUI e restart não provados).
- [x] Provar regra pura D-001 e criação de nova permanente com origem preservada e backlink reconstruído em fixture (subcasos TC-09/TC-22; GUI e restart não provados).
- [ ] Comprovar D-006 com bytes e hashes.
- [ ] Interromper conversões e recuperar sem duplicação.
- [ ] Gerar backup e restaurar em pasta limpa.
- [ ] Testar erros de acesso e conflitos externos.
- [ ] Provar fechamento/reabertura e permissões nativas.
- [ ] Registrar resultados e decidir stack.

## V0.5 — Repositório e rotina

- [x] Disponibilizar README, instruções para agentes e índice documental.
- [x] Incluir exemplos fictícios de registros e relações.
- [ ] Confirmar visibilidade privada do GitHub, conforme preferência da documentação inicial.
- [x] Disponibilizar suíte, dependências e comandos reproduzíveis da PoC parcial.
- [ ] Executar a PoC a partir de clone limpo.
- [ ] Criar marco versionado aceito pela proprietária.

## V0.6 — Gate

- [ ] Prova técnica executada e evidências acessíveis.
- [ ] Modelo/arquitetura e protótipos aprovados.
- [ ] Riscos críticos de integridade resolvidos.
- [ ] Autorização explícita para iniciar V1.

## V1 — Núcleo local

- [ ] CRUD/arquivamento de grupos, tags e itens.
- [ ] Relações por UUID, OR e lista Sem grupo.
- [ ] Tarefas avulsas/de projeto e progresso correto.
- [ ] Editor, notas/contexto, links/backlinks e nova permanente.
- [ ] Inbox com origem preservada e recuperação idempotente.
- [ ] Visão geral, navegação, configurações e Design System.
- [ ] Backup/restauração e diagnóstico de erro.
- [ ] Testes de arquivo, domínio, nativos e jornadas executados.
- [ ] Aceite humano e liberação documentados.

## V2 — Pesquisa e fontes

- [ ] Definir buscas reais e necessidade de entidade Source.
- [ ] Buscar título/corpo, filtrar e reconstruir índice.
- [ ] Validar vínculos de fontes, Unicode e desempenho.
- [ ] Executar regressão V1 e aceitar versão.

## V3 — Mapa

- [ ] Prototipar nós, zoom/pan e limites.
- [ ] Projetar dados existentes sem duplicação.
- [ ] Permitir abrir/voltar ao detalhe e alternativa por lista.
- [ ] Testar usabilidade, acessibilidade e regressão.

## V4 — Grafo

- [ ] Distinguir links explícitos de relações derivadas.
- [ ] Definir filtros, limites e navegação.
- [ ] Testar ciclos, isolados, arquivados e conjuntos grandes.
- [ ] Provar origem de cada conexão e aceitar versão.

## V5 — Sync e Android

- [ ] Decidir identidade, transporte, proteção e política de conflito.
- [ ] Definir offline, concorrência e recuperação.
- [ ] Implementar sync observável e backup automático.
- [ ] Validar fluxos Android e migração de dispositivo.
- [ ] Testar falhas de rede, conflito e restauração.
- [ ] Executar regressão V1–V4 e aceite.

## Rotina por tarefa

Definir → localizar requisitos → planejar → implementar no escopo autorizado → verificar → revisar → registrar → obter aceite quando necessário. Atualizar [status](IMPLEMENTATION_STATUS.md), [decisões](DECISIONS.md) e [rastreabilidade](REQUIREMENTS_TRACEABILITY.md). Nunca marcar teste planejado como executado.
