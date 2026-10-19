# Proposta de composição F-2.v1 e medição de S-1

**Data:** 19/10/2026 · **Estado: DECIDIDO — composição e experimentos aprovados pela proprietária em 19/10/2026.**

## 1. Objetivo e dependências

Preparar o experimento de razão de compressão que falta no AC-07. Esta proposta concretiza o próximo passo do relatório de 18/10/2026, item 6.2, conforme [TEST_PLAN §12](TEST_PLAN.md), [VAULT_CONTRACT §7.5](VAULT_CONTRACT.md) e a lacuna S-1 da [proposta de limites](PROPOSTA_AC07_LIMITES.md).

A proprietária aprovou esta composição e autorizou a criação com a mensagem “composição aprovada, pode seguir com a criação”. O texto das seções abaixo preserva o plano apresentado; resultados executados serão registrados separadamente em TEST_PLAN e IMPLEMENTATION_STATUS. A aprovação não decide um valor S-1. Os volumes abaixo são escalas experimentais, sem representar uso pessoal, teto de capacidade ou meta de desempenho. A validação Windows do AC-13 permanece pendente, independentemente deste experimento.

## 2. Composição proposta de F-2.v1

Unidades: KiB = 1.024 bytes; MiB = 1.048.576 bytes. Todos os arquivos são sintéticos.

| Conteúdo | Quantidade | Tamanho por arquivo | Finalidade |
| --- | ---: | --- | --- |
| Registros Markdown: 2 Tags, 2 Groups, 2 Items (project/interest), 1 Task e 3 Notes (work/reading/permanent) | 10 | 64 KiB, incluindo frontmatter | Relações, texto UTF-8, LF/CRLF e repetição Markdown |
| Anexos binários de alta entropia determinística | 2 | 1 MiB | Controle com pouca compressibilidade |
| Imagem PNG válida, RGB, 256 × 256, pixels derivados da semente | 1 | Medido após geração | Anexo com compressão interna |
| PDF válido de uma página, com raster RGB 256 × 256 comprimido internamente | 1 | Medido após geração | Segundo formato com compressão interna |
| Texto repetitivo UTF-8 | 2 | 1 MiB e 8 MiB | Conteúdo legítimo muito comprimível |
| Bytes zero | 2 | 1 MiB e 8 MiB | Caso extremo legítimo de compressibilidade |
| Anexo vazio | 1 | 0 bytes | Razão sem conteúdo |
| Anexo pequeno | 1 | 32 bytes ASCII fixos | Overhead de compressão |
| `settings.yml` | 1 | 20 bytes: `settings_version: 1` seguido de LF | Configuração portátil mínima já aceita na PoC |

**Totais previstos:** 21 arquivos no vault (10 registros, 10 anexos e 1 configuração); 22 entradas no ZIP com `manifest.json`, sem entradas explícitas de diretório. Conteúdo do vault: **21.626.932 bytes + tamanho do PNG + tamanho do PDF**. O manifesto é adicional e não contém hash de si mesmo.

Cinco registros terão LF e cinco CRLF; o tamanho de 64 KiB considera os bytes reais de cada convenção. Corpos incluem acentos, links Markdown relativos entre notas, blocos de código e espaços finais. Completar tamanhos com preenchimento ASCII sem cortar caracteres UTF-8. Preservar bytes e hashes na restauração.

As referências usam UUIDs v4 sintéticos estáveis: ambos os grupos compartilham pelo menos uma tag com um item; o segundo grupo inclui também uma tag diferente, exercitando OR. A Task aponta ao projeto. A Note work aponta a um item, reading usa `null` e permanent exige `null`. Não gravar associação de grupo nos Items. Não incluir captura/transação da Inbox neste corpus.

Os registros exercitam o envelope experimental da PoC; não aprovam o schema V1, seus defaults ou Q-01. A validação reduzida do backup não comprova todas as regras de domínio. Anexos permanecem bytes opacos; PNG/PDF válidos qualificam a amostra, sem criar interpretação desses formatos no produto.

## 3. Reprodutibilidade proposta

- Versão `F-2.v1`, semente `atlas-f2-v1`, timestamp de conteúdo fixo `2026-10-19T00:00:00.000Z`.
- Adaptar o padrão existente em `poc/bench/ac19-fixture.ts`: SHA-256 da semente e do rótulo para derivar UUIDs com bits de versão 4/variante corretos; AES-256-CTR sobre zeros para os bytes de alta entropia. Documentar rótulos, chave/IV sintéticos derivados e ordenação, sem aleatoriedade do sistema ou relógio na geração.
- Fixar os parâmetros de geração do PNG/PDF, inclusive compressão interna, e conferir que os formatos são válidos. Não renomear bytes aleatórios como imagem/PDF. Registrar versões de runtime, zlib e gerador; mudança que altere bytes exige nova versão de fixture.
- Gerar duas vezes em pastas temporárias distintas; comparar a lista ordenada de caminhos, tamanhos e SHA-256 de todos os arquivos. Registrar também hashes dos corpos Markdown.
- Guardar inventário experimental fora do vault. O `manifest.json` dentro do ZIP continua seguindo o contrato vigente. Comparar conteúdo extraído; não pressupor que ZIPs com timestamps diferentes sejam idênticos.

