# Contrato técnico do vault

**Estado:** PROPOSTO para a PoC V0.4, exceto as decisões de backup da Q-05, formalizadas em 18/10/2026 no §7 (com pendências marcadas). Este documento detalha como provar as decisões de produto; não descreve implementação existente.

## 1. Fronteiras

A camada de domínio valida entidades e invariantes. O adaptador de arquivos controla bytes, caminhos e permissões. O indexador lê arquivos canônicos e reconstrói mapas por UUID, tags e links. A UI só mostra sucesso após confirmação da persistência.

Não depender do navegador ou de um cache para recuperar dados. Acesso nativo e escopos de arquivos serão provados na stack candidata.

## 2. Leitura e round-trip D-006

1. Ler bytes e detectar o frontmatter delimitado no início.
2. Separar cabeçalho e corpo preservando o trecho original do corpo, inclusive terminadores de linha.
3. Validar YAML sem executar tipos customizados; rejeitar chaves duplicadas e estruturas inválidas com diagnóstico.
4. Validar versão, ID, pasta, enums e relações. Não sobrescrever arquivo inválido.
5. Em alteração apenas de metadados, serializar novo cabeçalho e anexar os bytes originais do corpo.
6. Comparar SHA-256 do corpo antes/depois na prova. Cobrir UTF-8, CRLF/LF, espaços finais, linhas vazias, fences e texto sem newline final.

A padronização LF vale para esta documentação; o futuro aplicativo não pode normalizar corpos de vault existentes durante alterações somente de YAML.

## 3. Escrita de um registro

- Validar dentro do diretório autorizado; impedir caminhos absolutos externos e travessia por `..` após resolução. Links relativos legítimos entre pastas são aceitos se resolvem dentro do vault.
- Ler hash/revisão antes de editar. Se o arquivo mudar externamente, apresentar conflito e preservar ambas as versões; não sobrescrever silenciosamente.
- Escrever temporário no mesmo sistema de arquivos, confirmar escrita e efetuar renomeação atômica quando suportada.
- Criação exige destino inexistente; edição exige correspondência com a revisão lida.
- Confirmar comportamento de flush, fsync, rename e exclusão em cada SO na PoC. Renomeação isolada não prova durabilidade contra queda de energia.
- Reindexar somente após commit; nunca mostrar “salvo” ao falhar permissão, falta de espaço ou rename.

## 4. Inbox: transação recuperável

O objetivo é consistência recuperável entre captura e resultados. Vários arquivos não têm commit atômico conjunto por simples rename.

### Manifesto proposto

```json
{
  "schema_version": 1,
  "capture_id": "88888888-8888-4888-8888-888888888888",
  "stage": "INIT",
  "primary_type": "project",
  "primary_id": "44444444-4444-4444-8444-444444444444",
  "outputs": [
    {
      "id": "44444444-4444-4444-8444-444444444444",
      "entity_type": "project",
      "file": "items/44444444-4444-4444-8444-444444444444.md",
      "tmp_file": "items/.tmp_44444444-4444-4444-8444-444444444444.md",
      "sha256": "<hash SHA-256 dos bytes esperados>"
    }
  ],
  "created_at": "2026-10-18T12:00:00.000Z"
}
```

O hash acima é um marcador explicativo, não um valor executável. O nome `.tmp_{id}.md` do exemplo segue a convenção anterior. Desde 18/10/2026 (A-09), os temporários seguem `.tmp-{UUID v4 aleatório}.md` ([DATA_MODEL §2](DATA_MODEL.md)), e o manifesto registra o caminho do temporário explicitamente. Esta seção continua PROPOSTA. `outputs` generaliza o manifesto REC de project/tasks para qualquer resultado permitido; precisa de aprovação técnica em Q-02. Caminhos são relativos à raiz do vault. Gerar IDs e conteúdos antes de persistir INIT, para que hashes sejam conhecidos.

| Etapa | Ação | Evidência esperada |
| --- | --- | --- |
| INIT | Registrar intenção, captura e outputs esperados | Manifesto persistido antes de resultados |
| TMP_WRITTEN | Gravar/verificar temporários | Hash de cada temporário coincide |
| FILES_RENAMED | Promover arquivos individualmente sem substituir destinos alheios | Todos os resultados finais conferidos |
| INBOX_UPDATED | Marcar captura processed, referências e data | Captura persistida com corpo original |
| Limpeza | Remover manifesto após verificar estado final | Reinício não cria duplicatas |

### Recuperação no arranque

1. Bloquear nova conversão da mesma captura enquanto houver transação pendente.
2. Validar manifesto, versão e todos os caminhos antes de tocar em arquivos.
3. Conferir estado real de temporários e finais; o estágio pode estar atrasado por falha.
4. Arquivo final só pertence à transação se ID, origem e hash esperado coincidirem. Mesmo UUID com conteúdo divergente é conflito, nunca autorização para substituir.
5. Completar operações seguras e idempotentes. Se dados necessários estiverem ausentes, manter captura pending e manifesto para diagnóstico; não inventar conteúdo nem apagar finais confirmados.
6. Após todos os resultados válidos, atualizar captura e remover manifesto.
7. Temporários sem manifesto ficam em quarentena/diagnóstico. Remoção exige comprovar que são órfãos e dispensáveis; não apagar por padrão de nome apenas.

A PoC deverá interromper cada gravação, inclusive entre renames e entre atualização da captura e limpeza. Reexecutar recuperação duas vezes e comparar arquivos/hash. Q-04 fecha política de retomada ou cancelamento quando recuperação completa não é possível.

## 5. Links e índices

