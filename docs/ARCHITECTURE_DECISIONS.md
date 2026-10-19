# Registro de decisões de arquitetura

**Data:** 18/10/2026. IDs históricos foram preservados quando seu significado era recuperável. ADR-003, ADR-006 e ADR-007 estavam ausentes; os textos abaixo são **novas propostas documentais**, não recuperação de aprovações antigas.

## ADR-001 — Identidade por UUID v4

**Estado:** DECIDIDO no produto; implementação pendente. **Relacionada:** D-005.

Contexto: títulos e localização mudam; relações precisam sobreviver. Decisão: gerar UUID v4 por entidade e usar UUID no nome do arquivo. Alternativas: slug/título como chave, rejeitados por instabilidade. Consequência: UI resolve nomes pelo índice; colisões precisam de diagnóstico e criação sem sobrescrita. Validar TC-02 e TC-03.

## ADR-002 — Grupos derivados de tags

**Estado:** DECIDIDO; implementação pendente. **Relacionada:** D-004.

Contexto: um item aparece em vários grupos. Decisão: interseção não vazia de UUIDs de tags; associação inversa calculada. Alternativas: listas manuais de itens por grupo e regra AND, incompatíveis com o produto. Consequência: renomear tag não reescreve consumidores; índices precisam ser reconstruíveis. Validar TC-04.

## ADR-003 — Índices derivados e links Markdown

**Estado:** PROPOSTO como desenho técnico; representação de links D-009 decidida. **Registro novo.**

Contexto: arquivos devem ser legíveis fora do app e permitir backlinks após reinício. Proposta: parser Markdown constrói grafo de links relativos e mapa UUID→arquivo; caches descartáveis. Alternativas: lista de links no YAML duplica verdade; wikilinks exigem resolução específica. Consequências: mover arquivo requer reparo explícito de links; títulos duplicados não impedem resolução por caminho. Validar TC-07, TC-08 e TC-19.

## ADR-004 — Round-trip de metadados e criação de permanente

**Estado:** D-006 e D-008 DECIDIDOS; mecanismo pendente.

Contexto: o registro histórico confundia promoção de nota com edição de metadados. Decisão reconciliada: preservar bytes do corpo ao editar apenas YAML; criar permanente gera nova entidade e link para origem, sem editar a origem automaticamente. Alternativa REC de converter a mesma entidade foi substituída pela recomendação aceita. Consequências: operações têm contratos/testes diferentes; não aplicar hash de igualdade entre corpos de duas notas distintas. Validar TC-06 e TC-09.

## ADR-005 — Conversão de Inbox recuperável

**Estado:** requisito D-002 DECIDIDO; protocolo PROPOSTO.

Contexto: gravação de captura/projeto/tarefas pode ser interrompida. Proposta: manifesto persistido, temporários, promoção sem sobrescrita e reconciliação idempotente. Alternativa: apenas marcar processed antes de escrever cria perda aparente. Consequência: recuperação consulta arquivos reais e hashes; manifesto genérico outputs precisa de revisão. Validar TC-10–TC-12 conforme plano.

## ADR-006 — Backup verificável e restauração isolada

**Estado:** D-007 DECIDIDO. Formato e política técnica parcialmente FORMALIZADOS em 18/10/2026 pela proprietária (Q-05, registro D-013); Valores de limites, configuração/anexos portáteis e abertura pela GUI PENDENTES (texto de 18/10/2026, bloco 1). **Atualização de 18/10/2026, bloco 2:** conteúdo canônico e configuração portátil decididos em D-014; abertura do vault restaurado, destino, diário e falhas formalizados em VAULT_CONTRACT §7.7; limites classificados em segurança e capacidade. Continuam PENDENTES os valores de segurança, o visual da GUI (Q-08), AC-13 e a prova nativa. ZIP64 formalizado como Z-B em 18/10/2026 (DQ-07), com AC-13 pendente. Também em 18/10/2026: categoria de caminho absoluto acrescentada aos limites (emenda DQ-06). A redação anterior listava o ZIP64 entre as pendências. Implementação inexistente. **Registro novo** (criado na consolidação de 18/10/2026).

Contexto: um ZIP criado não demonstra restauração. Proposta original da consolidação: snapshot consistente, manifesto sem autorreferência, hashes de todos os arquivos incluídos, restauração em pasta nova, validação de caminhos e limites. Alternativa: cópia sobre o vault ativo pode produzir mistura ou perda.

Decisão formalizada (detalhe em [VAULT_CONTRACT §7](VAULT_CONTRACT.md)):

- manifesto M-B: `manifest_version`, `created_at`, `file_count` e lista ordenada `{ path, size, sha256 }`;
- exclusões E-C: inventário do conteúdo não canônico, com decisão explícita;
- consistência C-A: dupla verificação e publicação após validação, que detecta mudanças, mas não garante snapshot atômico;
- limites L-C: estrutura definida, valores pendentes; *atualização de 18/10/2026: valores decididos pela D-015, exceto a razão de compressão, e não implementados ([VAULT_CONTRACT §7.5](VAULT_CONTRACT.md))*;
- links S-A: bloqueio na exportação e recusa na restauração;
- anexos como bytes opacos;
- validação que bloqueia integridade e estrutura, e apenas avisa sobre referências ausentes;
- restauração como cópia independente verificada, com relatório, sem ativar o vault atual.

Consequências:

- transações pendentes e links bloqueiam a exportação;
- os limites de segurança precisam de valores medidos; os de capacidade são verificados em execução, sem valor fixo (atualizado em 18/10/2026, A-11; redação anterior: “os limites precisam de valores medidos (Q-07)”);
- ZIP64: Z-B formalizado em 18/10/2026 (DQ-07), com compatibilidade a verificar em AC-13; antes, era “decisão própria (recomendação Z-B)”;
- a implementação requer biblioteca ZIP (recomendação em [PROPOSTA_Q05_BACKUP §8](PROPOSTA_Q05_BACKUP.md)) e autorização.

Validar TC-13 a TC-15.

## ADR-007 — Evolução do schema e conflitos externos

**Estado:** PROPOSTO. **Registro novo.**

Contexto: arquivos abertos podem ser editados por outras ferramentas e mudar de formato. Proposta: schema_version explícito, preservação de campos desconhecidos, bloqueio de regravação de versão incompatível e comparação da revisão lida antes de salvar. Alternativa: última escrita vence silenciosamente perde dados. Consequência: UI precisa de conflito; migrações futuras exigem backup e recuperação. Validar TC-16, TC-18 e TC-20.

## ADR-008 — Stack V1

**Estado:** CANDIDATA, decisão pendente da PoC.

Tauri 2 + React + TypeScript oferece UI web e acesso nativo potencialmente multiplataforma. Provar filesystem, permissões, fechamento, reinício, empacotamento e consumo. Comparar com PWA/filesystem e outra solução local somente se a candidata não atender requisitos. Banco remoto como fonte canônica altera princípio e exige decisão de produto.

Não escolher dependências/versões por memória de um handoff. Registrar versões verificadas e resultados na PoC. Validar TC-17 e TC-21 antes do gate técnico.

## Processo de revisão

Cada mudança registra contexto, alternativa, decisão, consequências, evidência e estado. Arquitetura documentada não recebe “comprovada” sem os testes correspondentes. Propostas abertas estão em [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).
