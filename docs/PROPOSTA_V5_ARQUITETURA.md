# Arquitetura da V5 — sync, offline, conflitos, backup automático e Android

**Estado:** DECIDIDO em 19/10/2026 por delegação da proprietária ([D-031](DECISIONS.md)). Implementação parcial descrita no §7; Android fica PENDENTE.

**Critério da documentação oficial:** “conflitos recuperáveis, offline definido e segurança validada”.

## 1. Restrições que a V5 não pode quebrar

- O Markdown/YAML local continua canônico, e índices e caches continuam reconstruíveis (D-011). Um banco remoto como fonte canônica alteraria esse princípio (ADR-008).
- Nada é sobrescrito sem confirmação, e nada é apagado em silêncio (AGENTS, D-023).
- Os arquivos continuam legíveis fora do aplicativo, inclusive em outro aparelho.

## 2. Alternativas avaliadas

| Opção | Como funciona | Prós | Contras | Escolha |
| --- | --- | --- | --- | --- |
| **A. Pasta sincronizada** | O vault fica numa pasta sincronizada por OneDrive, Dropbox, Google Drive ou Syncthing. O Atlas detecta mudanças externas e cópias de conflito | Nenhum servidor nem conta no Atlas; offline por construção; arquivos continuam canônicos; funciona no Android com o mesmo provedor | O app não controla o momento da sincronização; conflitos aparecem como cópias do provedor | **Escolhida** |
| B. Git embutido | Commits e push/pull para um remoto | Histórico completo e merge de texto | Credenciais e chaves no app; merge de YAML pode quebrar registros; curva alta | Rejeitada para a V5 |
| C. Servidor próprio com conta | API de sync com autenticação e merge no servidor | Controle total | Hospedagem, autenticação, dados pessoais em servidor; contraria o local-first | Rejeitada |
| D. CRDT por registro | Estruturas mescláveis | Merge automático | Exigiria outro formato canônico; viola D-011 | Rejeitada |

## 3. Sincronização e offline (opção A)

- **Offline definido:** todas as funções operam sem rede. A rede só é usada pelo provedor de sincronização, fora do Atlas, e por links externos abertos explicitamente.
- **Mudanças externas:** o processo principal observa o vault (`fs.watch` recursivo). Ao estabilizar (800 ms), relê o disco e, se o conjunto de registros e revisões mudou, avisa a interface, que reindexa.
- **Edições em andamento:** o protocolo de revisão (D-023) já impede sobrescrever um arquivo alterado pela sincronização. A pessoa vê o conflito com as duas versões.
- **Indicação:** Configurações mostra se o vault está dentro de uma pasta conhecida (OneDrive pela variável de ambiente, ou Dropbox, Google Drive e Syncthing pelo caminho). É só informativo: qualquer pasta funciona.

## 4. Conflitos recuperáveis

Provedores criam cópias quando dois aparelhos editam o mesmo arquivo:

| Provedor | Exemplo de cópia |
| --- | --- |
| Dropbox | `{uuid} (cópia em conflito de PC 2026-10-19).md` |
| Syncthing | `{uuid}.sync-conflict-20261019-120000-ABCDEFG.md` |
| Google Drive | `{uuid} (1).md` |
| OneDrive | `{uuid}-NOMEDOPC.md` |

**Regra genérica:** numa pasta de registros, um `.md` cujo nome **começa** com o UUID de um registro mas não é exatamente `{uuid}.md` é uma **cópia de conflito** desse registro. O inventário do backup já a trata como conteúdo não canônico.

**Resolução**, sempre por escolha explícita e reversível:

| Ação | O que acontece | Garantias |
| --- | --- | --- |
| **Manter a versão atual** | A cópia vai para a Lixeira do sistema | Nada é apagado de forma permanente |
| **Usar a cópia** | A cópia é validada (frontmatter, mesmo UUID, mesmo tipo); a versão atual vai para a Lixeira; a cópia passa a ser o registro | Pelo protocolo de revisão: se a versão atual mudou desde que foi exibida, a operação para |

O aplicativo nunca mescla automaticamente nem escolhe sozinho. A tela mostra as duas versões lado a lado.

## 5. Backup automático

- **Configuração do dispositivo** (fora do vault, D-014): ativado/desativado, pasta de destino fora do vault, quantidade a manter (padrão 10).
- **Quando roda:** ao abrir o vault e a cada hora, se o último sucesso tiver mais de 24 h. Há também “Fazer backup agora”.
- **Motor:** o mesmo da exportação manual (manifesto, SHA-256, verificação antes de publicar, D-013 a D-019). Os nomes seguem `atlas-auto-AAAAMMDD-HHMMSS.zip`.
- **Bloqueios:** registro inválido ou transação pendente fazem a execução falhar com diagnóstico. Nenhum ZIP parcial é publicado e o resultado aparece em Configurações.
- **Rotação:** depois de um backup verificado, os automáticos mais antigos além do limite vão para a **Lixeira**. Arquivos que não seguem o padrão `atlas-auto-` nunca são tocados.

## 6. Segurança

- **Sem credenciais:** nenhuma credencial ou conta no Atlas; a autenticação é a do provedor de sincronização.
- **Interface isolada:** o renderer roda com `contextIsolation` e `sandbox`, sem `nodeIntegration`. A CSP tem `connect-src 'none'`.
- **IPC restrito:** o IPC verifica o remetente. Links externos abrem só com `http`, `https` e `mailto`, e a navegação da janela é bloqueada.
- **Verificação:** um E2E confere que, no renderer, não há acesso a Node (`require`, `process`) e que uma requisição de rede é recusada pela CSP.

## 7. Implementação e o que fica pendente

| Parte | Estado |
| --- | --- |
| Observação de mudanças externas e reindexação | Implementada nesta etapa |
| Detecção e resolução de cópias de conflito, com Lixeira | Implementada nesta etapa |
| Backup automático com rotação pela Lixeira | Implementado nesta etapa |
| Indicação da pasta sincronizada | Implementada nesta etapa |
| Verificação de segurança | Implementada nesta etapa (E2E) |
| **Android** | **PENDENTE.** Sem SDK Android nem aparelho neste ambiente. Plano em §8 |

## 8. Android (plano)

- **Mesmo modelo de dados e de sincronização:** a pasta do vault é sincronizada pelo mesmo provedor. Até existir o app, os arquivos podem ser lidos e editados por editores de Markdown do Android, porque são texto puro.
- **App:** Capacitor com a mesma interface React, reaproveitando `src/domain`, que é puro.
- **Acesso a arquivos:** um adaptador para o Storage Access Framework, implementando o `StoragePort` do núcleo:
  - escrita exclusiva e substituição com verificação de revisão;
  - listagem;
  - em vez de `rename` atômico entre pastas do SAF, gravação e releitura com hash.

  Antes de oferecer a edição, é preciso provar no aparelho o protocolo D-023 e a transação da Inbox.
- **Gate próprio:** testes do núcleo no runtime do Android, E2E em emulador e aceite da proprietária num aparelho real.