- Canonical: `[Título](../permanent/UUID.md)`; o caminho depende da pasta da nota atual.
- Renomear título mantém caminho baseado em UUID. O texto visível de links existentes pode continuar antigo; não reescrever corpos apenas para atualizar rótulos.
- Indexar links reais do Markdown, ignorando exemplos em fences, código inline e URLs externas como relações locais.
- Resolver arquivos relativos e âncoras; diagnosticar alvo inexistente. Não abrir protocolos executáveis automaticamente.
- Recriar mapa por UUID, tags, contextos e links ao iniciar; invalidar cache após edições e mudanças externas.
- Títulos duplicados são permitidos com desambiguação no seletor. Aliases ajudam a localizar, não determinam o destino de um link canônico.
- Movimentação externa pode quebrar links por caminho. Detectar e oferecer reparo explícito; não prometer recuperação automática sem informação suficiente. Operação interna de mover deve atualizar links afetados com recuperação em caso de falha, a provar antes de oferecê-la.

## 6. Criação de nota permanente

Criar nova nota global com UUID próprio e link para a origem; não editar a origem automaticamente. A partir desse link o indexador encontra a relação inversa após reiniciar. Se a criação falhar, a origem permanece intacta. Gravação do novo corpo é edição de conteúdo, não round-trip de metadados.

## 7. Backup e restauração D-007

**Estado desta seção (18/10/2026):** decisões técnicas da Q-05 formalizadas pela proprietária a partir de [PROPOSTA_Q05_BACKUP](PROPOSTA_Q05_BACKUP.md) (registro D-013 em [DECISIONS](DECISIONS.md)). Pontos dependentes de Q-07, Q-08 e Q-10 continuam **PENDENTES** e estão marcados abaixo. Nada desta seção está implementado ou testado. Os requisitos de D-007 (documentação oficial §6) permanecem e prevalecem. **Emenda e complementos de 18/10/2026** (bloco 1 de [PROPOSTA_BLOQUEIOS_Q05](PROPOSTA_BLOQUEIOS_Q05.md), autorizado pela proprietária): DQ-06 acrescenta uma categoria de limite (§7.5, emenda a D-013); DQ-05 formaliza os critérios de fixação dos valores (§7.5); DQ-07 formaliza a política ZIP64 (§7.5). Os valores numéricos continuam PENDENTES. **Bloco 2 de 18/10/2026** (DQ-03, DQ-10 a DQ-25; emendas e complementos registrados em DECISIONS): emendas a §7.2 item 2, §7.5 e §7.7 item 1; complementos em §7.2 a §7.7; conteúdo canônico pela D-014. Nada disto está implementado ou testado.

| Rótulo | Uso nesta seção |
| --- | --- |
| DECIDIDO | Documentação oficial §6 / D-007, já existente |
| FORMALIZADO (Q-05) | Escolha da proprietária de 18/10/2026 |
| RECOMENDAÇÃO | Orientação técnica ainda não decidida |
| PENDENTE | Depende de outra questão ou de medição |

### 7.1 Manifesto — FORMALIZADO (Q-05, M-B)

```json
{
  "manifest_version": 1,
  "created_at": "2026-10-18T12:00:00.000Z",
  "file_count": 1,
  "files": [
    {
      "path": "items/44444444-4444-4444-8444-444444444444.md",
      "size": 512,
      "sha256": "<hash SHA-256 dos bytes do arquivo>"
    }
  ]
}
```

Os valores de hash, tamanho e data acima são ilustrativos, não executáveis.

- `manifest_version` identifica **somente o formato do manifesto**. Não é a versão do schema dos registros (`schema_version` em cada arquivo) nem a do aplicativo. Atende ao requisito “versão” de D-007.
- `created_at`: timestamp UTC ISO 8601 com sufixo `Z`.
- `file_count`: número de entradas em `files`; não conta `manifest.json`. A lista `files` não contém `manifest.json` (DECIDIDO).
- `files`: lista ordenada por `path`, com um objeto por arquivo incluído, contendo `path`, `size` (inteiro, em bytes) e `sha256` (hexadecimal minúsculo dos bytes exatos). Cada `path` aparece uma única vez; repetição invalida o manifesto.
- `path`: relativo à raiz do vault, separador `/`, sem `.` ou `..`, sem barra inicial e sem letra de unidade. O UTF-8 é preservado, sem normalização Unicode silenciosa.
- **RECOMENDAÇÃO:** ordenar por comparação de bytes UTF-8, para que a ordem seja determinística entre plataformas; recusar `manifest_version` desconhecido antes de extrair.
- O SHA-256 detecta alteração de conteúdo, mas não autentica o autor nem protege contra alteração conjunta de arquivo e manifesto. Assinatura e criptografia ficam fora do escopo.

### 7.2 Inclusões e exclusões — FORMALIZADO (Q-05, E-C)

1. Incluir os registros das pastas canônicas (§2 do [DATA_MODEL](DATA_MODEL.md)), **inclusive os registros arquivados**: arquivar não é excluir.
2. Excluir automaticamente somente os temporários de escrita, cujo nome é exatamente `.tmp-` + UUID v4 + `.md` (A-09; redação do bloco 2: “`.tmp_*`”). O ZIP temporário e o ZIP de destino ficam fora do vault (ESPECIFICACAO_V1 F-07; §7.4), e essa comparação usa os caminhos reais, como no §7.6 (A-04). Caches e índices do aplicativo ficam fora do vault (D-014), por isso nenhum caminho dentro do vault é excluído automaticamente como cache. Um cache de outra ferramenta dentro do vault é conteúdo não canônico e segue o item 5. *Emenda de 18/10/2026 (DQ-13); redação anterior: “Excluir caches e índices reconstruíveis (D-011), temporários `.tmp_*`, o ZIP temporário e o ZIP de destino. O destino fica fora do vault (ESPECIFICACAO_V1 F-07).”*
3. Um arquivo transacional pendente (`inbox/.txn_*.json`) **bloqueia** a exportação com diagnóstico. Isso decorre de D-007: o estado transacional pendente precisa ser resolvido antes (DECIDIDO).
   - **Política (DQ-20):** o diagnóstico mostra a captura e o estágio. O aplicativo só oferece executar a recuperação **quando o mecanismo estiver implementado e validado** (TC-10 a TC-12; A-08; redação anterior: “quando esse mecanismo existir”), e refaz o inventário depois de uma recuperação bem-sucedida. Se a recuperação não completar, a exportação continua bloqueada.
   - Nunca cancelar a transação automaticamente, nem incluir `.txn_*` no ZIP. Um “backup de emergência” com transação pendente não é permitido (D-007).
   - Esta regra **não** aprova o protocolo de recuperação do §4, que continua PROPOSTO (Q-02/Q-04) e não implementado.
   - **Na restauração:** uma entrada `inbox/.txn_*.json` no ZIP bloqueia a disponibilização, porque um backup válido nunca a contém (A-08).
