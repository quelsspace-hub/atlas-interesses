# Guia de trabalho no Cursor

**Versão:** 2.0-CONSOLIDADA · 18/10/2026

## 1. Ponto de partida

Abra a raiz do repositório, não apenas `docs/`. A raiz contém README e AGENTS; toda documentação ativa está em `docs/`. Arquivos recebidos foram preservados no ZIP histórico e não são uma segunda especificação vigente.

**Atualização de 19/10/2026:** o aplicativo V1 está em `app/` (Electron + React + TypeScript, D-017), com comandos em [app/README](../app/README.md) e evidências em [IMPLEMENTATION_STATUS §35](IMPLEMENTATION_STATUS.md). A PoC em `poc/` permanece como evidência histórica. *Redação anterior:* “Existe uma PoC parcial em `poc/` [...] Não existe aplicativo V1 ou integração nativa. [...] Não tente importar `poc/vault_core.js`, que permanece inexistente, nem instalar Tauri sem autorização.”

## 2. Ordem de leitura

1. [AGENTS da raiz](../AGENTS.md).
2. [IMPLEMENTATION_STATUS](IMPLEMENTATION_STATUS.md).
3. [Documentação oficial](ATLAS_DE_INTERESSES_DOCUMENTACAO_OFICIAL.md).
4. [DECISIONS](DECISIONS.md) e [OPEN_QUESTIONS](OPEN_QUESTIONS.md).
5. [DATA_MODEL](DATA_MODEL.md) e [VAULT_CONTRACT](VAULT_CONTRACT.md).
6. [Especificação funcional](ESPECIFICACAO_V1.md), [UX](UX_SPECIFICATION.md), [Design System](DESIGN_SYSTEM.md).
7. [Roadmap](IMPLEMENTATION_ROADMAP.md), [testes](TEST_PLAN.md) e [rastreabilidade](REQUIREMENTS_TRACEABILITY.md).

## 3. O que cada artefato significa

| Artefato | Pode fundamentar |
| --- | --- |
| Decisão da proprietária | Regra de produto |
| Documento PROPOSTO | Implementação candidata a revisar |
| Exemplo YAML | Ilustração do contrato, sem persistência demonstrada |
| Teste planejado | Critério e roteiro futuros |
| Teste executado com log/ambiente/revisão | Evidência delimitada de comportamento |
| Aprovação de gate | Avanço para a etapa seguinte |

## 4. Prompt de início recomendado

> Leia AGENTS.md, docs/IMPLEMENTATION_STATUS.md, poc/README.md, docs/TEST_PLAN.md e docs/OPEN_QUESTIONS.md. A PoC parcial existente prova apenas os casos registrados; aplicativo V1, testes V1 completos e integração nativa não existem. Confira a evidência e proponha uma próxima tarefa técnica estritamente delimitada, apontando decisões de produto dependentes, arquivos, verificações e limites. Não reabra os seis contratos confirmados nem trate uma PoC como aprovação da stack ou gate V0. Aguarde autorização específica antes de implementar.

## 5. Quando houver autorização de implementação

- Limite a mudança à etapa escolhida e confirme contratos relevantes.
- Verifique versões atuais nas fontes oficiais da tecnologia selecionada.
- Introduza comandos documentados e um exemplo fictício reproduzível.
- Implemente e execute primeiro provas de arquivo; valide permissões e ciclo nativo separadamente.
- Falhar deve manter dados recuperáveis e impedir estado falso de sucesso.
- Execute os cenários da matriz relacionados ao diff e informe cobertura ausente.
- Atualize status, decisões técnicas e rastreabilidade.

## 6. Checklist de entrega de uma tarefa

- Objetivo, versão e requisitos identificados.
- Arquivos efetivamente alterados descritos.
- Resultados executados separados dos planejados.
- Limitações e próximos passos registrados.
- Nenhum contrato alterado silenciosamente.
- Nenhum dado pessoal incluído.
- Gate e aceite da proprietária registrados quando aplicáveis.

## 7. Registro contínuo

[IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) registra etapa, implementado, validado, pendências e próxima ação. Deve ser breve e factual. [CHANGELOG.md](CHANGELOG.md) mantém mudanças relevantes. [TEST_PLAN.md](TEST_PLAN.md) define cenários, não declara resultados automáticos. Ao iniciar uma sessão, compare os documentos com os arquivos reais.
