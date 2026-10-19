# Contexto do Atlas para uma nova sessão

**Ler junto:** [documentação oficial](ATLAS_DE_INTERESSES_DOCUMENTACAO_OFICIAL.md), [status](IMPLEMENTATION_STATUS.md) e [guia do Cursor](CURSOR_MASTER_GUIDE.md).

## Produto

Sistema pessoal que conecta curiosidade, projetos/tarefas e conhecimento permanente. Local-first; arquivos Markdown com YAML são a fonte de verdade. A V1 usa listas e detalhes; V2 pesquisa/fontes, V3 mapa, V4 grafo, V5 sync/Android.

## Estado real

Existe uma PoC local parcial em `poc/`, com testes sintéticos executados para persistência, regras puras D-001/D-003/D-004, renomeação de Tag/reconstrução de índice, links/backlinks Markdown e criação de nova permanente. Consulte `IMPLEMENTATION_STATUS.md` para comandos e limites. Aplicativo V1, suíte V1 completa e integração nativa ainda não existem; gate V0 aberto. Tauri 2 + React + TypeScript continua candidata. Os antigos relatos de PASS seguem inválidos como evidência.

## Invariantes

- UUID v4 estável; relações por ID.
- Group consulta Item por qualquer tag comum; sem cópias ou vínculos espelhados.
- Task pertence a no máximo um Item do tipo project, ou é avulsa.
- Note work exige item; reading aceita item ou null; permanent exige null.
- Criar permanente a partir de contextual gera nova entidade; preserva original e cria link para ela.
- Links canônicos são Markdown relativos, com backlinks reconstruíveis.
- YAML pode ser editado sem modificar bytes do corpo. Alterar links/texto é uma operação explícita distinta.
- Inbox só vira processed após commit recuperável dos resultados; preserva captura e origem.
- Progresso exclui canceled e retorna null sem tarefas elegíveis.
- Backup exige restauração e hashes; não basta gerar ZIP.
- Hub conceitual central. Navegação interna precisa de protótipo.

## Como trabalhar

[DATA_MODEL.md](DATA_MODEL.md) é uma proposta reconciliada, com decisões de produto identificadas. Antes de codificar, fechar os itens necessários de [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md). Não tratar proposta como contrato aprovado nem documentação como evidência de software. V1 só após prova técnica e autorização explícita.

Use um implementador por tarefa, dados fictícios e verificações reproduzíveis. Atualize o status com arquivos, comandos e resultados reais. O ZIP em reference contém fontes históricas e não deve orientar implementação diretamente.