4. Temporários órfãos não são incluídos nem apagados; aparecem no diagnóstico (§4, item 7).
5. O conteúdo não canônico encontrado no vault é inventariado e apresentado antes de gerar o ZIP, e exige uma decisão explícita: **incluir**, **excluir** ou **cancelar**. Nenhum arquivo relevante é omitido em silêncio; o relatório final lista o que foi incluído e o que foi excluído.
   - **Arquivos de sistema (DQ-15):** a lista fechada `Thumbs.db`, `desktop.ini` e `.DS_Store`, em qualquer lugar do vault (inclusive dentro de `assets/`), é apresentada como um grupo com uma única escolha explícita. A lista só muda por decisão registrada.
   - **Pastas vazias (DQ-15):** são listadas no inventário e não entram no ZIP, porque o manifesto lista apenas arquivos. As pastas canônicas são recriadas na restauração (§7.7). Pastas canônicas vazias não são listadas como pastas vazias nem como conteúdo não canônico (A-14).
6. **Conjunto canônico (D-014, 18/10/2026):**
   - entram sem inventário os registros válidos das pastas canônicas, os arquivos regulares sob `assets/` e o `settings.yml`, quando existir (opcional);
   - configurações do dispositivo, caches e índices ficam fora do vault e do backup ([DATA_MODEL §2.1](DATA_MODEL.md)).

   *Redação anterior, preservada: “**PENDENTE (Q-10):** se `settings.yml` e `assets/` são canônicos e quais configurações são portáteis (entram) ou do dispositivo (ficam fora). Enquanto a Q-10 não fechar, esses caminhos são tratados como conteúdo não canônico, pelo item 5.”*
7. **Validação simétrica na exportação — FORMALIZADO em 18/10/2026 (A-01).** Antes de publicar, a exportação aplica ao conteúdo que vai incluir as mesmas verificações de estrutura e segurança da restauração (§7.7 itens 2, 4 e 5). Assim, nunca publica como concluído um backup que a restauração recusaria.
   - **Registros inválidos e versões não suportadas** ([DATA_MODEL §2.1](DATA_MODEL.md); A-10) bloqueiam a exportação, com diagnóstico de caminho e categoria, até serem corrigidos. O inventário não oferece incluí-los.
   - **`settings.yml`:** quando presente, precisa ter YAML válido e `settings_version` suportado; caso contrário, bloqueia. A ausência não bloqueia.
   - **Nomes:** caminhos que a restauração recusaria bloqueiam a exportação: duplicatas por caixa ou forma Unicode, nomes não representáveis em UTF-8, caminho relativo acima dos limites de segurança de comprimento e profundidade. Desde 18/10/2026 (D-015), também bloqueiam os caracteres U+0001–U+001F; os valores estão no §7.5.
   - **Razão de compressão:** uma entrada cuja compressão excederia o limite de segurança é gravada sem compressão (método store). O backup continua restaurável e o conteúdo legítimo não é bloqueado.
   - **Verificações que só existem na restauração, e por quê:**
     - espaço livre e comprimento do caminho absoluto no destino dependem da pasta escolhida na restauração; são limites de capacidade, que terminam em falha controlada com diagnóstico sem tornar o backup inválido;
     - a integridade do ZIP recebido (hash, tamanho, diretório central) é reverificada, porque o arquivo pode ter sido alterado depois da exportação; a exportação garante o ponto de partida pelo §7.4 item 5.
   - O conteúdo não canônico incluído por escolha é copiado como bytes e não é validado como registro, nem na exportação nem na restauração.
8. **Nome reservado `manifest.json` — FORMALIZADO em 18/10/2026 (pendência A do incremento 1).**
   - Na **raiz** do vault, o nome `manifest.json` é reservado para o manifesto interno do backup (§7.1). Um arquivo com esse nome na raiz **bloqueia** a exportação (categoria estrutura, código `reserved-name`), porque colidiria com a entrada `manifest.json` do ZIP.
   - A comparação segue a mesma regra de nomes do item 7: sem diferenciar maiúsculas e minúsculas e com forma Unicode NFC. Assim, `Manifest.JSON` também bloqueia.
   - O arquivo da pessoa nunca é excluído, renomeado nem sobrescrito; o diagnóstico pede que ela o mova ou renomeie.
   - A regra vale só para a raiz. `manifest.json` em qualquer subpasta segue a classificação normal: anexo, se estiver em `assets/`; não canônico, nas demais pastas.

### 7.3 Anexos — FORMALIZADO (Q-05)

Anexos são bytes opacos: o backup copia, calcula hash e tamanho e restaura sem converter nem interpretar o formato. A política de formatos, tamanhos e localização dos anexos pertence à Q-10 e não é aplicada silenciosamente pelo backup. Desde 18/10/2026 (DQ-14, D-014), todo arquivo regular sob `assets/`, em qualquer subpasta, é preservado assim. Isso não aprova estrutura de pastas nem convenção de nomes. Links e pontos de reparo dentro de `assets/` continuam bloqueando a exportação (§7.6).

