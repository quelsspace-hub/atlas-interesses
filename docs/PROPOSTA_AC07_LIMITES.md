# Proposta de valores de limite para o AC-07

**Estado:** PROPOSTO em 18/10/2026. **Decidida em 18/10/2026 pela [D-015](DECISIONS.md), com a alternativa B no S-5;** os valores vigentes estão no [VAULT_CONTRACT §7.5](VAULT_CONTRACT.md). Não adotados: a alternativa A e o destino típico de 100 caracteres (§2.2). Continua pendente: S-1 (razão de compressão). O texto abaixo é preservado como registro da proposta.

*Estado original:* **Não é decisão.** Não substitui os valores pendentes do [VAULT_CONTRACT §7.5](VAULT_CONTRACT.md), que continuam “nenhum aprovado”, nem altera requisitos do contrato. Nenhum valor desta proposta está codificado na PoC. A aprovação, a rejeição ou o ajuste de cada item é decisão da proprietária.

## 1. Base

| Fonte | Uso nesta proposta |
| --- | --- |
| [VAULT_CONTRACT §7.5](VAULT_CONTRACT.md) | Classes segurança × capacidade e os quatro critérios de fixação. Segurança: critérios técnicos e casos maliciosos de F-3, nunca múltiplos de F-2. Capacidade: verificada em execução, sem teto. Razão de compressão: critério 3. Caminhos: critério 4 |
| [TEST_PLAN §15](TEST_PLAN.md) (AC-19) | Curvas de memória, tempo e disco da PoC em **um** equipamento: Windows 11, i5-1334U, 15,7 GiB, NTFS, Defender ativo |
| Formato do manifesto (`poc/src/backup/manifest.ts`) | Tamanho exato do manifesto serializado, conferido por cálculo com o serializador real (§2.3) |
| Microsoft Learn, *Maximum Path Length Limitation* (página atualizada em 15/04/2025) e *Naming Files, Paths, and Namespaces* (atualizada em 11/04/2025), consultadas em 18/10/2026 | Limites da plataforma prioritária: MAX_PATH = 260 caracteres, contando o NUL final; diretório criado com no máximo MAX_PATH − 12; componente de nome normalmente de até 255 caracteres; caminhos longos (cerca de 32.767) só com o registro `LongPathsEnabled` = 1 **e** o manifesto do aplicativo `longPathAware`; caracteres 1 a 31 proibidos em nomes |
| Consulta somente leitura ao registro deste equipamento | `LongPathsEnabled` = 1. Isso descreve só este equipamento; o padrão do Windows não pode ser presumido |

As medições do AC-19 servem de evidência para **capacidade** e para o custo das regras de segurança. Elas **não** são usadas para tirar valores de segurança de um volume de vault, o que o critério 1 proíbe.

## 2. Limites de segurança (recusa antes de disponibilizar)

Unidades: “caracteres” são unidades UTF-16, como o Windows conta caminhos; “bytes” são bytes UTF-8, como o ZIP e o manifesto guardam nomes.

| ID | Item do §7.5 | Valor proposto | Base técnica | Margem | Situação da evidência |
| --- | --- | --- | --- | --- | --- |
| S-1 | Razão de compressão por entrada | **Nenhum valor proposto** | Critério 3: acima da maior razão legítima, incluindo amostras muito comprimíveis de F-2, e abaixo da razão dos ZIPs maliciosos de F-3 | — | **Lacuna** (§2.1) |
| S-2 | Bytes reais acima do declarado | **Tolerância zero**: os bytes extraídos de cada entrada são iguais ao tamanho declarado no manifesto e no diretório central | O manifesto M-B declara o tamanho exato; qualquer diferença é adulteração ou corrupção | Nenhuma é necessária: o valor é exato e não depende de volume | Já aplicado na PoC (contagem real e `validateEntrySizes`) e exercitado no AC-06 (“tamanho errado”, “hash errado”) |
| S-3 | Coerência entre manifesto, diretório central e contagem | **Igualdade exata** entre `file_count`, o número de entradas do manifesto e as entradas do diretório central sem o manifesto. **Tamanho do manifesto** ≤ 256 + N × (150 + 2 × P) bytes, em que N é o número de entradas do diretório central menos 1 e P é o limite de bytes do caminho relativo (S-5). Verificado pelo tamanho declarado da entrada `manifest.json` **antes** de lê-la | O manifesto é lido inteiro em memória (`readEntryBytes`); sem um teto, um manifesto gigante esgotaria a memória antes de qualquer validação. O teto vem do formato real (§2.3) | O termo 256 cobre o cabeçalho, de 106 bytes medidos, mais os dígitos de `file_count`; o fator 2 cobre o escape de `"` no JSON | Igualdade já aplicada (AC-06: “extra”, “ausente”); teto **não implementado** |
| S-4 | Caracteres de controle no caminho (pré-requisito do S-3) | **Recusar** U+0001 a U+001F em qualquer segmento, como já se recusa U+0000 | O Windows proíbe esses caracteres em nomes. Sem essa recusa, o escape JSON `\u00XX` faz cada byte valer 6, e o fator do S-3 teria de ser 6 | — | **Não implementado**; acrescenta uma regra de nome à pré-validação, por isso precisa de decisão |
| S-5 | Comprimento do caminho relativo | **Alternativa A (recomendada): 150 caracteres e 450 bytes.** Alternativa B: 1.024 caracteres e 3.072 bytes, apoiada em caminhos longos | Critério 4. Na alternativa A, MAX_PATH = 260 menos o NUL deixa 259; um destino típico de 100 caracteres (§2.2) e 1 separador deixam 158 para o caminho relativo. 450 bytes = 150 × 3, o máximo UTF-8 por unidade UTF-16 | 8 caracteres sobre o cálculo, para nomes de pasta restaurada um pouco mais longos que o típico | Base documentada; o destino típico é suposição (§2.2) |
| S-6 | Comprimento de cada segmento | **255 caracteres** | Componente de nome do NTFS, normalmente 255 | — | Coberto pelo S-5 na alternativa A; necessário na B |
| S-7 | Profundidade do caminho relativo | **32 segmentos** | O caminho canônico mais fundo tem 3 segmentos (`notes/permanent/{UUID}.md`). Com o S-5 da alternativa A, a profundidade já fica limitada a 75, porque cada segmento ocupa pelo menos 2 caracteres. O valor 32 protege a recursão da varredura e a criação de diretórios contra estruturas patológicas | Ampla para organização manual em `assets/` | **Evidência fraca:** não há medição do custo da profundidade. É escolha de conveniência e precisa de decisão |
| S-8 | Travessia, caminho absoluto e letra de unidade | Recusa, sem valor numérico | Regra existente (§7.2 e §7.7) | — | Aplicada e exercitada no AC-06 |

