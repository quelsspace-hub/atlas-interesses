# Arquitetura de arquivos do projeto

**Data documental:** 18/10/2026. Avaliação da organização e proposta de evolução; nenhum módulo do aplicativo V1 está implementado. PoC parcial de linha de comando existe em `poc/`.

## 1. Diagnóstico inicial

O checkout inicial tinha 21 arquivos Markdown. Todos eram UTF-8 legíveis, mas havia perda de conteúdo, referências vazias, saída de shell no modelo original e caminhos para pastas inexistentes. Fontes de produto e reconstruções parciais estavam misturadas. O status inicial afirmava testes de uma PoC que, conforme confirmação recebida naquele momento, não existia.

O problema principal era integridade e consistência do conteúdo. A correção reconstrói especificações e define responsabilidades de cada arquivo.

## 2. Estrutura atual organizada

```text
atlas/
├── README.md                    # entrada, estado e abertura no Cursor
├── AGENTS.md                    # regras gerais para agentes
├── .editorconfig                # UTF-8/LF e convenções de edição
├── .gitattributes               # texto/binariedade no Git
├── .gitignore                   # vault pessoal e saídas locais
├── poc/                         # PoC parcial; escopo e evidências no README/status
└── docs/
    ├── README.md                # índice e mapa de responsabilidades
    ├── AGENTS.md                # regras de escrita documental
    ├── ATLAS_DE_INTERESSES_DOCUMENTACAO_OFICIAL.md
    ├── AI_CONTEXT.md
    ├── CURSOR_MASTER_GUIDE.md
    ├── DATA_MODEL.md
    ├── VAULT_CONTRACT.md
    ├── ESPECIFICACAO_V1.md
    ├── UX_SPECIFICATION.md
    ├── DESIGN_SYSTEM.md
    ├── DECISIONS.md
    ├── ARCHITECTURE_DECISIONS.md
    ├── IMPLEMENTATION_ROADMAP.md
    ├── WORKFLOW_CHECKLIST_V0_V5.md
    ├── TEST_PLAN.md
    ├── REQUIREMENTS_TRACEABILITY.md
    ├── OPEN_QUESTIONS.md
    ├── IMPLEMENTATION_STATUS.md
    ├── CHANGELOG.md
    ├── SOURCES.md
    ├── RECOVERY_LOG.md
    ├── FILE_ARCHITECTURE.md
    ├── design/                  # PDF oficial e tokens extraídos
    ├── examples/                # registros fictícios, sem código de PoC
    └── reference/               # ZIP das fontes anteriores e orientação
```

## 3. Responsabilidade e dependência

| Camada documental | Arquivos principais | Regra |
| --- | --- | --- |
| Intenção | Oficial, decisões | Define propósito e invariantes |
| Contratos | Data Model, Vault Contract, especificação | Define dados e comportamentos; propostas identificadas |
| Experiência | UX, Design System | Define fluxo e referência visual |
| Execução | Roadmap, checklist, guia | Define sequência, não inventa implementação |
| Evidência | Status, testes, rastreabilidade | Diferencia plano, execução e aceite |
| Proveniência | Sources, Recovery Log, reference | Explica escolhas e preserva material recebido |

O documento oficial aponta para contratos detalhados; os demais não devem copiar listas completas de campos para evitar divergência. AI_CONTEXT resume e aponta para fontes. AGENTS da pasta docs complementa o da raiz.

## 4. Melhorias já introduzidas

- Entrada clara na raiz e índice navegável.
- Fontes antigas preservadas em ZIP, fora da documentação ativa consultada normalmente pelo Cursor.
- Regras de notas/links reconciliadas e limites do round-trip esclarecidos.
- Modelo de dados com tipos, nullability, defaults propostos e relacionamentos.
- Contrato de falhas, conflitos, backup e recuperação.
- Especificação funcional com critérios observáveis.
- Plano de testes e matriz requisito→cenário sem PASS fictício.
- PDF incluído, tokens extraídos e exemplos relacionais com UUIDs reais fictícios.
- Propostas abertas centralizadas, sem mascarar decisões faltantes.

## 5. Estrutura técnica futura — PROPOSTA

Criar somente na tarefa técnica correspondente. Se Tauri for escolhida, adaptar às convenções oficiais e às versões efetivamente selecionadas:

```text
poc/                    # prova pequena, runner e README reproduzível
app/
  src/
    domain/             # entidades e invariantes puras
    application/        # casos de uso e coordenação de operações
    infrastructure/     # adapters e contratos de IPC/arquivo
    features/           # telas por domínio
    ui/                 # componentes e tokens visuais
  src-tauri/            # backend nativo, permissões e configuração
tests/
  unit/                 # regras de domínio
  integration/          # arquivos, falhas, recuperação e backup
  native/               # GUI, permissões e restart
fixtures/               # dados válidos, inválidos e cenários de falha
scripts/                # validação, migração e tarefas justificadas
```

A posição de `tests/` acima é na raiz. Não escolher duplicar lógica de persistência em JavaScript e Rust: a PoC deve definir o responsável e o contrato entre UI e backend. UI chama casos de uso; adapters não decidem regras de produto; índices consomem arquivos canônicos.

## 6. Novos arquivos recomendados por etapa

| Arquivo futuro | Quando | Por quê |
| --- | --- | --- |
| `poc/README.md` e lockfile | Criados para as PoCs autorizadas | Registrar comandos/versões por etapa |
| `schemas/*.schema.json` ou validadores equivalentes | Após fechar DATA_MODEL | Contratos verificáveis; evitar cristalizar propostas cedo |
| `fixtures/README.md` | Ao criar suíte | Proveniência, casos e reset dos dados fictícios |
| Configuração CI | Quando existirem comandos reproduzíveis | Repetir testes em cada mudança |
| `docs/NATIVE_VALIDATION.md` | Na prova Tauri | SO, permissões, fechamento e medições |
| `docs/MIGRATIONS.md` | Ao introduzir mudança incompatível | Evolução e rollback preservando IDs |
| `docs/BACKUP_USER_GUIDE.md` | Com fluxo de backup funcionando | Procedimento de exportação/restauração validado |
| `LICENSE` | Após escolha da proprietária | Definir direitos de uso; não presumir licença |
| Manual de usuário e notas de versão | Antes de liberar V1 | Fluxos reais e limitações conhecidas |

## 7. Avaliação final

A arquitetura documental tem entrada, fontes, contratos, experiência, execução e evidência organizados. A PoC executável comprova somente os recortes registrados; aplicativo e suíte V1 não existem. Gates V0/V1 permanecem abertos.