### 7.4 Consistência da exportação — FORMALIZADO (Q-05, C-A)

1. Pausar as escritas internas do aplicativo durante a coleta.
2. Para cada arquivo incluído, ler os bytes e calcular SHA-256 e tamanho.
3. Construir o ZIP temporário **fora do vault**.
4. Após a coleta, varrer o vault de novo, sem seguir links, e comparar com o inventário inicial (A-07):
   - (a) qualquer caminho novo, removido ou com tipo diferente, em qualquer lugar do vault, aborta;
   - (b) nos arquivos incluídos, tamanho ou SHA-256 diferentes abortam;
   - (c) arquivos excluídos por escolha são comparados só quanto a presença e tipo.

   O aborto vem com diagnóstico. *Redação anterior: “verificar novamente cada arquivo de origem: tipo (sem seguir links), tamanho e SHA-256. Divergência, arquivo novo ou removido no conjunto inventariado, ou mudança de tipo aborta a exportação com diagnóstico.”*
5. Reler o ZIP temporário e conferi-lo contra o manifesto, aplicando a ele a parte da pré-validação da restauração (§7.7 item 2) que não depende do destino (A-01).
6. Publicar o nome final somente após a validação. Antes disso, nenhum arquivo com o nome final existe e nada é apresentado como concluído.
7. **Escrita concorrente (DQ-21):** a divergência do item 4 aborta. A repetição acontece só por ação do usuário, sem repetição automática. Durante a coleta, os editores do aplicativo ficam somente leitura, com o motivo indicado. O diagnóstico identifica o caminho alterado e menciona que ferramentas de sincronização de pastas podem causar a alteração.
8. **ZIP temporário após falha ou cancelamento (DQ-22):** o aplicativo remove o ZIP temporário somente se ele mesmo o criou, com criação exclusiva, nesta operação. Nunca remove pelo nome ou padrão de nome. Um arquivo alheio com o mesmo nome é preservado. A falha da remoção é informada com o caminho. *RECOMENDAÇÃO técnica:* criar o temporário na mesma pasta do destino final (fora do vault), para que a publicação seja uma renomeação no mesmo volume.

**Limite declarado:** esta abordagem **detecta** alterações concorrentes durante a coleta, mas não garante, isoladamente, um snapshot atomicamente consistente. Um escritor externo pode alterar e restaurar um arquivo entre as duas leituras, e existe uma janela entre a segunda verificação e a publicação. Snapshot do SO (VSS, APFS) não foi adotado; reavaliar só com a Q-07.

**Processamento em streaming — FORMALIZADO em 18/10/2026 (DQ-03):**

- A leitura dos arquivos para hash e compactação na exportação (§7.4), a releitura do ZIP e a extração na restauração (§7.7) processam o conteúdo de cada arquivo em blocos, sem exigir que o arquivo inteiro esteja em memória.
- O consumo de memória pode depender do número de entradas e do tamanho dos metadados (manifesto, diretório central, inventário, diário). A validação de registros, na exportação (§7.2 item 7) e na restauração (§7.7 item 4), lê um registro por vez e pode exigir memória proporcional ao maior registro validado (A-15).
- **Não há garantia de memória constante** para todos os aspectos do vault.
- Verificação: AC-19 e TC-21 ([TEST_PLAN](TEST_PLAN.md)).
- **Estado (atualizado em 18/10/2026, depois do AC-19):**
  - implementado na PoC Node (`poc/src/backup/`, com `yazl` 3.3.1 e `yauzl` 3.4.0);
  - medido pelo AC-19 em um único equipamento ([TEST_PLAN §15](TEST_PLAN.md)). Na série (i), o pico de memória das fases de hash, compactação e extração não acompanhou o tamanho dos anexos, com a ressalva registrada no TEST_PLAN §15.4;
  - a medição descreve aquele ambiente; não é garantia para outros equipamentos, plataformas ou para o aplicativo nativo;
  - TC-21 não foi aprovado.

  *Estado anterior: “não implementado; nenhuma biblioteca foi validada contra este requisito.”*

### 7.5 Limites — estrutura FORMALIZADA (Q-05, L-C); valores DECIDIDOS em 18/10/2026 (D-015), exceto a razão de compressão

*Título anterior: “Limites — estrutura FORMALIZADA (Q-05, L-C); valores PENDENTES (Q-07)”.*

A restauração (e a exportação, quando aplicável) aplica limites de:

- número de entradas;
- tamanho por arquivo;
- tamanho total descompactado;
- razão de compressão por entrada;
- comprimento e profundidade de caminho;
- comprimento do caminho absoluto no destino, isto é, a pasta de destino escolhida mais o caminho relativo da entrada. É uma categoria distinta das anteriores, acrescentada por emenda de 18/10/2026 (DQ-06; registro em [DECISIONS](DECISIONS.md), “Emendas registradas”).

Também verifica o espaço livre do destino contra o total declarado e **conta os bytes efetivamente extraídos**, abortando quando eles excedem o tamanho declarado ou um limite, sem confiar apenas nos cabeçalhos. **Os valores numéricos não estão definidos.** *(Até 18/10/2026; desde então, ver “Valores decididos (D-015)” abaixo. A razão de compressão continua sem valor.)* Os de segurança dependem de critérios técnicos e de medição; os de capacidade são verificados contra o ambiente em execução (ver abaixo). Nenhum valor deve ser codificado como contrato antes da decisão correspondente.

**Classes de limite — FORMALIZADAS em 18/10/2026 (DQ-03/DQ-05; emenda a D-013):**

