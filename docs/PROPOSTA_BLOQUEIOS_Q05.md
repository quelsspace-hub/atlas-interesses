# Proposta para resolver os bloqueios da Q-05 — Q-07, Q-10, Q-08 e Q-04

**Data:** 18/10/2026 · **Estado:** PROPOSTO, não vinculante. **Revisão de estado (§9):** nenhuma DQ foi aprovada pela proprietária até esta revisão; todas permanecem pendentes. **Atualização (§10):** a proprietária aceitou DQ-01, DQ-02 e DQ-04 a DQ-09 (bloco 1); DQ-03 e DQ-10 a DQ-25 continuam pendentes. **Atualização (§11):** bloco 2 aceito (DQ-03 e DQ-10 a DQ-25); todas as 25 DQ estão aceitas, e nenhuma está implementada ou testada. Este documento prepara decisões da proprietária; não altera [VAULT_CONTRACT](VAULT_CONTRACT.md), [DATA_MODEL](DATA_MODEL.md), [ESPECIFICACAO_V1](ESPECIFICACAO_V1.md), [DECISIONS](DECISIONS.md) nem [OPEN_QUESTIONS](OPEN_QUESTIONS.md), não fecha nenhuma questão e não autoriza implementar backup. A política vigente de backup é D-013, em [VAULT_CONTRACT §7](VAULT_CONTRACT.md), e deve ser preservada.

Rótulos, como em [PROPOSTA_Q05_BACKUP](PROPOSTA_Q05_BACKUP.md): **DECIDIDO** (oficial ou DECISIONS), **ESPECIFICADO** (especificação funcional consolidada), **FORMALIZADO** (D-013), **VERIFICADO** (observação delimitada com ambiente registrado), **RECOMENDAÇÃO** (sugestão nova) e **PENDENTE**.

