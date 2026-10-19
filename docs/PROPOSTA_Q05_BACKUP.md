# Proposta técnica para decisão da Q-05 — backup e restauração

**Data:** 18/10/2026 · **Estado:** PROPOSTO para decisão da proprietária. **Atualização posterior (18/10/2026):** a proprietária escolheu M-B, E-C, C-A, L-C, S-A e as diretrizes P-6 a P-8 (§7). As escolhas foram formalizadas em [VAULT_CONTRACT §7](VAULT_CONTRACT.md) e D-013. As seções 1 a 6 abaixo são preservadas como a análise que fundamentou a decisão. Este documento não altera [VAULT_CONTRACT](VAULT_CONTRACT.md), [DATA_MODEL](DATA_MODEL.md), [ESPECIFICACAO_V1](ESPECIFICACAO_V1.md) nem [DECISIONS](DECISIONS.md), não fecha a Q-05 e não autoriza implementar backup. Nenhum código de backup existe na PoC.

## 1. Como ler

| Rótulo | Significado neste documento |
| --- | --- |
| **DECIDIDO** | Regra da documentação oficial ou de DECISIONS; não pode ser alterada por esta proposta |
| **ESPECIFICADO** | Requisito ou critério de aceite da especificação funcional consolidada (nível 3 em [SOURCES](SOURCES.md)); só muda por decisão registrada |
| **PROPOSTO (existente)** | Texto já presente em VAULT_CONTRACT, ADR-006 ou OPEN_QUESTIONS, ainda não aprovado |
| **RECOMENDAÇÃO** | Sugestão técnica nova desta proposta; hipótese até decisão e prova |
| **PENDENTE** | Pergunta que exige escolha da proprietária ou medição |

## 2. Requisitos já decididos que não podem ser alterados

| Requisito | Fonte | Estado |
| --- | --- | --- |
| Backup manual em ZIP | Oficial §6; D-007 | DECIDIDO |
| O ZIP inclui registros e anexos do vault | Oficial §6 | DECIDIDO |
| `manifest.json` com versão, data, contagem e hashes SHA-256 | Oficial §6; D-007 | DECIDIDO |
| O manifesto não inclui hash de si mesmo | Oficial §6 | DECIDIDO |
| Restauração em pasta nova | Oficial §6; D-007 | DECIDIDO |
| A restauração só é disponibilizada após verificar todos os arquivos | Oficial §6 | DECIDIDO |
| Estado transacional pendente precisa ser resolvido antes de gerar backup consistente | Oficial §6 | DECIDIDO |
| A recuperação precisa ser provada na V0; o gate V0 exige restauração comprovada | D-007; Oficial §8 | DECIDIDO |
| UUID preservado ao restaurar | Oficial §3.2; D-005 | DECIDIDO |
| Markdown local é a fonte; índices e caches são reconstruíveis | D-011; Oficial §3.1 | DECIDIDO |
| Arquivamento antes de exclusão; não apagar referências silenciosamente | Oficial §3.7; AGENTS | DECIDIDO |
| Não apresentar sucesso antes de confirmar a escrita | AGENTS; D-012 | DECIDIDO |
| Exportar ZIP para fora do vault; confirmar sucesso somente após verificação | ESPECIFICACAO_V1 F-07 | ESPECIFICADO |
| Restaurar em pasta nova; conferir manifesto, hashes e relações antes de usar | ESPECIFICACAO_V1 F-07 | ESPECIFICADO |
| Diagnóstico de arquivo inválido, permissão, colisão e espaço insuficiente | ESPECIFICACAO_V1 F-07 | ESPECIFICADO |
| Aceite: restaurar fixture em pasta limpa e comparar bytes de registros/anexos; arquivo adulterado ou caminho inseguro recusado; falha não altera o vault ativo | ESPECIFICACAO_V1 F-07 | ESPECIFICADO |
| Exportação completa; arquivos legíveis fora da aplicação | ESPECIFICACAO_V1 §9 (Portabilidade) | ESPECIFICADO |