| Classe | Itens | Como se fixa | Ao ultrapassar |
| --- | --- | --- | --- |
| **Segurança da restauração** (obrigatória) | Razão de compressão por entrada; bytes reais acima do declarado; coerência entre manifesto, diretório central e contagem, incluindo tamanho do manifesto compatível com o número de entradas declarado e com o limite de caminho; travessia, caminho absoluto e letra de unidade; comprimento e profundidade do caminho relativo | Critérios técnicos e casos maliciosos de F-3, independentes do volume do vault | Recusa antes de disponibilizar |
| **Capacidade do ambiente** | Número de entradas; tamanho por arquivo; tamanho total descompactado; comprimento do caminho absoluto no destino; espaço livre; memória e tempo disponíveis | Verificação em execução contra o formato (ZIP clássico ou ZIP64 Z-B), o SO, o sistema de arquivos e os recursos disponíveis. **Sem teto derivado de F-2** | Falha controlada, com diagnóstico, e nenhum artefato incompleto apresentado como válido |

A classificação não autoriza ignorar limites reais do formato ZIP, do SO, do sistema de arquivos, do espaço disponível ou de outros recursos. O contrato não promete que todo vault possa ser processado em qualquer ambiente; ele proíbe rejeitar um vault legítimo por um teto arbitrário derivado de uma fixture.

**Critérios para fixar os valores — FORMALIZADOS em 18/10/2026 (DQ-05), emendados em 18/10/2026 (DQ-03):**

1. Os limites de segurança são fixados por critérios técnicos e pelos casos maliciosos de F-3, nunca por um múltiplo de F-2.
2. Os limites de capacidade são verificados contra o ambiente e o formato. As medições de F-3 descrevem a curva de capacidade (tempo, memória, disco) e não criam teto de tamanho. O processamento segue o requisito de streaming do §7.4. Metas de tempo e desempenho pertencem à Q-07, que continua aberta.
3. No caso da razão de compressão, ficar acima da maior razão observada em dados legítimos, incluindo amostras sintéticas muito comprimíveis de F-2, e abaixo da razão dos ZIPs maliciosos de F-3, sempre combinada com a contagem de bytes reais.
4. No caso de caminhos, garantir que o caminho absoluto restaurado caiba no limite da plataforma, considerando um caminho de destino típico.

Valores que não satisfaçam os critérios voltam para decisão.

**Valores decididos (D-015, 18/10/2026)** — com base em [PROPOSTA_AC07_LIMITES](PROPOSTA_AC07_LIMITES.md), alternativa B de caminho. “Caracteres” são unidades UTF-16; “bytes” são bytes UTF-8.

| Classe | Item | Valor ou verificação |
| --- | --- | --- |
| Segurança | Bytes reais acima do declarado | Tolerância zero: os bytes extraídos de cada entrada são iguais ao tamanho declarado |
| Segurança | Coerência manifesto × diretório central × contagem | Igualdade exata. O tamanho declarado de `manifest.json` é conferido **antes** da leitura: ≤ 256 + N × (150 + 2 × 3.072) bytes, com N = entradas do diretório central − 1 |
| Segurança | Caracteres de controle | U+0000 a U+001F são recusados em qualquer segmento de caminho |
| Segurança | Comprimento do caminho relativo | ≤ 1.024 caracteres e ≤ 3.072 bytes |
| Segurança | Comprimento de cada segmento | ≤ 255 caracteres |
| Segurança | Profundidade do caminho relativo | ≤ 32 segmentos |
| Segurança | Travessia, caminho absoluto, letra de unidade | Recusa (regra existente) |
| Segurança | Razão de compressão por entrada | **PENDENTE:** sem valor. Depende de F-2.v1 com amostras muito comprimíveis e dos ZIPs maliciosos de F-3 (critério 3) |
| Capacidade | Entradas, tamanho por arquivo, total, memória, tempo | Sem teto; falha controlada quando houver impossibilidade real. Metas: Q-07 |
| Capacidade | Espaço livre | Restauração: ≥ total declarado. Exportação: ≥ Σ tamanhos + N × (100 + 2 × 3.072) + teto do manifesto |
| Capacidade | Caminho absoluto no destino | Verificado antes da confirmação contra o limite que a plataforma oferece de fato ao aplicativo: cerca de 32.767 caracteres com `LongPathsEnabled` = 1 **e** aplicativo `longPathAware`; caso contrário, 259 para arquivos e 247 para diretórios. Ao ultrapassar, falha controlada com diagnóstico |

Consequência aceita na D-015: com caminhos acima de 259 caracteres, o vault restaurado pode não abrir no Explorador do Windows nem em ferramentas sem suporte a caminhos longos. A forma de detectar esse suporte será definida e testada na implementação. **Nenhum destes valores está implementado.** *Atualização de 18/10/2026: implementados na PoC Node, exceto a razão de compressão, e exercitados pelo AC-07 ([TEST_PLAN §16](TEST_PLAN.md)). A PoC não detecta o suporte a caminhos longos: usa 259/247 por padrão e aceita um limite maior informado por quem chama.*

*Redação anterior dos critérios 1 a 3, preservada:*
- *“1. ser maior ou igual ao máximo observado em F-2 multiplicado por uma margem de crescimento escolhida pela proprietária;*
- *2. permitir completar exportação e restauração dentro de um teto de memória e tempo aprovado para o hardware da plataforma prioritária, medido com F-3;*
- *3. no caso da razão de compressão, ficar acima da maior razão observada em dados legítimos de F-2 e abaixo da razão dos ZIPs maliciosos de F-3”.*

