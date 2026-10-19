# Atlas de Interesses

Sistema pessoal para transformar curiosidade em conhecimento organizado e trabalho concreto. Grupos, interesses, projetos, tarefas e notas compartilham um vault local em Markdown com YAML Frontmatter.

**Estado da execução em 17–18/10/2026:** documentação e PoC local parcial disponíveis. A PoC cobre persistência de um registro, regras puras D-001/D-003/D-004, renomeação de Tag com reconstrução de índice, links/backlinks Markdown e criação de nova permanente em fixture temporária; evidências e limites estão em [status](docs/IMPLEMENTATION_STATUS.md). Aplicativo V1, suíte V1 completa e integração nativa não implementados; gate técnico V0 aberto. Tauri 2 + React + TypeScript continua candidata.

## Abrir no Cursor

1. Extraia o pacote completo ou clone este repositório.
2. Abra a pasta que contém este `README.md` e [AGENTS.md](AGENTS.md) em **File → Open Folder**.
3. Leia o [guia do Cursor](docs/CURSOR_MASTER_GUIDE.md), o [status real](docs/IMPLEMENTATION_STATUS.md) e a [documentação oficial](docs/ATLAS_DE_INTERESSES_DOCUMENTACAO_OFICIAL.md).
4. Consulte [README da PoC](poc/README.md) para comandos e cobertura executada. Novas provas, integração nativa e implementação da V1 dependem de autorização própria.

Os arquivos de texto usam UTF-8 e finais de linha LF. Markdown pode ser lido como texto ou pela prévia do editor. Não há dependências para ler a documentação. Os comandos locais da PoC estão em `poc/`; não há comando de build do aplicativo nesta fase.

## Onde encontrar

| Caminho | Finalidade |
| --- | --- |
| [docs/README.md](docs/README.md) | Índice completo e ordem de leitura |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Contrato de dados proposto, regras e campos |
| [docs/ESPECIFICACAO_V1.md](docs/ESPECIFICACAO_V1.md) | Comportamentos, limites e critérios de aceite |
| [docs/UX_SPECIFICATION.md](docs/UX_SPECIFICATION.md) | Navegação, telas, estados e fluxos |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Tokens extraídos do PDF e uso acessível |
| [docs/FILE_ARCHITECTURE.md](docs/FILE_ARCHITECTURE.md) | Arquitetura atual e estrutura futura sugerida |
| [docs/examples/README.md](docs/examples/README.md) | Vault fictício para compreender os contratos |
| [poc/README.md](poc/README.md) | PoC parcial, comandos, cobertura e limites |
| [docs/reference/README.md](docs/reference/README.md) | Fontes históricas preservadas e sua precedência |

## Princípios

- Markdown é a fonte de verdade; índices podem ser reconstruídos.
- UUID v4 identifica o registro e não muda ao renomear.
- Grupos mostram itens com qualquer tag em comum, sem duplicar registros.
- Tarefas ligam execução a projetos; notas permanentes preservam conhecimento reutilizável.
- Erros de escrita devem ser visíveis; backup deve ter restauração demonstrada.
- V2–V5 acrescentam pesquisa, mapa, grafo e sincronização, respectivamente.

## Contribuir

Leia [AGENTS.md](AGENTS.md). Use dados fictícios, mantenha o vault pessoal fora do repositório e registre resultados reais. Propostas técnicas continuam identificadas como propostas até decisão e prova técnica. A [lista de questões](docs/OPEN_QUESTIONS.md) define o que falta fechar.