O texto “versão” do manifesto em D-007 não diz se é versão do formato do manifesto, do schema dos registros ou do aplicativo. Ver P-1.

## 3. Perguntas em aberto e referências

| ID | Pergunta | Referência | Bloqueia |
| --- | --- | --- | --- |
| P-1 | Estrutura do manifesto: campos, significado de “versão”, forma de `files` e normalização de caminhos | Q-05 (“formato files/hash”); VAULT_CONTRACT §7 “Provar o formato antes de congelá-lo”; ADR-006 | TC-13, TC-14 |
| P-2 | Exclusões: o que entra e o que fica fora do ZIP | Q-05; VAULT_CONTRACT §7 Exportação 3; Q-10 (settings.yml/assets propostos) | TC-13 |
| P-3 | Snapshot consistente diante de escrita externa ou interna | Q-05; VAULT_CONTRACT §7 Exportação 1–2; Q-04 | TC-15 |
| P-4 | Limites de ZIP, arquivos, tamanho e expansão | Q-05; VAULT_CONTRACT §7 Restauração 2; Q-07 (hardware e metas) | TC-14 |
| P-5 | Política de links simbólicos na exportação e na restauração | Q-05; VAULT_CONTRACT §7 Restauração 2; TC-14 | TC-13, TC-14 |
| P-6 | Formatos de anexos | Q-05; DATA_MODEL §10; Q-10 | TC-13 (fixture com anexos) |
| P-7 | Que erros de validação de registros e relações impedem disponibilizar o vault restaurado | VAULT_CONTRACT §7 Restauração 4 (“erros fatais”); D-012 | TC-13, TC-14 |
| P-8 | O que “disponibilizar” significa: só relatório, abrir o vault restaurado ou trocar o vault ativo | Oficial §6; UX §2 (“resumo de verificação antes de ativar”); Q-08 | Aceite de UX |

Dependências externas à Q-05: Q-04 (falhas e transações pendentes), Q-07 (SO, hardware e metas), Q-10 (configuração portátil e assets) e P-04 em DECISIONS (detalhes técnicos do contrato de vault).

## 4. Alternativas e implicações

### 4.1 Manifesto (P-1)

| Alternativa | Descrição | Integridade | Segurança | Portabilidade | Restauração |
| --- | --- | --- | --- | --- | --- |
| M-A — PROPOSTO (existente) | `schema_version`, `created_at`, `file_count`, `files` como objeto caminho → SHA-256 | Detecta conteúdo alterado ou ausente | Um objeto JSON com chave duplicada é aceito pela maioria dos parsers (a última vence); a duplicata fica invisível sem parser estrito | Simples e legível | Não informa o tamanho esperado; o limite de expansão depende só dos cabeçalhos ZIP |
| M-B — RECOMENDAÇÃO | `manifest_version`, `created_at`, `file_count`, `files` como **lista** ordenada de `{ path, size, sha256 }` | Igual a M-A, mais a conferência de tamanho antes do hash | Duplicatas detectáveis explicitamente; o tamanho declarado permite recusar expansão excessiva antes de extrair | Legível; caminhos relativos com `/` | Permite pré-validação completa e mensagens precisas |
| M-C | M-B com metadados extras (versão do app que gerou, `schema_version` dos registros) | Igual a M-B | Não incluir o caminho absoluto do vault de origem (privacidade) | Ajuda migrações futuras | Permite recusar versão não suportada antes de extrair |

Regras recomendadas, independentemente da alternativa:

- SHA-256 em hexadecimal minúsculo dos bytes exatos do arquivo incluído.
- Caminhos relativos à raiz do vault, separador `/`, sem `.`/`..`, sem barra inicial, sem letra de unidade, UTF-8, sem normalização Unicode silenciosa. A restauração recusa colisões que só diferem por caixa ou forma Unicode, porque elas se fundiriam em Windows ou macOS.
- O mapa não contém `manifest.json` (DECIDIDO). O manifesto fica sem proteção contra alteração conjunta de arquivo e hash: o SHA-256 detecta corrupção, mas não autentica o autor (VAULT_CONTRACT §7). Assinatura ou criptografia ficam fora do escopo, salvo decisão.
- Para “versão” de D-007, a RECOMENDAÇÃO é separar `manifest_version` (formato do manifesto) da versão dos registros (já em cada arquivo).