| Elemento | Estado |
| --- | --- |
| Categorias e classes de limite | FORMALIZADAS (lista acima, emenda DQ-06 e classes DQ-03/DQ-05) |
| Critérios de fixação | FORMALIZADOS (DQ-05, emendados pela DQ-03) |
| Valores de segurança | **DECIDIDOS em 18/10/2026 (D-015)**, exceto a razão de compressão, que continua sem valor; implementados na PoC Node em 18/10/2026 ([TEST_PLAN §16](TEST_PLAN.md)), não no aplicativo nativo. *Estado intermediário: “não implementados”.* *Estado anterior: “Nenhum aprovado. Dependem de critérios técnicos, de F-3 e de medição pelo protocolo de TEST_PLAN §12. Proposta de valores registrada em 18/10/2026 em PROPOSTA_AC07_LIMITES: PROPOSTO, não aprovado, não substitui esta linha”* |
| Capacidade | Verificada em execução; não tem valor fixo a aprovar. Metas de desempenho: Q-07, aberta. Curvas de tempo, memória e disco de um equipamento: [TEST_PLAN §15](TEST_PLAN.md) |
| Testes de validação | AC-07: executado na PoC Node em 18/10/2026 com os valores da D-015, sem a razão de compressão ([TEST_PLAN §16](TEST_PLAN.md)); *estado intermediário: “PLANEJADO, não executado”*. AC-13 (ZIP64): PENDENTE, não executado. AC-19 (streaming): executado na PoC Node em 18/10/2026, com o critério da série (i) observado como atendido naquele equipamento, com ressalva ([TEST_PLAN §15](TEST_PLAN.md)); TC-21 não aprovado. *Estado anterior: “AC-07, AC-13 (ZIP64) e AC-19 (streaming), PLANEJADOS e não executados”* |

**RECOMENDAÇÃO de formato na restauração:** aceitar somente os métodos store (0) e deflate (8); recusar entradas criptografadas, arquivo multi-disco, diretório com dados e entradas não declaradas no manifesto.

**ZIP64 — FORMALIZADO em 18/10/2026: Z-B (DQ-07).** Até essa data, a política estava PENDENTE. Alternativas analisadas:

| Alternativa | Efeito | Risco |
| --- | --- | --- |
| Z-A: recusar ZIP64 | Backups limitados a menos de 4 GiB por arquivo e no total, e a menos de 65.535 entradas | Um vault maior não pode ser exportado; os limites precisam ficar abaixo desses tetos |
| Z-B: gerar ZIP64 somente quando necessário; aceitar na restauração dentro dos limites | Sem teto artificial; backups pequenos ficam no formato clássico | Alguns extratores do SO não leem ZIP64 (o README do yazl 3.3.1 cita o Arquivador do macOS); exige fixture com ZIP64 forçado no teste |
| Z-C: sempre ZIP64 | Formato uniforme | Pior portabilidade para extração manual, sem benefício para vaults pequenos |

**Decisão (DQ-07):** Z-B. Gerar ZIP64 somente quando o arquivo ou o volume exceder os limites do ZIP clássico e aceitá-lo na restauração dentro dos limites de §7.5. Se os valores aprovados ficarem abaixo dos tetos clássicos, o ZIP64 simplesmente não será gerado.

Condição de compatibilidade: verificar por AC-13 a gravação e leitura com ZIP64 forçado e a extração pelo extrator nativo do Windows 11 (plataforma prioritária, DQ-01). **AC-13 está PENDENTE.** Nem a biblioteca, nem o leitor, nem a extração pelo Explorador do Windows, nem o fluxo completo foram validados. Se AC-13 mostrar incompatibilidade inaceitável, a escolha é reaberta.

Recomendação anterior, preservada como histórico: “Z-B, com teste explícito de leitura e gravação com ZIP64 forçado e registro da compatibilidade com o extrator nativo da plataforma da Q-07. Se os limites numéricos da Q-07 ficarem abaixo dos tetos do ZIP clássico, Z-A torna-se equivalente e mais simples. A escolha fica com a proprietária após a Q-07.”

### 7.6 Links simbólicos e pontos de reparo — FORMALIZADO (Q-05, S-A)

- **Exportação:** um symlink, junção ou ponto de reparo encontrado no vault bloqueia a exportação com diagnóstico do caminho. O alvo nunca é lido nem seguido.
- **Restauração:** entradas cujo tipo nos atributos externos indique link (por exemplo `S_IFLNK`) são recusadas. O aplicativo nunca cria links, verifica cada componente do caminho de destino sem seguir links e extrai somente para arquivos regulares novos, dentro da pasta autorizada.
  - **Alcance, esclarecido em 18/10/2026 (resposta F.3, DQ-19):** “caminho de destino” é a pasta criada pelo aplicativo e todo o seu conteúdo, verificados sem seguir links. A pasta-pai escolhida pela pessoa é resolvida para o caminho real; links no caminho até ela não são recusados por si, mas o caminho real não pode se sobrepor ao vault ativo (nem dentro dele, nem contendo-o). O caminho do vault ativo também é resolvido para o caminho real. A comparação segue as regras do sistema de arquivos de destino; no Windows/NTFS, sem diferenciar maiúsculas e minúsculas (A-04). A detecção completa de todos os tipos de ponto de reparo continua dependendo da validação nativa (DQ-09).
- **Situação de plataforma:** a plataforma prioritária é Windows 11 x64/NTFS (DQ-01). A detecção de junção e symlink é testável na PoC Node. A detecção completa de outros pontos de reparo exige validação no backend nativo (DQ-09; [TEST_PLAN §12.5](TEST_PLAN.md)), que não existe. *Redação anterior: “**PENDENTE (Q-07):** a detecção de junções e pontos de reparo depende da plataforma e precisa de teste próprio no SO escolhido.”*

### 7.7 Restauração — FORMALIZADO (Q-05)