### 2.1 Por que a razão de compressão (S-1) não tem valor

- **Nenhum dado legítimo foi comprimido.** A exportação da PoC grava tudo com o método store. Em todos os degraus do AC-19, o ZIP ficou entre 1,0000 e 1,0786 vez os bytes incluídos, e a razão de cada entrada é 1. Isso não informa a maior razão legítima com deflate, que é o que o critério 3 pede.
- **Os insumos do critério 3 não existem.** F-2.v1 não foi proposto nem aprovado, e as amostras muito comprimíveis não foram construídas. Os ZIPs maliciosos de expansão de F-3 também não foram construídos.
- **Teto teórico:** o próprio deflate limita a razão de uma entrada a pouco mais de 1.000:1. Um valor perto disso não protegeria nada, e um valor baixo, sem medição, poderia recusar dados legítimos muito repetitivos.
- **Proteção principal já em vigor:** a contagem de bytes reais com tolerância zero (S-2) e a verificação de espaço livre contra o total declarado. Uma bomba de expansão não passa do tamanho declarado; um tamanho declarado enorme esbarra na verificação de espaço.
- **Para propor o valor:**
  1. aprovar F-2.v1 com amostras muito comprimíveis, por exemplo Markdown repetitivo e arquivos de zeros;
  2. comprimi-las com deflate e medir a maior razão;
  3. construir os ZIPs maliciosos de F-3 e medir a razão deles;
  4. escolher um valor entre as duas.

### 2.2 Suposição do destino típico (S-5)

O critério 4 exige “um caminho de destino típico”, que nenhum documento define. A proposta supõe até **100 caracteres** para a pasta restaurada, somando:
- unidade e `Users`: 9;
- nome da pasta do perfil: até 20;
- pasta de documentos, possivelmente redirecionada pelo OneDrive com o nome de uma organização: cerca de 40;
- nome da pasta restaurada escolhido pela pessoa: cerca de 27, como “Atlas restaurado 2026-10-18”;
- separadores.

**É suposição, não medição; precisa de decisão.**

Consequências na alternativa A:
- o diretório mais fundo do caminho relativo (até 148 caracteres) somado a um destino de 99 fica dentro do limite de criação de diretórios (MAX_PATH − 12 = 248, com NUL);
- os registros canônicos, de até 55 bytes, cabem com folga;
- quem tiver anexos com caminhos acima de 150 caracteres terá a **exportação bloqueada** (§7.2 item 7) até encurtá-los. É o custo de garantir que o vault restaurado possa ser aberto pelo Explorador e por ferramentas sem suporte a caminhos longos.

A alternativa B evita esse bloqueio. Em troca, depende de `LongPathsEnabled` = 1, que não é o padrão, e de o aplicativo nativo declarar `longPathAware`. Mesmo assim, o Explorador e outras ferramentas podem não abrir os arquivos restaurados.

### 2.3 Conferência do teto do manifesto (S-3)

A conferência foi feita com o serializador compilado da PoC (`dist/src/backup/manifest.js`), por um script descartável que não foi gravado no repositório:

| Caso | Bytes do manifesto | Teto proposto com P igual ao maior caminho do caso | Dentro do teto |
| --- | --- | --- | --- |
| Manifesto vazio | 106 | 256 | sim |
| 3 registros canônicos (59 bytes de caminho) | 723 | 1.048 | sim |
| 1.000 entradas de 154 bytes ASCII | 300.111 | 454.256 | sim |
| 2 entradas com 150 `"` (escape duplica) | 1.008 | 1.164 | sim |