### 4.2 Exclusões (P-2)

| Alternativa | Descrição | Integridade | Segurança | Portabilidade | Restauração |
| --- | --- | --- | --- | --- | --- |
| E-A — lista de inclusão | Só as pastas canônicas (`groups`, `tags`, `items`, `tasks`, `notes/*`, `inbox`) mais `assets/` e `settings.yml`, se aprovados em Q-10 | Previsível | Não leva arquivos de outras ferramentas | Arquivos do usuário fora dessas pastas **não entram**: risco de perda silenciosa e conflito com “exportação completa” | Vault restaurado só com o conteúdo canônico |
| E-B — lista de exclusão | Tudo dentro do vault, menos derivados conhecidos (cache, `.tmp_*`, ZIP de destino) | Completo | Pode levar dados de outras ferramentas (`.git`, configurações de editor, eventuais segredos) | Máxima | Restaura também arquivos desconhecidos |
| E-C — RECOMENDAÇÃO | Inclusão canônica mais **inventário explícito** do que não é canônico: o backup lista esses arquivos e exige escolha (incluir todos, excluir todos) ou bloqueia com diagnóstico; nada é omitido em silêncio | Completo por decisão consciente | Arquivos estranhos não entram sem confirmação | Alta | Relatório diz exatamente o que foi incluído |

Pontos comuns recomendados:

- `.txn_*.json` presente **bloqueia** a exportação. É a consequência direta de “estado transacional pendente precisa ser resolvido” (DECIDIDO).
- `.tmp_*` nunca é incluído. Temporário órfão é listado no diagnóstico, e não apagado (VAULT_CONTRACT §4 item 7).
- Caches e índices reconstruíveis ficam fora (D-011).
- O ZIP de destino fica fora do vault (ESPECIFICADO), e o ZIP temporário de trabalho também.
- Arquivos arquivados entram, pois arquivar não é excluir (DECIDIDO).
- Preferências do dispositivo ficam fora e configuração portátil entra, conforme a separação proposta em Q-10.

### 4.3 Snapshot consistente (P-3)

| Alternativa | Descrição | Implicações |
| --- | --- | --- |
| C-A — RECOMENDAÇÃO | Pausar escritas internas; ler e calcular o hash de cada arquivo; ao terminar o ZIP, refazer `lstat` e hash dos arquivos de origem; qualquer divergência aborta com diagnóstico e permite repetir | Portável; detecta escrita externa durante a coleta; não impede a escrita, só a detecta (há uma janela até a segunda leitura, como no adapter atual) |
| C-B | Copiar o vault para staging e gerar o ZIP da cópia | Isola a geração do ZIP, mas a própria cópia tem a mesma janela; dobra o uso de disco |
| C-C | Snapshot do SO (VSS, APFS) | Consistência forte, mas não portável, exige privilégios e depende de Q-07 |

O ZIP é escrito como temporário fora do vault, relido e verificado contra o manifesto, e só então renomeado para o nome final e apresentado como concluído (VAULT_CONTRACT §7 Exportação 5 e ESPECIFICADO F-07). Falha ou interrupção nunca deixa um ZIP com o nome final.

### 4.4 Limites (P-4)

| Alternativa | Descrição | Integridade | Segurança | Portabilidade | Restauração |
| --- | --- | --- | --- | --- | --- |
| L-A — sem limites próprios | Confiar no SO e na biblioteca | — | Vulnerável a ZIP de expansão excessiva, muitas entradas e caminhos longos | — | Pode esgotar o disco ou travar |
| L-B — limites fixos | Teto de entradas, tamanho por arquivo, total descompactado, razão de compressão, comprimento e profundidade de caminho | Protege a máquina | Mitiga ZIP malicioso | Valores precisam caber em todos os SOs-alvo | Recusa previsível, com mensagem |
| L-C — RECOMENDAÇÃO | L-B, mais verificação de espaço livre no destino contra o total declarado, mais contagem real de bytes durante a extração (não confiar em cabeçalhos) | Igual a L-B | Igual a L-B, mais resistência a cabeçalhos mentirosos | Igual | Falha antes de encher o disco |

