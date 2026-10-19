# Índice da documentação

**Estado da execução em 18/10/2026:** PoC local parcial (persistência, D-001/D-003/D-004, Tag, links/backlinks e nova permanente) existe e tem evidências em [IMPLEMENTATION_STATUS](IMPLEMENTATION_STATUS.md). Aplicativo V1, suíte V1 completa e integração nativa ainda não implementados; gate V0 permanece aberto.

## Comece aqui

1. [Status real](IMPLEMENTATION_STATUS.md).
2. [Documentação oficial](ATLAS_DE_INTERESSES_DOCUMENTACAO_OFICIAL.md).
3. [Guia do Cursor](CURSOR_MASTER_GUIDE.md).
4. [Decisões](DECISIONS.md) e [questões em aberto](OPEN_QUESTIONS.md).

## Mapa de responsabilidades

| Documento | Conteúdo |
| --- | --- |
| [AI_CONTEXT](AI_CONTEXT.md) | Resumo para nova sessão |
| [DATA_MODEL](DATA_MODEL.md) | Campos, tipos, relações e contrato proposto |
| [VAULT_CONTRACT](VAULT_CONTRACT.md) | Bytes, escrita, falhas, índices e backup |
| [ESPECIFICACAO_V1](ESPECIFICACAO_V1.md) | Fluxos e critérios de aceite |
| [UX_SPECIFICATION](UX_SPECIFICATION.md) | Telas, navegação, estados e atalhos propostos |
| [DESIGN_SYSTEM](DESIGN_SYSTEM.md) | Valores do PDF e aplicação visual |
| [ARCHITECTURE_DECISIONS](ARCHITECTURE_DECISIONS.md) | ADRs, alternativas e consequências |
| [IMPLEMENTATION_ROADMAP](IMPLEMENTATION_ROADMAP.md) | Sequência de prova e implementação |
| [WORKFLOW_CHECKLIST](WORKFLOW_CHECKLIST_V0_V5.md) | Acompanhamento V0–V5 |
| [TEST_PLAN](TEST_PLAN.md) | Cenários futuros e evidências necessárias |
| [REQUIREMENTS_TRACEABILITY](REQUIREMENTS_TRACEABILITY.md) | Requisito → decisão → cenário |
| [FILE_ARCHITECTURE](FILE_ARCHITECTURE.md) | Avaliação da estrutura e novos arquivos recomendados |
| [PoC local](../poc/README.md) | Escopo, comandos, testes e limites da prova executada |
| [PROPOSTA_BLOQUEIOS_Q05](PROPOSTA_BLOQUEIOS_Q05.md) | Pacote de decisões não vinculante para Q-04, Q-07, Q-08 e Q-10 (tabela única DQ-01–DQ-25) |
| [PROPOSTA_AC07_LIMITES](PROPOSTA_AC07_LIMITES.md) | Proposta não vinculante de valores de limite de segurança e de verificações de capacidade para o AC-07 (VAULT_CONTRACT §7.5), com as lacunas de evidência |
| [PROPOSTA_Q05_BACKUP](PROPOSTA_Q05_BACKUP.md) | Análise da Q-05, registro das escolhas, dependências e recomendação de biblioteca ZIP; regras vigentes em VAULT_CONTRACT §7 |
| [RECOVERY_LOG](RECOVERY_LOG.md) | Reconciliações e diferenças entre fontes |
| [SOURCES](SOURCES.md) | Proveniência, precedência e hashes |
| [CHANGELOG](CHANGELOG.md) | Histórico conciso de mudanças |
| [Exemplos](examples/README.md) | Vault fictício da proposta de schema |
| [Fontes preservadas](reference/README.md) | Material histórico, não normativo |
| [AGENTS da documentação](AGENTS.md) | Convenções complementares à raiz |

## Interpretação dos estados

DECIDIDO significa regra aprovada; PROPOSTO significa solução em avaliação; PENDENTE exige decisão/prova; RELATADO vem de fonte anterior; VERIFICADO exige evidência delimitada. Exemplo legível ou documento validado não comprova software funcionando.