1. **Destino (emenda de 18/10/2026, DQ-19):** pasta nova **criada pelo aplicativo**, com criação exclusiva, dentro de uma pasta-pai escolhida pela pessoa. Uma pasta já existente, vazia ou não, não é aceita como destino. A pasta-pai e o vault ativo são resolvidos para seus caminhos reais, e a pasta-pai não pode se sobrepor ao vault ativo (§7.6; A-04). A pasta só é criada depois da pré-validação e da confirmação do item 2, e a criação é registrada antes no diário (item 8). Cancelar antes disso não deixa pasta criada (A-03). Nunca mesclar nem alterar o vault em uso. *Redação anterior: “Destino: pasta nova ou vazia, fora do vault ativo (DECIDIDO: pasta nova).”*
2. Antes de escrever qualquer arquivo, validar:
   - o manifesto: formato, versão, duplicatas e `file_count`;
   - o diretório central do ZIP;
   - os nomes, incluindo duplicatas que só diferem por caixa ou por forma Unicode;
   - caminhos absolutos, travessia e links;
   - métodos de compressão, limites e espaço livre. Os valores decididos estão no §7.5 (D-015); o tamanho do manifesto é conferido antes de lê-lo.

   **Ordem (DQ-16):** nada é escrito antes desta pré-validação e da confirmação da pessoa. A pré-leitura usa só o diretório central e o manifesto, sem extrair. Cancelar equivale a uma restauração interrompida (item 8).
3. Extrair com criação exclusiva, somente dentro do destino, conferindo o tamanho e o SHA-256 de cada arquivo. Recusar entradas extras, entradas ausentes e contagem divergente. A extração segue o requisito de streaming (§7.4). **As pastas canônicas (DATA_MODEL §2 e §2.1, incluindo `assets/`) são recriadas mesmo quando vazias (DQ-15).** Elas não vêm do ZIP e não contam como entradas extras.
4. Validar os registros (YAML, UUID único, pasta coerente com o tipo, regras de identidade e estrutura) e as relações; reconstruir os índices. Os registros validados são os arquivos `{UUID}.md` das pastas canônicas ([DATA_MODEL §2.1](DATA_MODEL.md)); os demais arquivos são restaurados como bytes. A versão do schema apresentada é derivada dos registros, e versões mistas são relatadas (D-014). A memória desta etapa pode depender do maior registro validado (§7.4).
5. **Bloqueiam** a disponibilização:
   - falha de integridade (hash, tamanho ou contagem);
   - caminho inseguro;
   - manifesto inválido;
   - YAML inválido;
   - UUID duplicado;
   - pasta incoerente com o tipo;
   - versão não suportada: versão de schema de registro não suportada, ou `settings_version` não suportado quando o `settings.yml` existe. É uma categoria própria, distinta de corrupção estrutural e de falha de integridade, sem migração automática, conversão silenciosa ou abertura parcial (A-10);
   - entrada `inbox/.txn_*.json` (§7.2 item 3);
   - qualquer outra inconsistência essencial de identidade ou estrutura.
6. **Não bloqueiam automaticamente:** referências ausentes (ID referenciado que não existe) geram diagnóstico no relatório, desde que não haja outra violação contratual. Isso é coerente com o DATA_MODEL §1.
7. Resultado: uma **cópia independente verificada** e um **relatório de resultado** (arquivos, hashes, diagnósticos). A restauração não substitui nem ativa automaticamente o vault atual. Em caso de falha, nada é declarado restaurado e o vault ativo permanece inalterado.
   - **Estados do relatório (DQ-16/DQ-17; definições de 18/10/2026, A-14):**
     - **Verificado:** todas as verificações passaram, sem avisos.
     - **Verificado com avisos:** nenhuma condição bloqueante e ao menos um diagnóstico não bloqueante.
     - **Falhou:** a operação terminou ao detectar uma condição bloqueante (integridade, estrutura, versão não suportada, segurança ou capacidade) ou um erro de E/S.
     - **Interrompido:** a operação terminou antes do fim, por cancelamento ou encerramento do processo, sem ter detectado condição bloqueante. O encerramento é detectado no reinício pelo diário incompleto.
   - **Conteúdo:**
     - identificação do backup (nome do arquivo, tamanho, SHA-256 do ZIP, `manifest_version`, `created_at`);
     - destino, início e fim, versão do aplicativo e estado final;
     - contagens esperadas, extraídas e conferidas;
     - erros bloqueantes, com caminho, categoria (integridade, estrutura, versão não suportada, segurança, capacidade), causa e etapa;
     - avisos, como referências ausentes;
     - a frase “O vault ativo não foi alterado.”

     Sem conteúdo do corpo das notas.
   - **Persistência:** o relatório é exibido, e “Salvar relatório” grava uma cópia somente em local escolhido **fora** da cópia restaurada e fora do vault ativo, com a mesma comparação por caminho real do §7.6 (A-14). Ele nunca é gravado automaticamente no destino.