Os **valores numéricos** são PENDENTES: dependem de Q-07 (hardware e volume de fixture) e de medição. Esta proposta não sugere números como decisão. Restrições de formato RECOMENDADAS para a restauração:

- aceitar só os métodos store e deflate;
- recusar entradas criptografadas, multi-disco, nomes duplicados e diretórios com dados;
- tratar ZIP64 explicitamente, por suporte ou recusa documentada.

### 4.5 Links simbólicos (P-5)

| Alternativa | Exportação | Integridade | Segurança | Portabilidade |
| --- | --- | --- | --- | --- |
| S-A — RECOMENDAÇÃO conservadora | Symlink, junção ou ponto de reparo no vault **bloqueia** o backup, com diagnóstico do caminho | O backup nunca fica incompleto em silêncio | Não lê nada fora do vault | Força o usuário a resolver antes |
| S-B | Pular o symlink e listá-lo no relatório (sem seguir) | Backup incompleto, mas declarado | Seguro | Usável quando há links de outras ferramentas |
| S-C | Seguir o link e incluir o conteúdo do alvo | Pode duplicar conteúdo ou entrar em ciclos | Pode exfiltrar arquivos fora do vault; contraria “incluir … dentro do vault” | — |
| S-D | Armazenar o link como entrada de link no ZIP | Preserva a forma | Na restauração, permite travessia | Windows exige privilégio para criar links |

Restauração: a RECOMENDAÇÃO é **sempre recusar** entradas que sejam links (atributos externos do ZIP), nunca criar links, verificar sem seguir links que nenhum componente do caminho de destino é link, e extrair só para arquivos regulares novos. Essa recusa já é esperada pelo cenário planejado TC-14 (“symlink … Rejeitar antes de ativar”) e pelo aceite ESPECIFICADO (“caminho inseguro é recusado”). A escolha entre S-A e S-B na exportação é PENDENTE. Como Windows trata junções e pontos de reparo de outro jeito, esse comportamento precisa de teste próprio na plataforma de Q-07.

### 4.6 Anexos (P-6)

A RECOMENDAÇÃO é o backup tratar anexos como **bytes opacos**: inclui, faz hash e restaura sem interpretar o formato. Uma política de formatos aceitos pertence ao recurso de anexos (Q-10 e DATA_MODEL §10), não ao backup. Se a proprietária quiser restringir formatos, a restrição deve valer na entrada do anexo, não silenciosamente no backup.

### 4.7 Validação e disponibilização na restauração (P-7, P-8)

Sequência RECOMENDADA, coerente com VAULT_CONTRACT §7:

1. A pasta de destino precisa ser nova ou vazia. Extrair para staging dentro dela; não mesclar nem tocar o vault ativo.
2. Pré-validar o manifesto e o diretório central do ZIP: nomes, duplicatas (também por caixa ou forma Unicode), caminhos absolutos, travessia, links, limites, versão suportada.
3. Extrair com criação exclusiva, conferindo tamanho e hash de cada arquivo; recusar entradas extras ou ausentes e contagem divergente.
4. Validar os registros (YAML, UUID único, pasta coerente com o tipo, D-001) e as relações; reconstruir os índices.
5. Só então declarar o vault restaurado como verificado. Em falha, manter o staging para diagnóstico, nunca alterar o vault ativo e não apresentar sucesso.

