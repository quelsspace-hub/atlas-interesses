# Design System — Atlas de Interesses

**Fonte visual oficial:** [PDF fornecido pela proprietária](design/atlas-design-system.pdf).

**Derivação técnica:** [design-tokens.json](design/design-tokens.json), sem dependência de framework.

**Estado:** cores, tipografia e dimensões extraídas do PDF; componentes e aplicação na UI ainda precisam de protótipo.

## 1. Proveniência e correção da paleta

As quatro páginas do PDF foram renderizadas e conferidas. As cores foram extraídas dos preenchimentos vetoriais das amostras, convertendo RGB para hexadecimal de 8 bits; não foram inferidas pelo nome de um framework. O fundo da página do PDF não é necessariamente o token Surface: a amostra rotulada é a referência.

A paleta azul/branca do antigo CURSOR_MASTER_GUIDE divergia do PDF. Esta consolidação adota as amostras do PDF, com tons roxos. Valores históricos continuam preservados no ZIP de fontes, sem aplicação normativa.

## 2. Cores semânticas

| Token técnico | Light | Dark |
| --- | --- | --- |
| `surface` | `#F9F8F2` | `#010117` |
| `surface-raised` | `#F7F7F5` | `#1D173D` |
| `text` | `#14201C` | `#F2F5F4` |
| `text-muted` | `#5C6B66` | `#9FADA8` |
| `primary` | `#241F6F` | `#5866C2` |
| `primary-hover` | `#191F63` | `#7A86D3` |
| `on-primary` | `#FFFFFF` | `#0C1A16` |
| `border` | `#D8D9DF` | `#343440` |
| `danger` | `#B4472E` | `#F08A72` |

**Uso:** surface para fundo principal; surface-raised para cards/modais; text/text-muted para conteúdo/metadados; primary/primary-hover para ações; on-primary para conteúdo sobre primary; border para divisores; danger para erro/ação destrutiva.

Nomes técnicos em kebab-case são um mapeamento documental dos rótulos do PDF (por exemplo Surface raised → surface-raised). Não constituem escolha de Tailwind ou biblioteca CSS.

Cores de Tag/Group são dados da entidade; não precisam repetir a cor primary. Renderizar badge com texto legível e nome visível. Não usar a cor como única indicação de estado.

## 3. Tipografia

Família **Inter**, identificada também nas fontes incorporadas ao PDF. Instalação/empacotamento e licença da fonte devem ser definidos quando houver aplicativo; este pacote não redistribui os arquivos da fonte.

| Estilo | Peso | Tamanho | Altura de linha |
| --- | --- | --- | --- |
| Display | 700 | 48px | 56px |
| Heading/L | 700 | 30px | 38px |
| Heading/M | 600 | 22px | 30px |
| Heading/S | 600 | 17px | 24px |
| Body/L | 400 | 18px | 28px |
| Body/M | 400 | 15px | 22px |
| Body/S | 400 | 13px | 18px |
| Label/M | 500 | 14px | 20px |
| Label/S | 500 | 12px | 16px |

Os rótulos do PDF indicam Medium para Label/M e Label/S; adotar peso 500 na implementação, sem inferir o peso apenas pelo subconjunto de fontes incorporadas. Frase demonstrativa do PDF: “Ridgeline at first light”; não é texto de produto obrigatório.

## 4. Geometria

| Token | Valor | Aplicação sugerida |
| --- | --- | --- |
| Radius/S | 6px | Inputs, badges e botões |
| Radius/M | 12px | Cards, modais e painéis |
| Radius/L | 24px | Caixa do hub conceitual |
| Space/S | 8px | Separação curta |
| Space/M | 16px | Padding e grupos de controles |
| Space/L | 24px | Separação de seções |
| Space/XL | 40px | Margens de composição ampla |

## 5. Componentes a prototipar

- Botão primário, secundário e destrutivo: default, hover, foco, disabled e loading.
- Input, seletor de tags e datas: rótulo, ajuda, erro e valor vazio.
- Card/lista de item: título, tipo/status, tags, prazo e progresso nulo.
- Editor de nota: estado de gravação, conflito, seleção de links e metadados.
- Diálogo: confirmação, fechamento com alterações, restauração e falha recuperável.
- Indicadores: próximo passo, arquivado, erro e link quebrado.

## 6. Acessibilidade e limites

A presença dos tokens não comprova WCAG. Medir cada combinação real: texto comum 4,5:1, texto grande 3:1 e controles/foco conforme uso. O contraste do PDF não autoriza afirmar “AA+” para toda a UI. A combinação on-primary `#0C1A16` sobre primary `#5866C2` no tema Dark resulta em **3,48:1**, abaixo de 4,5:1 para texto comum. Manter os valores da fonte como referência e revisar o uso/combinação antes do aceite visual (Q-09); não apresentar esse botão com texto pequeno como conforme sem correção aprovada.

Lucide React, modo automático por SO e mapeamento para CSS/Tailwind continuam propostas. Alternância manual Light/Dark pode compor o protótipo. Cores não devem ser substituídas silenciosamente para fechar uma métrica.

### Conferência numérica de combinações selecionadas

Cálculo de luminância relativa sRGB dos valores extraídos; não é auditoria da interface, que ainda não existe.

| Combinação | Light | Dark |
| --- | --- | --- |
| Text / Surface | 15,75:1 | 18,80:1 |
| Text muted / Surface | 5,26:1 | 8,86:1 |
| On primary / Primary | 13,99:1 | 3,48:1 |
| On primary / Primary hover | 14,81:1 | 5,26:1 |
| Danger / Surface | 5,09:1 | 8,43:1 |
