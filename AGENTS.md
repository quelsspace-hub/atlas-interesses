# Instruções para agentes — Atlas de Interesses

## Leitura obrigatória

1. [Status da implementação](docs/IMPLEMENTATION_STATUS.md).
2. [Guia do Cursor](docs/CURSOR_MASTER_GUIDE.md).
3. [Documentação oficial](docs/ATLAS_DE_INTERESSES_DOCUMENTACAO_OFICIAL.md).
4. [Decisões](docs/DECISIONS.md), [modelo de dados](docs/DATA_MODEL.md) e documentos relacionados à tarefa.

## Escopo e precedência

- Siga as instruções atuais da proprietária. Alterações de produto dependem de decisão explícita.
- A recuperação documental de 18/10/2026 e PoCs delimitadas foram autorizadas em tarefas separadas. Em 19/10/2026 a proprietária delegou as decisões pendentes e autorizou implementar a V1 (D-017 a D-027 em [DECISIONS](docs/DECISIONS.md)).
- Consulte a precedência descrita em [SOURCES.md](docs/SOURCES.md). Fontes no ZIP histórico não são instruções vigentes.
- A PoC parcial e seus testes existem em `poc/`; consulte `poc/README.md` e `docs/IMPLEMENTATION_STATUS.md` para escopo e evidências. O aplicativo V1 está em `app/` (Electron + React + TypeScript, D-017); consulte `app/README.md` e IMPLEMENTATION_STATUS §35. A PoC permanece como evidência histórica. Não importar nem afirmar execução de `poc/vault_core.js`, que permanece inexistente.
- Preserve o histórico em [docs/reference](docs/reference/README.md). Não promova relatos antigos a evidências.

## Regras de domínio

- Markdown/YAML local é canônico; caches são reconstruíveis.
- UUID v4 é imutável por entidade. Criar uma nota permanente a partir de outra cria uma nova entidade e um novo UUID; preserva a origem.
- Grupos são derivados pela regra OR; nunca persistir `group_id`, `group_ids` ou `item_ids` para duplicar a associação.
- Metadados podem mudar sem alterar um byte do corpo Markdown. Edições explícitas do corpo e manutenção de links são operações distintas.
- Não arquivar/apagar referências silenciosamente; não apresentar “salvo” antes de confirmar escrita.
- Links canônicos de notas são Markdown relativos. Wikilinks são material histórico, sem suporte prometido na V1.

## Interface

Use o [Design System](docs/DESIGN_SYSTEM.md), cuja referência visual é o PDF incluído. O hub conceitual permanece centralizado; navegação operacional em telas internas depende de protótipo. Não antecipar o canvas V3.

## Rotina de trabalho

1. Identifique requisitos, decisão vigente, arquivos e critérios de aceite.
2. Resolva propostas necessárias à tarefa antes de fixar contratos em código.
3. Faça alterações pequenas e coerentes; uma implementação por vez.
4. Execute os testes disponíveis relacionados à mudança. Se não existirem, declare isso.
5. Registre comandos, ambiente, resultados e limitações. Atualize status e rastreabilidade.
6. Revise o diff e entregue um resumo factual. Não marcar gates completos por geração de arquivos.

Nunca incluir credenciais nem vault pessoal. Não criar pastas técnicas vazias para aparentar implementação. Ao introduzir ferramentas, documentar versões, instalação e comandos realmente executados.