PENDENTE para a proprietária (P-7): se referências ausentes, ou registros válidos com aviso, bloqueiam a disponibilização ou só geram diagnóstico. A RECOMENDAÇÃO é que divergência de hash, contagem, caminho ou YAML inválido bloqueie, e que referência ausente gere diagnóstico sem bloquear, já que D-011 e DATA_MODEL §1 tratam referência ausente como diagnóstico, não exclusão. P-8 (trocar ou abrir o vault ativo) depende de UX e Q-08.

### 4.8 Ferramenta para a futura PoC

Node não tem gravador ou leitor de ZIP embutido (só o deflate do `zlib`), então a PoC precisará de uma biblioteca. A escolha, a versão e a instalação dependem de autorização e de consulta às fontes oficiais vigentes, como nas etapas anteriores. A biblioteca precisa expor os atributos externos (para detectar links), o diretório central e a leitura em streaming com contagem de bytes.

## 5. Critérios de aceitação para comprovar backup e restauração

Os critérios abaixo detalham TC-13 a TC-15 e o aceite F-07. **Continuam planejados**; nenhum foi implementado ou executado. Cada critério exige ambiente, comando, fixture e hashes registrados ([TEST_PLAN](TEST_PLAN.md) §11). **Versão vigente revisada:** [TEST_PLAN](TEST_PLAN.md) §10 (AC-01–AC-14); a tabela abaixo é a versão anterior.

| ID | Origem | Preparação | Ação | Resultado observável |
| --- | --- | --- | --- | --- |
| AC-01 | D-007; TC-13 | Fixture sintética com as pastas canônicas, registros arquivados, anexos binários, corpos CRLF/LF e nomes Unicode | Exportar para fora do vault | ZIP final existe só após a verificação; o manifesto lista exatamente os arquivos incluídos, sem si mesmo; a contagem confere; os SHA-256 conferem com os bytes de origem |
| AC-02 | D-007; F-07; TC-13 | ZIP do AC-01 | Restaurar em pasta nova | Bytes e SHA-256 de cada registro e anexo iguais aos da origem; mesmos UUIDs e caminhos; índices de Tag/Group/Item e de links/backlinks reconstruídos iguais aos da origem |
| AC-03 | Oficial §6; VAULT §7 | Vault com `.txn_*.json` pendente | Exportar | Exportação recusada com diagnóstico; nenhum ZIP final criado |
| AC-04 | TC-15; P-3 | Escrita externa injetada durante a coleta | Exportar | Divergência detectada; nenhum ZIP final; diagnóstico permite repetir |
| AC-05 | TC-15; F-07 | Falha sintética no meio da escrita do ZIP (EIO, espaço) | Exportar | Nenhum arquivo com o nome final; vault inalterado (hashes); sem sucesso aparente |
| AC-06 | F-07; TC-14 | ZIPs adulterados: hash errado, arquivo extra, ausente, duplicado, duplicado por caixa, `..`, caminho absoluto, link, versão de manifesto desconhecida | Restaurar | Recusa antes de disponibilizar; nada escrito fora do destino; vault ativo inalterado; diagnóstico identifica a causa |
| AC-07 | P-4; TC-14 | ZIP acima dos limites decididos (entradas, tamanho, razão) e cabeçalho que declara menos bytes do que contém | Restaurar | Recusa ou interrupção dentro do limite; disco não esgotado; diagnóstico |
| AC-08 | F-07 | Destino não vazio ou dentro do vault ativo | Restaurar | Recusa sem escrita |
| AC-09 | P-5 | Vault de origem com link simbólico ou junção | Exportar | Comportamento S-A ou S-B conforme decidido; nunca lê o alvo fora do vault |
| AC-10 | P-2 | Arquivos não canônicos no vault | Exportar | Comportamento E-A, E-B ou E-C conforme decidido; nada omitido sem constar no relatório |
| AC-11 | D-012; F-07 | Qualquer falha acima | Inspeção | Nenhuma mensagem ou estado de “concluído” antes da verificação final |
| AC-12 | Gate V0; TC-17/TC-21 | Aplicativo nativo na plataforma de Q-07 | Exportar e restaurar pela GUI, reiniciar e reabrir | Repete AC-01, AC-02 e AC-06 no app real; a suíte Node não substitui este critério |

