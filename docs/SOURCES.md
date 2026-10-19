# Fontes e precedência

**Consolidação:** 18/10/2026.

## 1. Precedência atual

1. Instruções e decisões explícitas da proprietária na conversa atual.
2. [Documentação oficial consolidada](ATLAS_DE_INTERESSES_DOCUMENTACAO_OFICIAL.md) e [decisões registradas](DECISIONS.md), que incorporam a aceitação das recomendações.
3. Documentos especializados por assunto: DATA_MODEL, VAULT_CONTRACT, especificação, UX e Design System. Trechos PROPOSTOS não anulam regras DECIDIDAS.
4. Fontes históricas no ZIP, consultadas apenas para comparação. Não escolher uma versão antiga por número maior ou data aparente.

Conflito novo deve ser registrado e resolvido; não inventar precedência entre duas regras incompatíveis. O PDF é a referência visual dos tokens, mas não define modelo de dados, layout completo ou permissões de implementação.

## 2. Fontes recebidas

| Fonte | Natureza | Uso |
| --- | --- | --- |
| Checkout inicial, commit 453b5c2386b9bff2fb57628ca7b6de29e6945cd7 | 21 Markdown, parcialmente danificados | Evidência do problema e histórico |
| DATA_MODEL v2.0-REC no chat | Texto fornecido pela proprietária | Caminhos, entidades, datas e regras recuperadas |
| Baseline v1.0-REC no chat | Texto fornecido pela proprietária | Visão, D-002, governança e roadmap |
| Documentação oficial de Doc. Inicial | Anexo Markdown completo | Propósito, fluxos, critérios e arquitetura proposta |
| ESPECIFICACAO_V1 | Anexo, proposta inicial | Campos e funcionalidades detalhadas |
| Navegação da V1 | Anexo com escapes e CRLF | Jornadas e sete telas |
| AI_CONTEXT, WORKFLOW e LEIA_PRIMEIRO | Três anexos | Contexto, governança e gates |
| PDF Design System | Quatro páginas | Paleta, tipografia, raios e espaçamentos |
| Auditoria do Cursor copiada no chat | Relato de outro workspace | Histórico de conflitos; não é inspeção desta cópia |
| Confirmação de ausência da PoC/testes | Declaração direta da proprietária | Corrigir falsos resultados e status técnico |
| Aceitação das sugestões e autorização de reescrita | Instrução atual | Reconciliar e aprofundar documentos |

## 3. Integridade preservada

- [ZIP das fontes](reference/fontes-originais.zip): SHA-256 `f246c2d7cdc1a094046ef1357097019a0411824d3569969e7286f3a22c26a30b`.
- [PDF oficial](design/atlas-design-system.pdf): SHA-256 `3ea280f816507755cf11a879d1bfa4c5439bdb402e6b28336d68d6c56b42aa2a`.
- O manifest interno do ZIP contém os hashes completos das 28 entradas originais.
- As mensagens do chat não foram incluídas como anexos literais; suas decisões estão sintetizadas no [registro de recuperação](RECOVERY_LOG.md).

## 4. Fontes futuras

Na PoC, consultar documentação oficial atual das versões escolhidas e registrar data, URL, versão e experimento relacionado. Esta edição não verificou preços/capacidades comerciais de ferramentas de IA nem APIs atuais do Tauri. Não reutilizar referências comerciais antigas como evidência técnica.

## 5. Evidência da auditoria corretiva dos seis contratos

A proprietária reafirmou as regras abaixo e autorizou restaurar sua redação canônica nos documentos ativos. A proposta posterior da consolidação não constitui aprovação para alterar esses contratos. Os registros superados estão em [DECISIONS.md](DECISIONS.md) e [RECOVERY_LOG.md](RECOVERY_LOG.md).

Entrada do ZIP: `anexos-recebidos/348e428e-0cca-4932-9225-4615076fe251-ESPECIFICACAO_V1.md`. SHA-256 do conteúdo original: `174334f9aacd2265abe8d118c4c4504d846d4bcc8e626641b619de359910d361`. As linhas abaixo são do arquivo dentro do ZIP, não deste documento.

| Campo | Seção / linha original | Evidência da tabela original |
| --- | --- | --- |
| Item.status | §2.3 / 69 | enum; obrigatório: Sim; `backlog`, `planned`, `active`, `paused`, `completed` ou `archived` |
| Item.priority | §2.3 / 70 | enum; obrigatório: Não; `low`, `medium` ou `high` |
| Task.priority | §2.4 / 104 | enum; obrigatório: Não; `low`, `medium` ou `high` |
| Task.sort_order | §2.4 / 107 | inteiro; obrigatório: Sim; ordenação dentro do projeto ou da lista |
| Group.sort_order | §2.1 / 30 | inteiro; obrigatório: Sim; ordenação na navegação |
| InboxCapture.capture_kind | §2.6 / 152 | enum; obrigatório: Sim; `thought`, `link`, `task`, `project`, `course`, `note` ou `undecided` |

A baseline oficial original corrobora os enums em §4.4, §4.5 e §4.7. A obrigatoriedade de sort_order/capture_kind é explícita na coluna Obrigatório da especificação acima. O SHA-256 do ZIP antes da correção foi comparado com a referência de §3; a comparação posterior fica registrada em IMPLEMENTATION_STATUS. Fontes originais não foram regravadas.