A tabela única de decisões está na [seção 7](#7-tabela-única-de-decisões).

## 1. Fontes documentais usadas

[Documentação oficial](ATLAS_DE_INTERESSES_DOCUMENTACAO_OFICIAL.md) §3, §6, §7 e §9; [DECISIONS](DECISIONS.md) D-002, D-005, D-007, D-011, D-012, D-013 e P-04; [OPEN_QUESTIONS](OPEN_QUESTIONS.md) Q-04, Q-05, Q-07, Q-08 e Q-10; [DATA_MODEL](DATA_MODEL.md) §1, §2 e §10; [VAULT_CONTRACT](VAULT_CONTRACT.md) §3, §4 e §7; [ESPECIFICACAO_V1](ESPECIFICACAO_V1.md) F-07 e §9; [UX_SPECIFICATION](UX_SPECIFICATION.md) §2–§4; [ARCHITECTURE_DECISIONS](ARCHITECTURE_DECISIONS.md) ADR-006 e ADR-008; [TEST_PLAN](TEST_PLAN.md) TC-13–TC-17, TC-21, TC-23, TC-24 e §10 (AC-01–AC-14); [PROPOSTA_Q05_BACKUP](PROPOSTA_Q05_BACKUP.md) §7–§8; [IMPLEMENTATION_STATUS](IMPLEMENTATION_STATUS.md) §7–§15; `AGENTS.md` da raiz e de `docs/`.

Fontes técnicas: comandos de leitura do ambiente e uma sonda exploratória em diretório temporário (§2). Nenhuma nova consulta web foi feita; a avaliação de bibliotecas continua sendo a de PROPOSTA_Q05_BACKUP §8.

## 2. Ambiente real observado — VERIFICADO (18/10/2026, delimitado)

| Item | Valor observado | Como |
| --- | --- | --- |
| SO | Windows 11 Pro, versão 10.0.26200 (build 26200), 64 bits | `Get-CimInstance Win32_OperatingSystem` |
| CPU | Intel Core i5-1334U (13ª geração), 10 núcleos, 12 lógicos | `Win32_Processor` |
| RAM | 15,7 GiB | `Win32_ComputerSystem` |
| Sistema de arquivos | NTFS no volume do repositório e no volume temporário | `Get-Volume` |
| Caminhos longos | `LongPathsEnabled = 1` neste equipamento | Leitura do registro, sem alteração |
| Privilégios | Sessão não elevada; Modo de Desenvolvedor não habilitado | Leitura do registro, sem alteração |
| Runtime da PoC | Node `24.22.0` (local, pinado); Node global `20.20.2` (EOL) | `node --version` |

Sonda exploratória com o Node da PoC, em diretório temporário removido ao final (não é teste TC/AC nem código de backup):

- `fs.symlink` de arquivo e de diretório: **falhou com `EPERM`** nesta sessão (não elevada, sem Modo de Desenvolvedor);
- `fs.symlink(..., 'junction')`: **criado**; `lstat` retornou `isSymbolicLink() === true`, `isFile() === false`, `isDirectory() === false`;
- `fs.statfs`: disponível (`bavail`, `bsize` e outros), permitindo verificar espaço livre.

Implicações: o ambiente de teste prioritário existente é Windows 11 x64 em NTFS. Testes de symlink POSIX-like no Windows exigem elevação ou Modo de Desenvolvedor. Junções são detectáveis pelo `lstat` do Node. Outros pontos de reparo (por exemplo, arquivos sob demanda de serviços de nuvem) não foram testados e não devem ser presumidos detectáveis.

## 3. Q-07 — Plataforma, hardware, desempenho e limites

### 3.1 Já decidido

- V1 local-first, com acesso nativo e uso offline (Oficial §3.9, DECIDIDO).
- Stack Tauri 2 + React + TypeScript é **candidata**; permissões, reinício, fechamento, tamanho e RAM devem ser validados antes de decidir (Oficial §9; ADR-008).
- Medir indexação, abertura e salvamento com fixture definida; metas em Q-07 (ESPECIFICACAO_V1 §9, ESPECIFICADO).
- Estrutura de limites L-C, verificação de espaço livre e contagem real de bytes (D-013, FORMALIZADO). Valores e ZIP64 pendentes (VAULT_CONTRACT §7.5).
- Junções e pontos de reparo bloqueiam a exportação; a detecção por plataforma precisa de teste (VAULT_CONTRACT §7.6).

### 3.2 Pendente e por que bloqueia

Sem plataforma-alvo, não há como definir limites de caminho, comportamento de links, compatibilidade ZIP64 com o extrator nativo nem o critério nativo AC-12. Sem fixture e protocolo de medição, os valores dos limites (AC-07) seriam arbitrários.

### 3.3 Alternativas e recomendação

**Plataforma da V0**

| Opção | Consequência |
| --- | --- |
| P-A: Windows 11 x64, NTFS | É o ambiente real disponível; permite medir e testar agora; macOS e Linux ficam explicitamente não comprovados |
| P-B: Windows e macOS desde a V0 | Exige equipamento ainda não disponível neste ambiente; duplica a prova nativa |
| P-C: três SOs | Maior custo; adia o gate V0 |

**RECOMENDAÇÃO: P-A**, registrando que outras plataformas exigirão repetir AC-09, AC-12, AC-13 e as medições.

**Fixtures** — RECOMENDAÇÃO de composição. Os volumes de F-2 e F-3 são parâmetros a aprovar, não limites:

| Fixture | Finalidade | Composição |
| --- | --- | --- |
| F-1 funcional | AC-01–AC-11, AC-14 | Poucas dezenas de arquivos: todos os tipos de registro, arquivados, CRLF/LF, Unicode e nomes que diferem só por caixa, anexos binários, um arquivo não canônico, um `.tmp_*` órfão, cache simulado; variantes com `.txn_*`, junção e symlink |
| F-2 referência | Medição e definição dos valores | Volume que represente o uso esperado da proprietária com margem de crescimento (**PENDENTE: a proprietária informa ou aprova uma estimativa**), com proporção realista de Markdown e anexos já comprimidos (PDF, imagem) |
| F-3 estresse | Limites e ZIP64 | Gerada no temporário: ao menos um caso acima de 65.535 entradas e um arquivo acima de 4 GiB, ou ZIP64 forçado pela biblioteca quando o tamanho real for inviável; ZIPs maliciosos de expansão e de cabeçalho falso |

**Método de medição** — RECOMENDAÇÃO, protocolo MP:

1. Registrar SO, build, CPU, RAM, sistema de arquivos, runtime, versão da biblioteca, fixture (contagem, bytes, hash do conjunto) e estado (antivírus ativo, energia na tomada).
2. Tempo: `process.hrtime.bigint()` por fase (inventário, coleta, ZIP, verificação, extração, validação, reindexação).
3. Memória: `process.resourceUsage().maxRSS` e amostras de `process.memoryUsage()`. No app nativo, pico do processo por ferramenta do SO, com método registrado.
4. Disco: `fs.statfs` antes e depois; soma de bytes incluídos; tamanho do ZIP; espaço temporário máximo.
5. Volume: arquivos, bytes, maior arquivo, maior caminho relativo e profundidade, razão de compressão por entrada.
6. Pelo menos 5 execuções por cenário, com mediana e máximo; separar primeira execução (cache frio) das seguintes; nunca relatar média sem a dispersão.

**Categorias de limites** (já FORMALIZADAS em D-013): entradas, tamanho por arquivo, total descompactado, razão de compressão por entrada, comprimento e profundidade de caminho; mais espaço livre e bytes reais. **RECOMENDAÇÃO:** acrescentar como categoria explícita o **comprimento do caminho absoluto no destino**. O Windows limita a 260 caracteres sem suporte a caminhos longos; este equipamento tem o recurso habilitado, mas outro pode não ter, e a stack nativa precisa ser compatível.

**Critérios para fixar os valores**, após medição. RECOMENDAÇÃO: cada valor deve, ao mesmo tempo:

1. ser maior ou igual ao máximo observado em F-2 multiplicado por uma margem de crescimento escolhida pela proprietária;
2. permitir completar exportação e restauração dentro de um teto de memória e tempo aprovado para o hardware de P-A, medido com F-3;
3. no caso da razão de compressão, ficar acima da maior razão observada em dados legítimos de F-2 e abaixo da razão dos ZIPs maliciosos de F-3;
4. no caso de caminhos, garantir que o caminho absoluto restaurado caiba no limite da plataforma, considerando um caminho de destino típico.

Valores que não satisfaçam os quatro critérios voltam para decisão. Nenhum valor é proposto agora.

**ZIP64**

| Opção | Consequência |
| --- | --- |
| Z-A: recusar | Força limites abaixo de 4 GiB e de 65.535 entradas; mais simples |
| Z-B: somente quando necessário; aceitar dentro dos limites | Sem teto artificial; exige teste com ZIP64 forçado e conferência do extrator nativo do Windows |

**RECOMENDAÇÃO: Z-B, decidível agora.** A escolha não depende dos valores numéricos, só da compatibilidade, que AC-13 verifica. Se os limites medidos ficarem abaixo dos tetos clássicos, o ZIP64 simplesmente não será gerado. Se AC-13 mostrar incompatibilidade inaceitável com o Explorador do Windows, reabrir a escolha.

**Links e pontos de reparo**

- Junção: testável agora neste equipamento.
- Symlink de arquivo e de diretório: exige elevação ou Modo de Desenvolvedor, que são configurações do sistema e devem ser alteradas pela proprietária, não pelo agente.
- Outros pontos de reparo: o Node não expõe a tag de reparo. **RECOMENDAÇÃO:** na PoC Node, documentar a limitação e testar junção e symlink; a detecção completa (atributo de ponto de reparo) fica como requisito do backend nativo em AC-09 nativo.

### 3.4 Decidir agora × medir ou prototipar

- **Agora:** P-A, composição de F-1/F-2/F-3, protocolo MP, categorias de limites (incluindo caminho absoluto), critérios de fixação, Z-B, estratégia de teste de links.
- **Depois da medição:** volume de F-2 (exige a estimativa da proprietária), margens e valores numéricos.
- **Depois da prova nativa:** AC-12, AC-09 nativo e pico de memória do app.

### 3.5 Testes que comprovam a decisão

TC-21 com o protocolo MP; AC-07 com os valores aprovados; AC-13 (ZIP64 forçado, gerado e lido, e extração pelo Explorador do Windows registrada); AC-09 com junção agora e com symlink após habilitar privilégios; AC-09 nativo para pontos de reparo; AC-12 no app nativo.

## 4. Q-10 — Configuração portátil e anexos

### 4.1 Já decidido

- Markdown com YAML é a fonte de verdade; índices e caches são reconstruíveis (Oficial §3.1; D-011).
- Pastas canônicas de registros: `groups`, `tags`, `items`, `tasks`, `notes/work|reading|permanent`, `inbox` (DATA_MODEL §2).
- O backup inclui registros e anexos (Oficial §6; D-007).
- Anexos são bytes opacos no backup; a política de anexos é da Q-10 (D-013).
- Conteúdo não canônico é inventariado, com decisão explícita (D-013, E-C).
- `settings.yml` e `assets/` são apenas PROPOSTOS (DATA_MODEL §2 e §10; Q-10).

### 4.2 Pendente e por que bloqueia

Enquanto `assets/` não for canônico, todo backup com anexos cai no inventário E-C e exige decisão manual. Isso torna o fluxo repetitivo e permite excluir anexos por engano, quebrando links. Sem a separação entre configuração portátil e configuração do dispositivo, não se sabe o que deve entrar no backup.

### 4.3 Alternativas e recomendação

**Conjunto canônico**

| Opção | Consequência |
| --- | --- |
| C-1: só as pastas de registros | `assets/` e `settings.yml` sempre como não canônicos; mais atrito e risco de exclusão acidental de anexos |
| C-2: registros, `assets/` (qualquer arquivo regular abaixo dele) e `settings.yml` | Anexos preservados por padrão; configuração portátil acompanha o vault |
| C-3: C-2 mais uma pasta oculta de metadados do aplicativo dentro do vault | Abre espaço para estado do app no vault, o que conflita com caches fora da fonte canônica e exige novas regras |

**RECOMENDAÇÃO: C-2.** Arquivos `.md` dentro das pastas de registros que não sigam `{UUID}.md`, ou que não validem, **não** são registros canônicos: vão para o inventário, nunca são incluídos em silêncio como registros.

**Configuração portátil × dispositivo.** RECOMENDAÇÃO:

| Categoria | Local | No backup | Exemplos |
| --- | --- | --- | --- |
| Portátil do vault | `settings.yml` na raiz | Sim | Versão do formato de configuração; preferências que descrevem os dados e devem acompanhar o vault (**lista de chaves PENDENTE**, aprovada chave a chave) |
| Do dispositivo | Diretório de dados do aplicativo, fora do vault | Não | Localização do vault ativo, vaults recentes, tema Light/Dark (RECOMENDAÇÃO: dispositivo), tamanho de janela, estado da UI, caches e índices, diário de restauração (§6) |

Caches e índices: **RECOMENDAÇÃO** mantê-los fora do vault. Assim não há pasta de cache a excluir, e D-011 fica mais simples de cumprir. Hoje nenhum caminho de cache dentro do vault está definido, o que é uma lacuna documental.

**Anexos.** RECOMENDAÇÃO: preservar integralmente todo arquivo regular sob `assets/`, de qualquer formato, como bytes opacos. Restrições futuras de formato ou tamanho valem na **entrada** do anexo, não no backup; o backup só aplica os limites L-C. Arquivo referenciado por nota mas fora de `assets/` aparece no inventário como não canônico.

**Inventário sem omissões.** RECOMENDAÇÃO de algoritmo:

1. Percorrer o vault inteiro com `lstat`, sem seguir links.
2. Classificar cada entrada em uma das classes:
   - registro canônico;
   - anexo canônico;
   - `settings.yml`;
   - temporário `.tmp_*`, excluído e listado;
   - transação `.txn_*`, que bloqueia;
   - link ou ponto de reparo, que bloqueia;
   - nome não representável em UTF-8, que bloqueia;
   - não canônico.
3. Mostrar a classe "não canônico" com caminho, tamanho e motivo.
4. Agrupar arquivos de sistema conhecidos (`Thumbs.db`, `desktop.ini`, `.DS_Store`) com uma escolha única, ainda explícita.
5. Listar diretórios vazios, sem incluí-los: o manifesto só lista arquivos.
6. Conferir que a soma das classes é igual ao total percorrido; divergência aborta.

**Mudanças documentais para formalizar**, se aprovado e somente então:

- DATA_MODEL §2 e §10: promover `assets/` e `settings.yml` e definir a regra de anexos;
- VAULT_CONTRACT §7.2, item 6: substituir a pendência;
- OPEN_QUESTIONS, Q-10;
- ESPECIFICACAO_V1 F-07: preferências do dispositivo fora do backup;
- TEST_PLAN AC-01/AC-10: fixture com `assets/`, `settings.yml` e arquivos de sistema;
- `docs/examples`: anexo de exemplo, se desejado.

### 4.4 Decidir agora × medir ou prototipar

- **Agora:** C-2, separação portátil × dispositivo, tema no dispositivo, caches fora do vault, anexos opacos em `assets/`, algoritmo de inventário.
- **Depois:** a lista concreta de chaves de `settings.yml` (pode começar vazia, só com a versão) e a política de entrada de anexos.

### 4.5 Testes

AC-01 e AC-10 com C-2; teste unitário do classificador (todas as classes, soma igual ao total); teste de que preferências do dispositivo não aparecem no ZIP; restauração de anexos binários com bytes idênticos (AC-02).

## 5. Q-08 — Fluxo de restauração e experiência

### 5.1 Já decidido

- Restauração em pasta nova; disponibilizar só após verificar todos os arquivos (Oficial §6, DECIDIDO).
- Restaurar abre a escolha de pasta nova e um resumo de verificação antes de ativar (UX §2, PROPOSTO na especificação de UX).
- Diagnóstico útil de arquivo inválido, permissão, colisão e espaço; a falha não altera o vault ativo (F-07, ESPECIFICADO).
- Cópia independente com relatório, sem substituir nem ativar automaticamente o vault atual; referência ausente só gera diagnóstico (D-013, FORMALIZADO).
- Estados vazio, carregando, salvo, erro e conflito; teclado; texto além de cor (Oficial §7; ESPECIFICACAO_V1 §9).
- Ao fechar com alterações: Salvar, Descartar com confirmação ou Cancelar (UX §4, PROPOSTO).

### 5.2 Pendente e por que bloqueia

Falta definir como o backup é apresentado, como o relatório é guardado e como se abre um vault restaurado. A PoC pode produzir o relatório como dado, mas a jornada de aceite (TC-23, TC-24, AC-12) depende dessas escolhas.

### 5.3 Etapas recomendadas — RECOMENDAÇÃO

1. **Escolher o arquivo de backup.**
2. **Pré-leitura sem extrair:** validar o diretório central e o manifesto e mostrar o resumo:
   - data `created_at`, `manifest_version`, `file_count` e tamanho total;
   - contagem por tipo (registros por pasta, anexos, configuração).

   Uma falha aqui já encerra o fluxo com o motivo.
3. **Escolher o destino:** pasta pai mais nome novo; o aplicativo cria a pasta (§6.3). Validar antes de continuar:
   - não está dentro do vault ativo nem o contém;
   - comparação de caminhos sem diferenciar caixa no Windows, com links e junções resolvidos;
   - permissão de escrita e espaço livre.
4. **Confirmar:** "Restaurar N arquivos (X bytes) em <destino>. O vault atual não será alterado."
5. **Progresso cancelável:** cancelar equivale a restauração interrompida (§6).
6. **Verificação:** hashes, contagem, registros, relações e índices.
7. **Relatório**, com um dos estados:
   - **Verificado**;
   - **Verificado com avisos**;
   - **Falhou**;
   - **Interrompido**.
8. **Ações finais:**
   - "Abrir vault restaurado", apenas nos estados verificados e com confirmação;
   - "Mostrar pasta";
   - "Salvar relatório";
   - "Fechar".

Exportação, simétrica: inventário E-C (incluir, excluir ou cancelar; arquivos de sistema agrupados), confirmação, progresso, relatório de exportação.

### 5.4 Relatório de verificação — RECOMENDAÇÃO

- Identificação do backup: nome do arquivo, tamanho, SHA-256 do ZIP, `manifest_version`, `created_at`.
- Destino, início e fim, versão do aplicativo e estado final.
- Contagens: esperadas, extraídas, hash conferido, registros válidos, índices reconstruídos.
- Erros bloqueantes: caminho, causa e etapa.
- Avisos: referências ausentes (registro de origem, campo, UUID ausente) e outros não bloqueantes.
- Frase explícita: "O vault ativo não foi alterado."
- Privacidade: caminhos, UUIDs e títulos quando necessários; **sem conteúdo de corpo** (ESPECIFICACAO_V1 §9, Observabilidade).
- Persistência: exibido na tela, com "Salvar relatório" para um local escolhido **fora** do vault restaurado. Gravar automaticamente dentro do destino o tornaria conteúdo não canônico no próximo backup.

### 5.5 Avisos, abertura e prevenção de substituição

- Referência ausente: estado "Verificado com avisos"; permite abrir; nenhuma correção ou exclusão automática.
- Abrir o vault restaurado: ação separada, com confirmação que nomeia os dois vaults.
  - Antes, aplicar ao vault atual o fluxo de alterações pendentes (Salvar, Descartar ou Cancelar).
  - O vault atual é fechado, não alterado nem apagado.
  - A lista de vaults recentes, que é configuração do dispositivo, só muda após a abertura bem-sucedida.
- Nunca oferecer "restaurar sobre o vault atual" nem mesclar.
- Destino inválido (existe, não está vazio, está dentro ou acima do vault ativo, sem permissão ou sem espaço): recusa **antes** de qualquer escrita, com mensagem específica e opção de escolher outro.
- Restauração malsucedida: estado "Falhou" ou "Interrompido", sem ação "Abrir"; tratamento conforme a decisão Q-04 (§6.3).

### 5.6 Decidir agora × prototipar

- **Agora:** etapas 1–8, estados do relatório, conteúdo e privacidade do relatório, regra de não abrir automaticamente, criação do destino pelo aplicativo.
- **Por protótipo com a proprietária (Q-08, TC-23):** textos, agrupamento visual do inventário, ordem dos botões, atalhos e acessibilidade.

### 5.7 Testes

AC-08 (destino inválido, inclusive acima do vault ativo e via junção); AC-11; AC-02 (o relatório lista o que se espera); novo critério sugerido de que "Abrir" exige confirmação, aplica o fluxo de alterações pendentes e mantém os hashes do vault anterior; TC-23 e TC-24 com protótipo; AC-12 nativo.

## 6. Q-04 — Transações pendentes e falhas

### 6.1 Já decidido

- Escrita por temporário e rename, criação exclusiva e conflito que preserva as duas versões; nunca "salvo" falso (VAULT_CONTRACT §3, PROPOSTO; evidência parcial da PoC em IMPLEMENTATION_STATUS §7–§8).
- Transação da Inbox com manifesto e recuperação no arranque; temporários sem manifesto em quarentena, nunca apagados só pelo padrão de nome (VAULT_CONTRACT §4, PROPOSTO; requisito D-002 DECIDIDO).
- Estado transacional pendente resolvido antes do backup (Oficial §6, DECIDIDO); `.txn_*` bloqueia a exportação; órfãos não são apagados (D-013).
- C-A detecta a mudança e aborta; ZIP temporário fora do vault; nome final só após validação (D-013).
- A falha não altera o vault ativo (F-07).
- Na PoC, o adapter só remove um temporário que ele mesmo criou com abertura exclusiva (IMPLEMENTATION_STATUS §8).

### 6.2 Pendente e por que bloqueia

A Q-04 deixa aberta a política para quando a recuperação completa não é possível, e D-013 deixou aberto o destino de uma restauração que falhou. Sem isso, a PoC teria de inventar a limpeza, que é uma decisão de integridade e de privacidade.

### 6.3 Comportamento esperado — RECOMENDAÇÃO

| Situação | Comportamento proposto |
| --- | --- |
| Transação pendente ao exportar | Bloquear (DECIDIDO). O diagnóstico mostra `capture_id` e o estágio e oferece "Executar recuperação" (o procedimento já descrito no §4). Após uma recuperação bem-sucedida, refazer o inventário. Se a recuperação não completar, a exportação continua bloqueada. Nunca cancelar a transação automaticamente nem incluir `.txn_*` no ZIP |
| Escrita concorrente durante a exportação | Abortar (C-A). Repetir só por ação do usuário. Durante a coleta, editores do aplicativo ficam somente leitura, com o motivo indicado |
| Falha no meio da exportação | O vault nunca é tocado. O ZIP temporário, criado com abertura exclusiva fora do vault, é removido pelo aplicativo somente se ele o criou (mesma regra do adapter da PoC), porque contém dados pessoais. Se a remoção falhar, o caminho é informado |
| Restauração interrompida (cancelamento, falha, encerramento do processo) | A restauração mantém um **diário fora do vault**, no diretório de dados do aplicativo, com destino, hash do ZIP e lista de arquivos criados. No reinício, um diário incompleto marca o destino como "não verificado" e oferece as opções abaixo. O destino nunca é tratado como vault válido |

**Destino de uma restauração que falhou**

| Opção | Integridade | Privacidade | Recuperação | Risco fora da pasta autorizada |
| --- | --- | --- | --- | --- |
| F-1: preservar para diagnóstico | Nada é apagado | Cópia parcial de dados pessoais fica no disco | Permite inspecionar | Nenhum, mas a cópia parcial pode ser aberta por engano como vault |
| F-2: remover automaticamente | Pode apagar evidência útil | Melhor | Perde o diagnóstico | Uma remoção com lógica de caminho errada é o maior risco |
| F-3: escolha explícita | Preserva até haver decisão | A escolha é da pessoa | Ambos | Controlado, se a remoção se limitar ao diário |

**RECOMENDAÇÃO: F-3**, sem remoção automática. As opções são "Remover cópia incompleta" e "Manter para diagnóstico".

- A remoção só apaga entradas registradas no diário como criadas por esta restauração. Cada uma é verificada por `lstat` sem seguir links, deve ser arquivo regular dentro do destino e não pode ser link.
- Depois disso, remove a pasta apenas se ela tiver sido criada pelo aplicativo e estiver vazia. Nunca usa remoção recursiva de conteúdo desconhecido.
- Arquivo não registrado no diário é listado e preservado.
- Ao abrir uma pasta marcada no diário como não verificada, o aplicativo avisa.

**Conflitos com regras vigentes:**

- Nenhuma das recomendações acima altera transações ou D-007.
- A alternativa "backup de emergência incluindo `.txn_*`" **conflita** com D-007 (estado pendente deve ser resolvido antes do backup consistente). Por isso **não é recomendada**; adotá-la exigiria mudar a decisão.
- A remoção do ZIP temporário próprio e da cópia incompleta não contraria a regra de não apagar registros: são artefatos criados pela própria operação, fora do vault ativo, e não referências do vault.

### 6.4 Decidir agora × provar

- **Agora:** todas as linhas da tabela de §6.3 e F-3.
- **Por prova:** o comportamento do diário diante de encerramento do processo e a remoção restrita, ambos em teste.

### 6.5 Testes — novos critérios sugeridos (PLANEJADOS)

| ID sugerido | Verificação |
| --- | --- |
| AC-15 | Restauração interrompida de forma determinística após k arquivos (injeção no adapter): o diário existe; no "reinício" (nova instância), o destino aparece como não verificado e a ação "Abrir" não é oferecida |
| AC-16 | "Remover cópia incompleta": inspeção como no AC-06 mostra que só as entradas do diário foram removidas; um arquivo estranho colocado no destino e um sentinela fora dele permanecem com o mesmo hash |
| AC-17 | "Manter para diagnóstico": nenhum arquivo do destino é alterado; o relatório informa o estado |
| AC-03 estendido | Após "Executar recuperação" bem-sucedida, a exportação prossegue; após recuperação incompleta, continua bloqueada |
| AC-05 estendido | Após a falha, o ZIP temporário próprio é removido; um arquivo alheio com o mesmo nome criado antes da operação é preservado |

## 7. Tabela única de decisões

Responda cada linha com a opção escolhida (ou "ajustar: …"). "Agora" indica que a decisão não depende de medição.

| ID | Questão | Opções | Recomendação | Quando |
| --- | --- | --- | --- | --- |
| DQ-01 | Plataforma-alvo da V0 (Q-07) | P-A Windows 11 x64/NTFS · P-B Windows+macOS · P-C três SOs | **P-A** | Agora |
| DQ-02 | Composição das fixtures (Q-07) | Aprovar F-1/F-2/F-3 · ajustar | **Aprovar** | Agora |
| DQ-03 | Volume de referência de F-2 (Q-07) | Estimativa da proprietária (registros, anexos, GiB, horizonte de crescimento) | **Informar uma estimativa** | Agora (dado da proprietária) |
| DQ-04 | Protocolo de medição MP (Q-07) | Aprovar · ajustar | **Aprovar** | Agora |
| DQ-05 | Critérios para fixar os valores dos limites (Q-07) | Os quatro critérios de §3.3 · outro | **Os quatro critérios**; margem escolhida após medir | Regra agora; valores após medição |
| DQ-06 | Comprimento do caminho absoluto no destino como categoria de limite | Incluir · não incluir | **Incluir** | Agora |
| DQ-07 | ZIP64 | Z-A recusar · Z-B quando necessário | **Z-B** (reabrir se AC-13 falhar) | Agora |
| DQ-08 | Testes de symlink no Windows | Proprietária habilita Modo de Desenvolvedor · execução elevada manual · registrar como não executado | **Modo de Desenvolvedor ou execução elevada**, feita pela proprietária | Agora |
| DQ-09 | Outros pontos de reparo | Limitação documentada na PoC Node e detecção no backend nativo · bloquear a PoC até haver detecção nativa | **Limitação documentada; nativo em AC-09** | Agora |
| DQ-10 | Conjunto canônico (Q-10) | C-1 · C-2 · C-3 | **C-2** | Agora |
| DQ-11 | Configuração portátil × dispositivo (Q-10) | Separação de §4.3 · ajustar | **Separação de §4.3**; lista de chaves de `settings.yml` depois | Regra agora |
| DQ-12 | Tema Light/Dark (Q-10) | Dispositivo · vault | **Dispositivo** | Agora |
| DQ-13 | Caches e índices (Q-10/D-011) | Fora do vault · pasta reservada dentro do vault | **Fora do vault** | Agora |
| DQ-14 | Anexos em `assets/` (Q-10) | Todo arquivo regular, bytes opacos, sem restrição de formato no backup · restringir formatos | **Bytes opacos, sem restrição** | Agora |
| DQ-15 | Arquivos de sistema e diretórios vazios no inventário | Grupo com escolha única e diretórios vazios listados sem incluir · item a item | **Grupo; diretórios vazios listados** | Agora |
| DQ-16 | Etapas de restauração e exportação (Q-08) | Fluxo de §5.3 · ajustar | **Fluxo de §5.3**, detalhes visuais por protótipo | Regra agora; visual depois |
| DQ-17 | Relatório (Q-08) | Exibido e salvo opcionalmente fora do vault restaurado · gravado no destino | **Exibido e salvo opcionalmente fora** | Agora |
| DQ-18 | Abrir o vault restaurado (Q-08) | Ação separada com confirmação e fluxo de pendências · abrir automaticamente | **Ação separada com confirmação** | Agora |
| DQ-19 | Destino (Q-08) | O aplicativo cria a pasta nova (criação exclusiva) · aceitar pasta vazia existente | **O aplicativo cria** | Agora |
| DQ-20 | Transação pendente ao exportar (Q-04) | Bloquear e oferecer recuperação · backup de emergência (conflita com D-007) | **Bloquear e oferecer recuperação** | Agora |
| DQ-21 | Escrita concorrente (Q-04) | Abortar e repetir por ação do usuário · repetição automática | **Abortar; repetir pelo usuário** | Agora |
| DQ-22 | ZIP temporário após falha (Q-04) | Remover somente o próprio · preservar | **Remover somente o próprio** | Agora |
| DQ-23 | Restauração que falhou (Q-04) | F-1 preservar · F-2 remover automaticamente · F-3 escolha explícita | **F-3**, remoção limitada ao diário | Agora |
| DQ-24 | Diário de restauração | Fora do vault, nos dados do aplicativo · dentro do destino | **Fora do vault** | Agora |
| DQ-25 | Novos critérios AC-15–AC-17 e extensões de AC-03/AC-05 | Incluir no TEST_PLAN · não incluir | **Incluir**, como PLANEJADOS | Agora |

## 8. Preparação da implementação

### 8.1 Ordem recomendada, após aprovação

1. Registrar as decisões aprovadas nos documentos responsáveis (Q-04, Q-07, Q-08 e Q-10 em OPEN_QUESTIONS; DATA_MODEL §2 e §10 se C-2 for aprovado; VAULT_CONTRACT §7; TEST_PLAN), preservando D-013 e o histórico.
2. Com autorização, **reverificar** as versões e fontes oficiais de yauzl, yazl e dos tipos (ou da alternativa), conforme PROPOSTA_Q05_BACKUP §8. Instalar com versão exata, registrar URL, versão e hash e confirmar que a suíte de 37 testes continua passando.
3. Módulo de manifesto M-B: construir, analisar e validar, como função pura.
4. Classificador de inventário (§4.3), com C-2 se aprovado.
5. Exportação C-A com ponto de injeção, ZIP temporário fora do vault e publicação após validação.
6. Restauração: pré-validação, extração exclusiva, verificação, validação e relatório como dado.
7. Mecanismo de limites com valores **injetados pelo teste**: prova o mecanismo, não fixa contrato.
8. Diário e falhas (Q-04): AC-15 a AC-17 e as extensões de AC-03 e AC-05.
9. Medições com F-2 e F-3 (protocolo MP), proposta de valores, decisão da proprietária, AC-07 e AC-13.
10. Atualizar status, rastreabilidade e TEST_PLAN somente com resultados executados.
11. Mais tarde, a prova nativa (ADR-008): AC-09 nativo e AC-12.

### 8.2 O que é independente e o que espera decisão

| Parte da PoC | Pode começar após autorização e instalação | Espera |
| --- | --- | --- |
| Manifesto M-B, AC-01 parcial | Sim | — |
| Exportação C-A, AC-03–AC-05, AC-10, AC-11 | Sim | AC-10 final depende de C-2 (Q-10) |
| Restauração e validação, AC-02, AC-06, AC-08, AC-14 | Sim | — |
| Recusa de links (junção) | Sim | Symlink: DQ-08 |
| Mecanismo de limites | Sim, com valores de teste | Valores: Q-07 (DQ-03, DQ-05) |
| ZIP64, AC-13 | Mecanismo sim | Política: DQ-07; extrator nativo: P-A |
| Classificação de `assets/` e `settings.yml` | Não | Q-10 (DQ-10, DQ-11) |
| Diário e limpeza, AC-15–AC-17 | Não | Q-04 (DQ-23, DQ-24) |
| Fluxo e relatório na GUI, abertura do vault | Não | Q-08 e prova nativa |
| AC-12 | Não | Prova nativa (ADR-008) |

**Distinção obrigatória:** um critério documentado continua PLANEJADO; uma execução da PoC registra um resultado delimitado; nenhum TC-13–TC-15 recebe PASS completo sem todos os seus critérios, inclusive AC-12.

## 9. Revisão formal de estado das decisões (18/10/2026)

### 9.1 Autorização verificada

O histórico de instruções desta conversa contém escolhas explícitas da proprietária somente para:

- a correção da ordem de operação de D-003 (IMPLEMENTATION_STATUS §13);
- as diretrizes P-1 a P-8 da Q-05, formalizadas como D-013 (VAULT_CONTRACT §7).

**Nenhuma resposta às DQ-01 a DQ-25 foi dada.** A instrução da sessão de revisão pediu expressamente que recomendações não fossem tratadas como aprovações. Por isso **nenhuma DQ está aprovada**, e nenhum contrato, decisão, questão aberta ou plano de testes foi alterado por esta revisão. Onde uma DQ coincide com uma regra já vigente, a coincidência está indicada; ela não aprova a parte nova.

Estados usados: **pendente de confirmação** (decidível só com a resposta da proprietária, sem informação nova), **pendente de informação** (exige dado da proprietária), **pendente de medição**, **pendente de prova técnica**.

### 9.2 Matriz

| DQ | Questão | Recomendação da proposta | Dependências | Decidível sem informação nova? | Documento responsável pelo registro | AC/TC afetados | Estado |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DQ-01 | Q-07 | P-A: Windows 11 x64/NTFS | Base para DQ-07, DQ-08, DQ-09; ADR-008 continua candidata | Sim | OPEN_QUESTIONS Q-07; ARCHITECTURE_DECISIONS ADR-008 (registro do alvo da prova) | AC-09, AC-12, AC-13, TC-21 | Aceita (18/10/2026, bloco 1). Registro: TEST_PLAN §12.1; OPEN_QUESTIONS Q-07 (estado anterior: Pendente de confirmação) |
| DQ-02 | Q-07 | Aprovar F-1, F-2 e F-3 | DQ-03 para F-2 | Sim (a composição) | TEST_PLAN (fixtures); OPEN_QUESTIONS Q-07 | AC-01–AC-14, TC-21 | Aceita (18/10/2026, bloco 1). Registro: TEST_PLAN §12.2; fixtures não construídas (estado anterior: Pendente de confirmação) |
| DQ-03 | Q-07 | Estimativa de volume da proprietária | Nenhuma; bloqueia DQ-05, AC-07 e TC-21 | **Não** | TEST_PLAN (F-2); OPEN_QUESTIONS Q-07 | AC-07, TC-21 | Aceita (18/10/2026, bloco 2). Registro: VAULT_CONTRACT §7.5; TEST_PLAN §12.2 e §12.4; Q-07. Não implementada nem testada (estado anterior: Pendente de informação: quantidade aproximada de registros (por tipo, se possível), quantidade e volume de anexos, tamanho total estimado e horizonte de crescimento) |
| DQ-04 | Q-07 | Protocolo MP | DQ-01 | Sim | TEST_PLAN (procedimento de medição) | TC-21, AC-07 | Aceita (18/10/2026, bloco 1). Registro: TEST_PLAN §12.3; nenhuma medição realizada (estado anterior: Pendente de confirmação) |
| DQ-05 | Q-07 | Quatro critérios; margem escolhida após medir | DQ-03, DQ-04 e medição com F-2/F-3 | Sim para a regra; não para margem e valores | VAULT_CONTRACT §7.5 (valores); OPEN_QUESTIONS Q-07 | AC-07 | Aceita (18/10/2026, bloco 1) quanto aos critérios. Registro: VAULT_CONTRACT §7.5. Margem e valores: **pendente de medição** e de DQ-03 (estado anterior: Regra: pendente de confirmação · margem e valores: pendente de medição) |
| DQ-06 | Q-07 | Incluir o comprimento do caminho absoluto no destino como categoria de limite | DQ-01; **acrescenta categoria à lista formalizada em D-013 (VAULT_CONTRACT §7.5)**, o que exige emenda explícita | Sim | VAULT_CONTRACT §7.5; DECISIONS D-013 (nota de emenda) | AC-07 | Aceita (18/10/2026, bloco 1). Emenda a D-013 registrada em DECISIONS (“Emendas registradas”) e VAULT_CONTRACT §7.5; valor numérico pendente (estado anterior: Pendente de confirmação (emenda a D-013)) |
| DQ-07 | Q-05/Q-07 | Z-B | DQ-01; confirmação prática por AC-13, inclusive com o extrator nativo do Windows | Sim (a política); a compatibilidade exige prova | VAULT_CONTRACT §7.5 (pendência ZIP64); OPEN_QUESTIONS Q-05 | AC-13 | Aceita (18/10/2026, bloco 1): Z-B. Registro: VAULT_CONTRACT §7.5; AC-13 **pendente de prova técnica**; reabre se AC-13 falhar (estado anterior: Pendente de confirmação; se aprovada, sujeita a reabertura se AC-13 falhar) |
| DQ-08 | Q-07 | Proprietária habilita Modo de Desenvolvedor ou executa elevado | Ação no SO da proprietária; o agente não altera privilégios | Sim (a escolha); a execução depende da ação | TEST_PLAN (pré-condição de AC-09); IMPLEMENTATION_STATUS | AC-09 | Aceita (18/10/2026, bloco 1). Registro: TEST_PLAN §12.5. Execução de symlink depende de ação manual da proprietária; não executado (estado anterior: Pendente de confirmação e de ação da proprietária. Limitação atual: symlink de arquivo e de diretório falha com `EPERM` (sessão não elevada, sem Modo de Desenvolvedor); junção é criável) |
| DQ-09 | Q-07 | Limitação documentada na PoC Node; detecção nativa em AC-09 | Prova nativa (ADR-008) | Sim (a política) | VAULT_CONTRACT §7.6; TEST_PLAN AC-09 | AC-09 nativo, AC-12 | Aceita (18/10/2026, bloco 1). Registro: TEST_PLAN §12.5; detecção nativa **pendente de prova técnica** (estado anterior: Pendente de confirmação; a detecção depende de prova técnica) |
| DQ-10 | Q-10 | C-2: registros, `assets/` e `settings.yml` | **Exige alterar DATA_MODEL §2 e §10 e VAULT_CONTRACT §7.2 item 6**; não alterar antes da aprovação | Sim | DATA_MODEL §2 e §10; VAULT_CONTRACT §7.2; OPEN_QUESTIONS Q-10 | AC-01, AC-10 | Aceita (18/10/2026, bloco 2). Registro: D-014; DATA_MODEL §1 e §2.1; VAULT_CONTRACT §7.2 item 6. Não implementada nem testada (estado anterior: Pendente de confirmação) |
| DQ-11 | Q-10 | Separação portátil × dispositivo; chaves de `settings.yml` depois | DQ-10 | Sim para a regra; a lista de chaves exige decisão posterior | DATA_MODEL §2; OPEN_QUESTIONS Q-10; ESPECIFICACAO_V1 F-07 | AC-01, AC-02 | Aceita (18/10/2026, bloco 2). Registro: D-014 (V-1: versão derivada; `settings_version`); DATA_MODEL §1 e §2.1; F-07; UX §2; lista de chaves aberta (Q-10). Não implementada nem testada (estado anterior: Pendente de confirmação (regra) · lista de chaves: pendente de informação) |
| DQ-12 | Q-10 | Tema no dispositivo | DQ-11; ESPECIFICACAO_V1 F-07 não define o local | Sim | OPEN_QUESTIONS Q-10; ESPECIFICACAO_V1 F-07 | AC-01 (preferência fora do ZIP) | Aceita (18/10/2026, bloco 2). Registro: D-014; DATA_MODEL §2.1; F-07. Não implementada nem testada (estado anterior: Pendente de confirmação) |
| DQ-13 | Q-10/D-011 | Caches e índices fora do vault | Compatível com D-011 e D-013 §7.2 item 2 | Sim | DATA_MODEL §2; VAULT_CONTRACT §5 e §7.2 | AC-01 | Aceita (18/10/2026, bloco 2). Registro: D-014; emenda a D-013 (VAULT_CONTRACT §7.2 item 2). Não implementada nem testada (estado anterior: Pendente de confirmação) |
| DQ-14 | Q-10 | Todo arquivo regular em `assets/`, bytes opacos, sem restrição de formato no backup | “Bytes opacos” **já vigente** em D-013 (§7.3); a parte nova (“todo `assets/` canônico”) depende de DQ-10 | Sim | VAULT_CONTRACT §7.3; DATA_MODEL §10 | AC-01, AC-02 | Aceita (18/10/2026, bloco 2). Registro: D-014; VAULT_CONTRACT §7.3; DATA_MODEL §10. Não implementada nem testada (estado anterior: Pendente de confirmação (parte nova)) |
| DQ-15 | Q-10 | Arquivos de sistema em grupo com escolha única; diretórios vazios listados sem incluir | E-C (D-013) exige decisão explícita; o agrupamento a mantém | Sim | VAULT_CONTRACT §7.2 | AC-01, AC-10 | Aceita (18/10/2026, bloco 2). Registro: VAULT_CONTRACT §7.2 item 5 e §7.7 item 3. Não implementada nem testada (estado anterior: Pendente de confirmação) |
| DQ-16 | Q-08 | Fluxo de §5.3; visual por protótipo | UX_SPECIFICATION; protótipo com a proprietária | Sim para as etapas; o visual exige protótipo | UX_SPECIFICATION §2–§4; OPEN_QUESTIONS Q-08 | TC-23, TC-24, AC-12 | Aceita (18/10/2026, bloco 2). Registro: VAULT_CONTRACT §7.7 item 2; UX §2; visual pendente de protótipo (Q-08). Não implementada nem testada (estado anterior: Pendente de confirmação · visual: pendente de protótipo/validação) |
| DQ-17 | Q-08 | Relatório exibido e salvo opcionalmente fora do vault restaurado | “Relatório de resultado” **já vigente** (D-013 §7.7.7); a forma de persistência é nova | Sim | VAULT_CONTRACT §7.7; UX_SPECIFICATION | AC-02, AC-11 | Aceita (18/10/2026, bloco 2). Registro: VAULT_CONTRACT §7.7 item 7. Não implementada nem testada (estado anterior: Pendente de confirmação) |
| DQ-18 | Q-08 | Abertura como ação separada com confirmação e fluxo de pendências | “Sem ativar automaticamente” **já vigente** (D-013 P-8); a confirmação e o fluxo são novos; UX §4 | Sim | UX_SPECIFICATION; VAULT_CONTRACT §7.7 item 8 | Critério sugerido em §5.7; AC-12 | Aceita (18/10/2026, bloco 2). Registro: VAULT_CONTRACT §7.7 item 8; UX §2; AC-18; depende do UX §4 (PROPOSTO). Não implementada nem testada (estado anterior: Pendente de confirmação) |
| DQ-19 | Q-08 | O aplicativo cria a pasta nova (criação exclusiva) | **Restringe D-013 §7.7 item 1**, que hoje aceita “pasta nova ou vazia”; a opção B mantém o texto vigente | Sim | VAULT_CONTRACT §7.7 (emenda); DECISIONS D-013 | AC-08, AC-16 | Aceita (18/10/2026, bloco 2). Registro: Emenda a D-013 (VAULT_CONTRACT §7.7 item 1); alcance de links em §7.6 (F.3, opção A); AC-08. Não implementada nem testada (estado anterior: Pendente de confirmação (emenda a D-013 se A)) |
| DQ-20 | Q-04 | Bloquear e oferecer recuperação | Bloqueio **já vigente** (D-007/D-013); “oferecer recuperação” depende do protocolo da Inbox (VAULT_CONTRACT §4, PROPOSTO, Q-02/Q-04), ainda não implementado | Sim | VAULT_CONTRACT §7.2; OPEN_QUESTIONS Q-04 | AC-03 estendido | Aceita (18/10/2026, bloco 2). Registro: VAULT_CONTRACT §7.2 item 3 (só a política); mecanismo da Inbox continua PROPOSTO. Não implementada nem testada (estado anterior: Pendente de confirmação (parte nova); execução depende de prova técnica da recuperação da Inbox) |
| DQ-21 | Q-04 | Abortar; repetir pelo usuário; editores somente leitura durante a coleta | Aborto **já vigente** (C-A); somente leitura é refinamento de UX (Q-08) | Sim | VAULT_CONTRACT §7.4; UX_SPECIFICATION | AC-04 | Aceita (18/10/2026, bloco 2). Registro: VAULT_CONTRACT §7.4 item 7; UX §2. Não implementada nem testada (estado anterior: Pendente de confirmação) |
| DQ-22 | Q-04 | Remover somente o ZIP temporário próprio | Mesma regra do adapter da PoC (IMPLEMENTATION_STATUS §8) | Sim | VAULT_CONTRACT §7.4; OPEN_QUESTIONS Q-04 | AC-05 estendido | Aceita (18/10/2026, bloco 2). Registro: VAULT_CONTRACT §7.4 item 8; extensão de AC-05. Não implementada nem testada (estado anterior: Pendente de confirmação; comportamento exige teste de falha) |
| DQ-23 | Q-04 | F-3, com remoção limitada ao diário | DQ-24; compatível com a recomendação de D-013 §7.7 item 8 | Sim | VAULT_CONTRACT §7.7 item 8; OPEN_QUESTIONS Q-04 | AC-15, AC-16, AC-17 | Aceita (18/10/2026, bloco 2). Registro: VAULT_CONTRACT §7.7 item 8; AC-15 a AC-17. Não implementada nem testada (estado anterior: Pendente de confirmação; exige testes de falha e recuperação) |
| DQ-24 | Q-04 | Diário fora do vault, nos dados do aplicativo | DQ-11 (dados do dispositivo) | Sim | VAULT_CONTRACT §7.7; OPEN_QUESTIONS Q-04/Q-10 | AC-15 | Aceita (18/10/2026, bloco 2). Registro: VAULT_CONTRACT §7.7 item 8 (diário e marcador mínimo, F.3 opção A). Não implementada nem testada (estado anterior: Pendente de confirmação) |
| DQ-25 | TEST_PLAN | Incluir AC-15–AC-17 e as extensões como PLANEJADOS | DQ-22, DQ-23, DQ-24 | Sim | TEST_PLAN §10 | AC-03, AC-05, AC-15–AC-17 | Aceita (18/10/2026, bloco 2). Registro: TEST_PLAN §10 (AC-15 a AC-19 e extensões de AC-03 e AC-05). Não implementada nem testada (estado anterior: Pendente de confirmação) |

Resumo na revisão anterior (antes do bloco 1; estado atual em §10): 0 aprovadas. 24 de 25 dependem de confirmação da proprietária (em DQ-05 e DQ-11, só a parte de regra), algumas com uma parte adicional que depende de medição, protótipo ou prova. Entre elas, DQ-06, DQ-10 e DQ-19 exigem emenda de texto formalizado se aprovadas. Pendentes de informação: DQ-03 (dado da proprietária) e a lista de chaves de DQ-11. A parte de margem e valores de DQ-05 depende de medição. Têm parte que depende de prova técnica: DQ-07 (AC-13), DQ-09, DQ-20, DQ-22 e DQ-23.

### 9.3 Mudanças previstas no TEST_PLAN (não aplicadas)

Aplicar somente após a aprovação de DQ-25 (e de DQ-22 a DQ-24, das quais os critérios dependem). Todos entram como **PLANEJADOS**:

1. Acrescentar em TEST_PLAN §10 as linhas AC-15, AC-16 e AC-17 com o texto de §6.5 desta proposta, fonte “Q-04 / DQ-23, DQ-24”.
2. Estender AC-03: após “Executar recuperação” bem-sucedida, a exportação prossegue; com recuperação incompleta, continua bloqueada. Fonte “D-007; DQ-20”; dependência explícita do protocolo da Inbox.
3. Estender AC-05: o ZIP temporário próprio é removido após a falha; um arquivo alheio de mesmo nome é preservado. Fonte “DQ-22”.
4. Acrescentar a AC-09 a pré-condição: symlinks no Windows exigem elevação ou Modo de Desenvolvedor, habilitados pela proprietária (DQ-08); sem isso, só a variante junção é executável.
5. Acrescentar o critério sugerido em §5.7 (“Abrir” exige confirmação e preserva os hashes do vault anterior) como AC-18, se DQ-18 for aprovada.
6. Registrar F-1/F-2/F-3 e o protocolo MP como pré-condições de AC-07, AC-13 e TC-21, se DQ-02 e DQ-04 forem aprovadas; F-2 só após DQ-03.
7. Atualizar a referência de TC-13–TC-15 aos novos critérios e manter a frase de que nenhum TC recebe PASS sem AC-12.

### 9.4 Conflitos e emendas registrados

Nenhuma contradição entre documentos vigentes foi encontrada. Três recomendações exigiriam **emendar** texto formalizado se aprovadas: DQ-06 (lista de limites em D-013 §7.5), DQ-19 opção A (destino em D-013 §7.7 item 1) e DQ-10 (DATA_MODEL §2/§10 e VAULT_CONTRACT §7.2). Essas alterações ficam suspensas até a resposta explícita. DQ-20 depende de um protocolo ainda PROPOSTO; aprová-la não aprova esse protocolo.

## 10. Registro do bloco 1 (18/10/2026)

**Autorização:** a proprietária aceitou as recomendações de DQ-01, DQ-02 e DQ-04 a DQ-09 e manteve DQ-03 pendente. A autorização cobre somente alterações documentais. Não autoriza código, dependências, mudanças no Windows nem aprovação de testes sem evidência.

| DQ | Escolha aceita | Registro formal |
| --- | --- | --- |
| DQ-01 | P-A: Windows 11 x64/NTFS como plataforma prioritária de validação, sem garantia de compatibilidade com outros sistemas | TEST_PLAN §12.1; OPEN_QUESTIONS Q-07 |
| DQ-02 | Famílias F-1, F-2 e F-3 com a composição de §3.3 | TEST_PLAN §12.2 |
| DQ-03 | **PENDENTE:** aguarda estimativa da proprietária (registros, anexos, tamanho total, horizonte de crescimento) | TEST_PLAN §12.2 |
| DQ-04 | Protocolo MP de §3.3 | TEST_PLAN §12.3 |
| DQ-05 | Quatro critérios de fixação; margem e valores após medição | VAULT_CONTRACT §7.5 |
| DQ-06 | Categoria “comprimento do caminho absoluto no destino” (emenda a D-013) | DECISIONS (“Emendas registradas”); VAULT_CONTRACT §7.5 |
| DQ-07 | Z-B; AC-13 pendente | VAULT_CONTRACT §7.5; ADR-006; OPEN_QUESTIONS Q-05 |
| DQ-08 | Teste de symlink depende de ação manual autorizada da proprietária (Modo de Desenvolvedor ou execução elevada) | TEST_PLAN §12.5 e AC-09 |
| DQ-09 | Limitação da PoC Node documentada; detecção completa no backend nativo; regra de bloqueio mantida | TEST_PLAN §12.5 e AC-09 |

Estado atual: 8 aceitas; DQ-03 pendente de informação; DQ-10 a DQ-25 pendentes de confirmação (bloco seguinte). Das mudanças de TEST_PLAN previstas em §9.3:

- **Item 4 (pré-condição de symlink em AC-09): aplicado.**
- **Item 6: aplicado em parte.** Fixtures e MP foram registrados em TEST_PLAN §12; AC-07 e AC-13 passaram a referenciá-los; TC-21 não foi alterado; F-2 aguarda DQ-03.
- **Itens 1, 2, 3, 5 e 7: não aplicados.** Dependem de DQ-18 e DQ-20 a DQ-25.

## 11. Registro do bloco 2 (18/10/2026)

**Autorização:** a proprietária aceitou as DQ-03 e DQ-10 a DQ-25, com os ajustes da análise. Também deu cinco respostas na revisão do plano:

- V-1 para a versão do schema;
- entradas e tamanhos como limites de capacidade;
- D-014;
- AC-19;
- streaming normativo.

E três respostas da seção F.3:

- marcador mínimo após o diário;
- `settings.yml` opcional;
- verificação de links limitada à pasta criada, com a pasta-pai resolvida.

A autorização cobre a edição documental de 13 arquivos e exclui código, dependências, lockfiles, ambiente e execução de testes.

| Tema | Registro formal |
| --- | --- |
| DQ-03 (F-2 progressivo, classes de limite) | VAULT_CONTRACT §7.5; TEST_PLAN §12.2 e §12.4; emenda em DECISIONS |
| DQ-10 a DQ-14 | D-014; DATA_MODEL §1, §2.1 e §10; VAULT_CONTRACT §7.2, §7.3 |
| DQ-15 | VAULT_CONTRACT §7.2 item 5; §7.7 item 3 |
| DQ-16 a DQ-19 | VAULT_CONTRACT §7.6 e §7.7; UX §2; emenda de destino em DECISIONS |
| DQ-20 a DQ-24 | VAULT_CONTRACT §7.2 item 3, §7.4 itens 7 e 8, §7.7 item 8 |
| DQ-25 e AC-19 | TEST_PLAN §10 |
| Streaming | VAULT_CONTRACT §7.4 |

Das mudanças previstas em §9.3, os itens 1, 2, 3 e 5 foram aplicados no bloco 2. O item 7 foi aplicado só em parte: a tabela de ligação do TEST_PLAN §10 foi atualizada, mas as linhas TC-13 e TC-14 do §2 continuaram com as referências antigas até a correção pós-auditoria de 18/10/2026 (A-05). TC-21 continua sem alteração de texto, mas passou a ser ligado ao AC-19. *Redação anterior: “os itens 1, 2, 3, 5 e 7 foram aplicados no bloco 2”.*

**Continuam abertos:** Q-01, Q-02, Q-04, Q-05, Q-07, Q-08 e Q-10, além da V0, com as partes decididas anotadas em OPEN_QUESTIONS. Nenhuma fixture foi construída e nenhum critério executado.