AC-01 a AC-11 podem ser provados por uma PoC Node com disco real. AC-12 exige a prova nativa. TC-13 a TC-15 só podem receber PASS completo quando todos os seus critérios, inclusive os nativos aplicáveis, tiverem evidência.

## 6. Decisões solicitadas à proprietária

| Decisão | Opções | Recomendação técnica |
| --- | --- | --- |
| Formato do manifesto e significado de “versão” | M-A, M-B, M-C | M-B, com `manifest_version` separado |
| Exclusões | E-A, E-B, E-C | E-C |
| Snapshot | C-A, C-B, C-C | C-A na V0/V1 |
| Limites | L-A, L-B, L-C; valores numéricos | L-C; valores após Q-07 e medição |
| Links simbólicos na exportação | S-A, S-B (S-C e S-D desaconselhadas) | S-A; recusa sempre na restauração |
| Anexos | Bytes opacos ou restrição de formato | Bytes opacos no backup |
| Erros que bloqueiam a disponibilização | Bloquear tudo ou bloquear integridade e avisar referências | Bloquear integridade e caminho; avisar referência ausente |
| Disponibilização | Relatório, abrir o restaurado, trocar o ativo | Depende de Q-08; mínimo: relatório verificado sem trocar o vault ativo |
| Autorização da PoC e da biblioteca ZIP | — | Necessária antes de implementar |

Após a decisão, devem ser atualizados juntos (docs/AGENTS): VAULT_CONTRACT §7, ADR-006, OPEN_QUESTIONS Q-05, TEST_PLAN TC-13–15, REQUIREMENTS_TRACEABILITY REQ-008 e, se mudar campo ou pasta, DATA_MODEL.

## 7. Registro da decisão (18/10/2026)

| Tema | Escolha da proprietária | Onde está formalizado | Pendência remanescente |
| --- | --- | --- | --- |
| P-1 Manifesto | M-B: `manifest_version`, `created_at` UTC ISO 8601, `file_count`, lista ordenada `{ path, size, sha256 }`, sem o próprio manifesto | VAULT_CONTRACT §7.1 | ZIP64 (§7.5), decisão após Q-07 |
| P-2 Exclusões | E-C com incluir/excluir/cancelar; arquivados preservados; caches excluídos; `.txn_*` bloqueia; órfãos não apagados | VAULT_CONTRACT §7.2 | Canonicidade de `settings.yml`/`assets/` e configuração portátil (Q-10) |
| P-3 Consistência | C-A, com o limite declarado de não ser snapshot atômico | VAULT_CONTRACT §7.4 | Reavaliar snapshot do SO só com Q-07 |
| P-4 Limites | L-C: estrutura definida | VAULT_CONTRACT §7.5 | Valores numéricos (Q-07 e medição) |
| P-5 Links | S-A; recusa de links na restauração | VAULT_CONTRACT §7.6 | Detecção de junções e pontos de reparo por plataforma (Q-07) |
| P-6 Anexos | Bytes opacos, respeitando Q-10 | VAULT_CONTRACT §7.3 | Política de anexos (Q-10) |
| P-7 Validação | Bloqueio por integridade e estrutura; referência ausente só gera diagnóstico | VAULT_CONTRACT §7.7 | — |
| P-8 Disponibilização | Cópia independente verificada e relatório, sem ativar o vault atual | VAULT_CONTRACT §7.7 | GUI e troca do vault ativo (Q-08); destino após falha (Q-04/Q-08) |

### 7.1 Auditoria de dependências