8. **Abertura e falha — FORMALIZADO em 18/10/2026:**
   - **Abrir o vault restaurado (DQ-18):** é uma ação separada, oferecida só nos estados Verificado e Verificado com avisos, com confirmação que nomeia os dois vaults.
     - Antes, aplica-se ao vault atual o fluxo de fechamento com alterações pendentes ([UX §4](UX_SPECIFICATION.md), ainda PROPOSTO, dependência aberta da Q-08).
     - O vault atual é fechado, nunca alterado nem apagado.
     - A lista de vaults recentes, que é configuração do dispositivo (D-014), só muda após a abertura bem-sucedida.
   - **Diário de restauração (DQ-24):**
     - fica nos dados do aplicativo, fora do vault e do destino;
     - registra cada item antes de criá-lo: a própria pasta de destino, cada diretório e cada arquivo (A-02);
     - contém o caminho real do destino, o SHA-256 do ZIP, os caminhos relativos dos diretórios e arquivos criados (arquivos com seus hashes) e o estado, sem conteúdo de arquivos.
   - **Restauração que falhou ou foi interrompida (DQ-23):** o destino é tratado como **não verificado**, e “Abrir” não é oferecido. A pessoa escolhe:
     - **“Remover cópia incompleta”:** remove somente os arquivos regulares registrados no diário, dentro do destino, verificados sem seguir links. Depois remove, de baixo para cima, os diretórios registrados no diário que estiverem vazios, também verificados sem seguir links, terminando na pasta de destino. Arquivos e diretórios não registrados são preservados e listados (A-02). Nunca há remoção recursiva de conteúdo desconhecido.
     - **“Manter para diagnóstico”:** nenhum arquivo do destino é alterado.

     Não há remoção automática.
   - **Retenção (resposta F.3):**
     - O diário detalhado é apagado quando a restauração é verificada ou quando a escolha acima termina.
     - **A cópia incompleta continua existindo enquanto a pasta de destino existir**, verificada por `lstat`, sem seguir links (A-02). Nesse caso (“Manter para diagnóstico”, ou remoção que preservou itens), resta um **marcador mínimo** nos dados do aplicativo, com o caminho real do destino, a indicação “não verificado”, a data e o SHA-256 do ZIP.
     - O marcador é mantido até a remoção da cópia ou até a pessoa dispensar explicitamente o aviso.
     - Ao abrir uma pasta com marcador, o aplicativo avisa que a cópia não foi verificada. O marcador é local ao dispositivo: abrir a cópia em outro dispositivo, ou depois de apagar os dados do aplicativo, não gera aviso, e nada é gravado dentro da cópia para substituí-lo (A-14).
   - Um diário incompleto encontrado no reinício leva ao mesmo tratamento de restauração interrompida.

   *Redação anterior, preservada: “**PENDENTE (Q-08):** abrir o vault restaurado pela GUI e trocar o vault ativo. **PENDENTE (Q-04/Q-08):** o que fazer com os arquivos parciais de uma restauração que falhou. **RECOMENDAÇÃO:** mantê-los apenas dentro do destino escolhido, identificados como não verificados, sem apagar nada fora dele.”*

### 7.8 Histórico desta seção

Até 18/10/2026, esta seção trazia como PROPOSTO um manifesto com `schema_version` e `files` em objeto (caminho → SHA-256), e passos de exportação e restauração sem escolhas sobre exclusões, limites, links ou disponibilização. Essa proposta foi substituída pelas escolhas M-B, E-C, C-A, L-C e S-A e pelos itens P-6 a P-8 descritos acima. A análise das alternativas está em [PROPOSTA_Q05_BACKUP](PROPOSTA_Q05_BACKUP.md).

Em 18/10/2026, por autorização da proprietária (bloco 1 de [PROPOSTA_BLOQUEIOS_Q05](PROPOSTA_BLOQUEIOS_Q05.md)), houve três mudanças no §7.5:

- **Emenda (DQ-06):** acrescentada a categoria “comprimento do caminho absoluto no destino”. Antes, a lista terminava em “comprimento e profundidade de caminho”.
- **Formalização (DQ-05):** registrados os critérios de fixação dos valores.
- **Mudança de estado do ZIP64 (DQ-07):** passou de PENDENTE para Z-B, com AC-13 pendente.

O restante do §7 não mudou naquela data.

Em 18/10/2026, bloco 2 (DQ-03, DQ-10 a DQ-25, com as respostas da revisão do plano e da seção F.3), foram feitas estas mudanças. As redações anteriores estão citadas junto de cada item alterado.

- **Emendas a texto formalizado:**
  - §7.2 item 2 (caches, DQ-13);
  - §7.5 (classes de limite e critérios 1 a 3, DQ-03/DQ-05);
  - §7.7 item 1 (destino criado pelo aplicativo, DQ-19).
- **Pendências substituídas:**
  - §7.2 item 6 (D-014);
  - §7.6 (nota de plataforma);
  - §7.7 item 8 (abertura, falha, diário e marcador).
- **Complementos:**
  - §7.2 itens 3 e 5;
  - §7.3;
  - §7.4 itens 7 e 8 e o requisito de streaming;
  - alcance da verificação de links em §7.6;
  - §7.7 itens 2, 3, 4 e 7.

M-B, E-C, C-A, S-A e ZIP64 Z-B não mudaram. Nada está implementado ou testado.

Em 18/10/2026, depois da auditoria independente do bloco 2, houve mais estas mudanças, com redações anteriores citadas junto de cada item:

- **Emendas:** §7.2 item 7 (novo, A-01); §7.2 item 2 (padrão de temporários, A-09); §7.7 item 5 e §8 (versões não suportadas, A-10).
- **Correções:**
  - §7.2 item 3 (A-08);
  - §7.4 itens 4 e 5 e streaming (A-07, A-01, A-15);
  - §7.6 e §7.7 item 1 (A-03, A-04);
  - §7.7 item 7 (estados e relatório, A-14);
  - §7.7 item 8 (diário de diretórios, remoção de baixo para cima, existência da cópia e marcador local, A-02 e A-14).

Nada foi implementado ou testado.

## 8. Arquivamento e migrações

Arquivar preserva arquivo e referências. Vistas podem ocultar registros arquivados por padrão, mas links ainda resolvem. Exclusão definitiva e fusão de tags precisam de desenho próprio, prévia de impacto e possibilidade de recuperação.

Versão de schema maior que a suportada abre em modo seguro sem regravação. Isso vale para abrir um vault existente; na exportação e na restauração, versão não suportada bloqueia (§7.2 item 7, §7.7 item 5; A-10). Migrações futuras exigem backup, plano explícito, preservação de IDs e teste de interrupção. Não há migração implementada nesta entrega.

## 9. Evidência mínima da PoC

Registrar SO, runtime, revisão do código, fixture, comandos, resultados e hashes. Separar provas de arquivo de provas nativas: fechar/reabrir app, permissões, fechamento com conteúdo não salvo e limites reais de execução. Ver [plano de testes](TEST_PLAN.md).