Cada entrada ocupa 146 bytes mais o caminho escapado. Com o S-5 da alternativa A (P = 450), o teto por entrada é 1.050 bytes. Para 16.000 entradas, isso dá cerca de 16,8 MB de teto, contra cerca de 3,4 MB reais nos caminhos curtos do AC-19.

## 3. Capacidade (falha controlada; sem teto fixo)

O §7.5 proíbe teto derivado de fixture. A proposta, portanto, não fixa valores. Ela propõe **verificações em execução** e registra as curvas medidas como referência.

| ID | Item | Verificação proposta | Evidência e lacunas |
| --- | --- | --- | --- |
| C-1 | Número de entradas | Formato: ZIP clássico até 65.535 entradas; acima disso, ZIP64 (Z-B). Nenhum teto próprio | Custo medido nesta máquina: cerca de 8,3 KiB de maxRSS por entrada na exportação e 11,7 KiB na restauração, entre 1.000 e 16.000. A linearidade acima de 16.000 e o ZIP64 não foram medidos (AC-13). **Lacuna:** no Node, a falta de memória encerra o processo e não produz falha controlada; a garantia de falha controlada para memória depende do backend nativo |
| C-2 | Tamanho por arquivo e total descompactado | Nenhum teto; vale o limite real do sistema de arquivos, por falha controlada na criação ou escrita | Na série (i), até 4 × 768 MiB, a memória não acompanhou o tamanho. Arquivos acima de 4 GiB pertencem ao AC-13 |
| C-3 | Espaço livre | Restauração: espaço livre ≥ total declarado (já implementado). **Exportação (não implementada):** antes de escrever, espaço livre na pasta de destino ≥ Σ tamanhos + N × (100 + 2 × P) + teto do manifesto (S-3) | Os termos por entrada vêm dos cabeçalhos local e central do ZIP (30 e 46 bytes mais o nome, cada um), de um descritor de dados opcional e do registro no manifesto. Com P = 450 (alternativa A), a fórmula reserva 100 + 900 + 1.050 = 2.050 bytes por entrada. O maior excesso medido, na série (ii), foi de cerca de 321 bytes por entrada, com caminhos de 44 bytes. A fórmula é conservadora, não justa |
| C-4 | Caminho absoluto no destino | Antes da confirmação: para cada arquivo, destino + 1 + caminho relativo ≤ 259 caracteres; para cada diretório, ≤ 247. Ao ultrapassar, falha controlada com sugestão de destino mais curto | Limites documentados da plataforma. **Decisão necessária:** se o aplicativo nativo declarar `longPathAware` e o registro estiver ativo, usar cerca de 32.767 em vez de 259 e 247? A detecção pertence ao backend nativo. Não implementado na PoC (limitação 1 do incremento 2) |
| C-5 | Memória e tempo | Sem teto; metas na Q-07 | Curvas registradas no TEST_PLAN §15: cerca de 27 MiB/s na exportação e 32 MiB/s na restauração de anexos grandes; cerca de 5,3 ms por arquivo pequeno na restauração, por causa dos fsync do diário |
| C-6 | Tamanho do maior registro validado | Sem teto; o §7.4 admite memória proporcional ao maior registro | Medido: cerca de 55 MiB mais duas vezes o tamanho do registro (cerca de 315 MiB com 128 MiB) |

## 4. O que depende de decisão ou de medição

1. **Decisões da proprietária:**
   - aceitar, ajustar ou rejeitar cada item S-2 a S-7;
   - escolher a alternativa A ou B no S-5;
   - aprovar o destino típico de 100 caracteres (§2.2);
   - aceitar a nova regra de caracteres de controle (S-4);
   - decidir sobre caminhos longos no C-4.
2. **Medições ou construções pendentes:**
   - F-2.v1 com amostras muito comprimíveis e ZIPs maliciosos de F-3, para o S-1;
   - entradas acima de 16.000 e acima de 65.535 e arquivos acima de 4 GiB, para o C-1 e o C-2 (com o AC-13);
   - o custo da profundidade, se a proprietária quiser base medida para o S-7;
   - repetição em outro equipamento e no aplicativo nativo.
3. **Implementação, depois da decisão e fora desta proposta:**
   - teto do manifesto antes da leitura (S-3);
   - recusa de caracteres de controle (S-4);
   - limites de caminho e profundidade na exportação e na restauração (S-5 a S-7);
   - verificação de espaço livre na exportação (C-3);
   - verificação do caminho absoluto no destino (C-4);
   - testes do AC-07 com os valores aprovados.

## 5. Observação lateral

A página *Naming Files* também lista os nomes reservados de dispositivo (como `CON`, `NUL` e `COM1`, inclusive seguidos de extensão) e desaconselha nomes que terminem em espaço ou ponto. A pré-validação atual da PoC não os recusa: num ZIP adulterado, eles falhariam na criação durante a extração, como Falhou, e não na pré-validação. Não fazem parte das categorias de limite do §7.5 e ficam registrados apenas como lacuna para decisão futura.