- **Formalizável agora, sem depender de outra questão:** formato M-B (exceto ZIP64), regras E-C para registros canônicos, temporários, `.txn_*`, caches e conteúdo não canônico, fluxo C-A, estrutura L-C, S-A para symlinks POSIX e para entradas de link na restauração, anexos opacos, regras de bloqueio P-7 e cópia independente P-8.
- **Depende da Q-07 (SO, hardware, metas):** valores dos limites; escolha de ZIP64; detecção de junções e pontos de reparo; compatibilidade com o extrator nativo; eventual snapshot do SO; o critério nativo AC-12.
- **Depende da Q-10 (configuração portátil × dispositivo; anexos):** se `settings.yml` e `assets/` são canônicos; quais configurações entram no backup; política de formatos e tamanhos de anexos. Até a decisão, o item 5 de E-C trata esses caminhos como não canônicos, sem fechar a Q-10.
- **Depende da Q-08 (UX):** abertura do vault restaurado pela GUI, troca do vault ativo e apresentação do inventário E-C e do relatório.
- **Depende da Q-04 (falhas):** destino de uma restauração interrompida e quarentena dos temporários.
- **Exigiu revisão do contrato técnico do vault (P-04):** VAULT_CONTRACT §7 inteiro; P-04 permanece aberta para transação, edição externa e migração.
- **DATA_MODEL:** não alterado. O manifesto de backup não é registro do vault e as decisões não mudam campos, caminhos nem a estrutura dos registros.

### 7.2 Recomendações para resolver os bloqueios

1. **Q-07:** decidir o SO desktop inicial e o volume de fixture de referência; medir exportação e restauração com a PoC; derivar os limites dessas medições com margem documentada; então decidir ZIP64 (Z-B recomendado; Z-A se todos os limites ficarem abaixo dos tetos clássicos).
2. **Q-10:** decidir se `settings.yml` e `assets/` passam a ser canônicos e listar quais chaves de configuração são portáteis.
3. **Q-08:** prototipar a tela de inventário E-C (incluir/excluir/cancelar) e o relatório de restauração; decidir se “abrir o vault restaurado” é uma ação separada.
4. **Q-04:** decidir se a pasta de uma restauração falha é mantida, marcada como não verificada ou limpa pelo aplicativo, e com qual confirmação.

## 8. Recomendação de biblioteca ZIP (sem instalação)

**Consulta em 18/10/2026.** Fontes primárias: metadados do registro npm e README e typings publicados na versão exata via unpkg; issue tracker do fflate. Nada foi instalado; `poc/package.json` e o lockfile não foram alterados. A compatibilidade com o Node `24.22.0` da PoC foi inferida das declarações de `engines` e dos READMEs, **sem execução**.