## 4. Medição proposta

Usar os mesmos bytes em quatro variantes experimentais: store (método 0) e deflate (método 8) nos níveis 1, 6 e 9. O exportador de produção continua em store até decisão de S-1; as variantes são do gerador de laboratório.

Por entrada, registrar método, nível, tamanho descompactado real **U**, tamanho do payload comprimido **C** do diretório central, bytes realmente lidos, SHA-256 e **R = U/C**. Excluir cabeçalhos ZIP, extras e diretório central de C. Para U = 0, registrar razão como não aplicável; para U > 0 e C = 0, registrar declaração inválida, sem dividir por zero. Registrar manifesto separadamente das classes de conteúdo, incluindo-o no máximo geral de entradas legítimas.

Seguir [MP, TEST_PLAN §12.3](TEST_PLAN.md): ao menos cinco execuções por cenário, mediana/máximo, tempo por fase, memória e disco. Identificar a primeira execução separadamente; só qualificá-la como cache frio se isso tiver sido comprovado. Registrar SO, filesystem, CPU/RAM, Node, zlib, bibliotecas, revisão e hashes do corpus. Resultados Linux caracterizam esse ambiente; não substituem a plataforma prioritária Windows 11/NTFS ou metas Q-07.

## 5. Casos F-3 propostos para o experimento

| Caso | Construção prevista | Resultado a observar |
| --- | --- | --- |
| Expansão coerente | 8 e depois 32 entradas de 8 MiB de zeros, com manifesto, hashes e tamanhos corretos | Medir expansão de 64/256 MiB e memória/tempo; não presumir recusa sem regra decidida |
| Conteúdo idêntico | Reusar o anexo legítimo de 8 MiB de zeros com o mesmo método/nível | Conferir que bytes iguais têm a mesma razão, independentemente da origem atribuída |
| Tamanho falso | Deflate cujo tamanho real diverge do declarado, incluindo manifesto e diretório central coerentes entre si | Recusa controlada; nunca publicar restauração como verificada |
| Hash falso | Tamanhos coerentes com SHA-256 adulterado no manifesto | Recusa por integridade, sem disponibilizar vault verificado |
| Stream truncado | Remover bytes do payload deflate mantendo metadados finais acessíveis | Recusa de estrutura ou extração, sem falso sucesso |

Executar em diretórios descartáveis, com orçamento do laboratório registrado por cenário, monitoramento e limpeza apenas dos artefatos próprios. Esses degraus não introduzem um teto no produto. Registrar em qual fase a recusa ocorreu: se a falha só for detectável durante extração, aplicar o tratamento vigente de restauração falha, diário e marcador externo. Um ZIP coerente com alta razão não é automaticamente malicioso.

## 6. Critério de decisão e sequência de implementação

O critério vigente exige S-1 acima da maior razão legítima e abaixo da razão dos ZIPs maliciosos. Zeros e texto repetitivo legítimos podem alcançar as mesmas razões dos casos de expansão. A razão isolada não distingue intenção; aumentar a quantidade de entradas pode ampliar custo total sem aumentar a razão por entrada.

1. **DECIDIDO — aprovação em 19/10/2026:** proprietária aceitou a composição das seções 2–5 e autorizou sua criação.
2. **Após aprovação:** implementar gerador e executor em `poc/bench/`, controles de reprodutibilidade e testes de corrupção relevantes; documentar comandos em `poc/README.md` e executar a suíte principal.
3. **VERIFICAÇÃO futura:** publicar medidas e logs reais, incluindo máximos legítimos/maliciosos e eventuais sobreposições. Nenhuma medida desta proposta foi executada.
4. **DECISÃO futura:** se houver intervalo tecnicamente defensável, propor valor S-1 com evidência. Se não houver, apresentar a incompatibilidade do critério e alternativas para decisão da proprietária antes de alterar [VAULT_CONTRACT](VAULT_CONTRACT.md). Não inventar um limiar nem descartar amostras legítimas para criar separação.
5. Só depois da decisão, implementar a política de compressão/recusa e seu fallback store, conforme contrato aprovado, executar AC-07 e atualizar rastreabilidade. AC-07 completo e gate V0 continuam pendentes.

A escolha da stack e das metas nativas (Q-07), UX (Q-08), Inbox (Q-01/Q-02/Q-04) e nomes reservados/finais com ponto ou espaço exigem decisões próprias; a aprovação deste corpus não as resolve.

## 7. Execução delimitada — VERIFICADO em 19/10/2026

Gerador e executor implementados e executados na PoC/Linux. Duas gerações idênticas, 164/164 testes e 75/75 operações experimentais; evidências, hashes, comandos e limitações em [TEST_PLAN §19](TEST_PLAN.md) e [resultados](../poc/bench/results/f2-2026-10-19.md). Os números são resultados desta etapa, não afirmações de execução feitas na proposta original. S-1 segue PENDENTE: os payloads legítimos e de expansão tiveram razões iguais. Alternativas para decisão em [PROPOSTA_AC07_LIMITES §6](PROPOSTA_AC07_LIMITES.md).