| Candidata (versão avaliada) | Licença / dependências diretas | Leitura e escrita | Diretório central e atributos externos | Bytes reais e validação prévia | Caminhos, duplicatas, métodos, ZIP64 | Observações |
| --- | --- | --- | --- | --- | --- | --- |
| **yauzl 3.4.0** (leitura) + **yazl 3.3.1** (escrita) | MIT; `pend` / `buffer-crc32` | Leitura com acesso aleatório; escrita em stream | Lê o diretório central (“authority on the contents”); `Entry.externalFileAttributes`; yazl grava `stats.mode << 16` | `validateEntrySizes` (padrão) gera erro quando os bytes descompactados divergem de `uncompressedSize`; `lazyEntries` permite enumerar e validar todas as entradas antes de abrir qualquer stream | `validateFileName` recusa `/` inicial, letra de unidade, segmentos `..` e `\` (com `strictFileNames`); **não detecta nomes duplicados** (o código do Atlas precisa fazê-lo); `isEncrypted`/`canDecodeFileData`; criptografia forte gera erro; multi-disco recusado; ZIP64 lido (até 8 PiB) e escrito quando necessário, com `forceZip64Format` para teste | Node ≥ 12 (`engines`); tipos em `@types/yauzl` 3.4.0 e `@types/yazl` 3.3.1 (MIT, DefinitelyTyped); sem API de unzip em stream, por correção ao padrão ZIP; yazl sem release desde 23/11/2024 |
| **@zip.js/zip.js 2.24.0** | BSD-3-Clause; sem dependências | Leitura e escrita; Web Streams | `externalFileAttributes`, `unixMode` e `symlink` (`S_IFLNK`) em `EntryMetaData` | `checkOverlappingEntry`; `checkSignature` | Modo estrito detecta arquivo ambíguo e **nomes duplicados** (comparação exata; caixa e forma Unicode não são detectadas); ZIP64 suportado | Node ≥ 18; API extensa (typings de cerca de 259 KB); versão publicada em 16/10/2026, dois dias antes da consulta |
| fflate 0.8.3 | MIT; sem dependências | Leitura e escrita | `attrs`/`os` na escrita | — | ZIP64 incompleto: issues e PRs abertos #298, #301 e #230 (consulta ao tracker) | Descartada por ZIP64 |
| node-stream-zip 1.16.0 | MIT | Somente leitura | — | — | ZIP64; valida `../` e `c:\` nos nomes por padrão | Precisaria de outro gravador; não avaliada a fundo |
| adm-zip 0.6.1, jszip 3.10.2, unzipper 0.12.5, archiver 8.0.0 | MIT; jszip MIT ou GPL-3.0; unzipper e archiver com várias dependências | — | — | — | — | Não priorizadas: o README publicado do adm-zip não documenta os critérios exigidos; jszip tem licença dupla e dependências; unzipper interpreta em stream pelos cabeçalhos locais; archiver só escreve. Sem avaliação detalhada |

**Preferida: par yauzl 3.4.0 + yazl 3.3.1** (mesmo autor). Motivos:

- a leitura segue o diretório central e permite validar o inventário inteiro antes de qualquer escrita (§7.7 item 2);
- `validateEntrySizes` dá a contagem real de bytes exigida por L-C;
- os atributos externos ficam expostos para a recusa S-A;
- `validateFileName` cobre travessia e caminhos absolutos;
- suporta ZIP64 nas duas direções, inclusive o modo forçado para AC-13;
- licença MIT, poucas dependências diretas e tipos disponíveis.

**Lacunas a cobrir no código do Atlas:** detecção de duplicatas (exatas, por caixa e por forma Unicode); interpretação de `S_IFLNK` em `externalFileAttributes >>> 16`; limites numéricos e razão de compressão; verificação de espaço livre; recusa de métodos diferentes de 0 e 8.

**Alternativa: @zip.js/zip.js**, por ser um pacote único, sem dependências, com modo estrito e `symlink` explícito. Ressalvas: a superfície da API é maior, as releases são frequentes e a versão mais recente é recente demais para ser fixada. Antes de instalar, escolher uma versão publicada há pelo menos duas semanas e reconferir as fontes.

**Pendências antes de instalar:** autorização da proprietária; nova consulta às versões vigentes no dia da instalação; registro de URL, versão e hash no status; prova de que a escolha atende AC-06, AC-07 e AC-13 em teste.

**Fontes consultadas (18/10/2026):**

- Registro npm: https://registry.npmjs.org/yauzl · https://registry.npmjs.org/yazl · https://registry.npmjs.org/@zip.js%2Fzip.js · https://registry.npmjs.org/fflate · https://registry.npmjs.org/node-stream-zip · https://registry.npmjs.org/adm-zip · https://registry.npmjs.org/jszip · https://registry.npmjs.org/unzipper · https://registry.npmjs.org/archiver · https://registry.npmjs.org/@types%2Fyauzl · https://registry.npmjs.org/@types%2Fyazl
- READMEs e typings da versão exata: https://unpkg.com/yauzl@3.4.0/README.md · https://unpkg.com/yazl@3.3.1/README.md · https://unpkg.com/@zip.js/zip.js@2.24.0/README.md · https://unpkg.com/@zip.js/zip.js@2.24.0/index.d.ts · https://unpkg.com/fflate@0.8.3/README.md · https://unpkg.com/node-stream-zip@1.16.0/README.md · https://unpkg.com/adm-zip@0.6.1/README.md
- Repositórios: https://github.com/thejoshwolfe/yauzl · https://github.com/thejoshwolfe/yazl · https://github.com/gildas-lormeau/zip.js · https://github.com/101arrowz/fflate/issues?q=zip64
