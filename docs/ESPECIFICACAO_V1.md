# Especificação funcional da V1

**Estado:** requisitos consolidados; implementados no aplicativo V1 em `app/` (19/10/2026, [IMPLEMENTATION_STATUS §35](IMPLEMENTATION_STATUS.md)); aceite da proprietária pendente. *Estado anterior: implementação não iniciada.* Decisões em [DECISIONS.md](DECISIONS.md); contratos ainda propostos em [DATA_MODEL.md](DATA_MODEL.md).

## 1. Escopo e forma de aceite

A V1 deve permitir capturar, organizar, executar e reutilizar conhecimento em arquivos locais. Cada funcionalidade é aceita por resultado observável após persistência/reabertura, não apenas por uma tela renderizada.

Ficam para versões futuras: catálogo aprofundado e busca global V2; canvas V3; grafo V4; sync/Android V5. A busca de título/ID no seletor de notas é necessária na V1 e não constitui busca global avançada.

## 2. Grupos e tags — F-01

**Fluxo:** Organização → criar Tag → criar Group → selecionar tags → salvar → abrir grupo.

- Criar, editar, ordenar, arquivar e recuperar grupos; `Group.sort_order` é inteiro obrigatório no registro.
- Criar, renomear, descrever, colorir e arquivar tags.
- Permitir grupos sem tags e explicar estado vazio.
- Ao remover tag de um grupo, mostrar impacto nos itens visíveis antes de confirmar.
- Avisar sobre títulos duplicados; nunca fundir UUIDs automaticamente.
- Referências de tags arquivadas continuam preservadas; escolha de novas tags pode ocultá-las por padrão.

**Aceite:** um item com tag compartilhada aparece em dois grupos sem duplicar arquivo; renomear Tag altera rótulos após reindexação sem alterar arquivos dos itens; itens sem correspondência continuam acessíveis.

## 3. Itens e projetos — F-02

**Fluxo:** Atlas → novo item → tipo/título → tags e detalhes opcionais → salvar → detalhe.

- Suportar os seis tipos definidos, com campos apropriados ao tipo.
- Filtrar localmente por tipo, status e tags; incluir “Sem grupo”. Estados de Item: `backlog`, `planned`, `active`, `paused`, `completed`, `archived`.
- Prioridade de Item é opcional e aceita `low`, `medium`, `high`.
- O detalhe mostra objetivo, critérios de sucesso, prazo, grupos derivados e notas.
- Projeto inclui tarefas e progresso; curso usa cadastro básico, sem módulos/currículo completo.
- Não armazenar relação direta com grupo.
- Arquivar oculta da lista padrão e preserva referências; recuperar requer status de destino.

**Aceite:** alteração de título preserva UUID; recarregar recupera metadados e corpo; 100% das tarefas não muda status do projeto sem confirmação.

## 4. Tarefas e progresso — F-03

- Criar tarefa avulsa ou ligada a um único projeto.
- Estados: todo, in_progress, done, canceled.
- Marcar próxima ação e definir prazo. `Task.priority` é opcional: `low`, `medium`, `high`; `Task.sort_order` é inteiro obrigatório no registro.
- Concluir preenche completed_at; reabrir limpa completed_at.
- Listas: abertas, próximas ações, vencidas, por projeto e histórico de concluídas/arquivadas.
- Rejeitar vínculo com Item de outro tipo; manter visíveis tarefas avulsas.

**Aceite:** todo + done + canceled resulta em 50%; apenas canceled resulta em null; tarefas de outro projeto não afetam o cálculo. Modos manual/none têm apresentação própria. Tratamento de arquivadas depende do fechamento Q-03.

## 5. Notas e conhecimento — F-04

- Editor separa título/metadados de corpo Markdown; uso cotidiano não exige edição de YAML.
- Work exige contexto; reading aceita contexto; permanent é global.
- Seletor encontra nota por título/ID e insere link Markdown relativo válido.
- Exibir links de saída e backlinks calculados; alvos arquivados permanecem identificáveis.
- Mostrar links quebrados sem apagar texto.
- Renomear título preserva ID e caminho; aliases ajudam a localizar títulos anteriores.

**Criar permanente:** a partir de work/reading, abrir elaboração de nova nota global; gerar novo UUID ao salvar; incluir link para origem; preservar original. A pessoa pode desenvolver o conteúdo em palavras próprias. Essa ação não muda o tipo da nota de origem.

**Aceite:** após apagar cache e reiniciar, link e backlink continuam disponíveis; criar permanente não modifica os bytes da original; editar apenas YAML preserva corpo da nota editada.

## 6. Caixa de entrada — F-05

**Captura:** conteúdo obrigatório; o registro também exige `capture_kind` com `thought`, `link`, `task`, `project`, `course`, `note` ou `undecided`. O valor `undecided` permite manter a classificação em aberto; não define um default automático. Proposta Q-02 armazena texto original no corpo.

**Processamento:** escolher resultado principal (qualquer tipo de Item, Task ou Note), preencher campos mínimos e confirmar. Projeto pode incluir tarefas derivadas. A captura não é apagada; referências de origem são preservadas.

**Falha:** manter indicação de pendência e recuperação; não mostrar processed antes do commit. Colisão de UUID deve interromper a conversão sem substituir destino alheio.

**Aceite:** interromper em cada etapa do manifesto e retomar sem duplicar; segunda reconciliação não altera estado final; capturas processadas não são convertidas outra vez por clique repetido.

## 7. Visão geral e navegação — F-06

Captura rápida, próximas ações, prazos, projetos ativos, capturas pendentes e itens recentes. Ordem fixa na V1 é suficiente. Hub central no mapa conceitual, listas/detalhes operáveis sem canvas.

Sete telas e áreas utilitárias propostas estão em [UX_SPECIFICATION.md](UX_SPECIFICATION.md). Projetos são acessíveis diretamente por uma vista filtrada; Configurações oferece localização do vault, preferências e backup. Confirmar protótipo e atalhos antes da implementação visual.

## 8. Configurações, backup e restauração — F-07

- Selecionar/abrir vault autorizado, apresentar localização e versão do schema. Desde 18/10/2026 (D-014), a versão apresentada é a do schema dos registros, **derivada** dos próprios registros; versões mistas são exibidas com diagnóstico ([DATA_MODEL §1](DATA_MODEL.md)).
- Alternância manual Light/Dark; modo automático do SO é proposta. O tema é preferência do dispositivo e não entra no backup (D-014).
- Exportar ZIP para fora do vault, confirmar sucesso somente após verificação. A exportação é bloqueada por registros inválidos e por versões não suportadas, e “fora do vault” é verificado por caminho real (D-013, emendas A-01, A-04 e A-10; [VAULT_CONTRACT §7.2](VAULT_CONTRACT.md)).
- Restaurar em pasta nova; conferir manifesto, hashes e relações antes de usar.
- Mostrar diagnóstico útil de arquivo inválido, permissão, colisão e espaço insuficiente. Desde 18/10/2026 (D-015), também de caminho fora dos limites de segurança e de caminho absoluto longo demais para o destino escolhido, com a sugestão de um destino mais curto ([VAULT_CONTRACT §7.5](VAULT_CONTRACT.md)).

**Aceite:** restaurar fixture em pasta limpa e comparar bytes de registros/anexos; arquivo adulterado ou caminho inseguro é recusado; falha não altera o vault ativo.

## 9. Requisitos não funcionais

| Tema | Critério observável |
| --- | --- |
| Integridade | Sem escrita silenciosa sobre conflito externo; body preservado nas operações D-006 |
| Portabilidade | Arquivos e links legíveis fora da aplicação; exportação completa |
| Acessibilidade | Operar por teclado, foco visível, rótulos, contraste medido e erro além de cor |
| Responsividade | Conteúdo utilizável em janela estreita sem perder ações essenciais |
| Offline | Fluxos locais não exigem rede; URLs externas dependem de conectividade |
| Desempenho | Medir indexação, abertura e salvamento com fixture definida; metas em Q-07 |
| Permissões | Somente vault autorizado; erro de acesso não vira “salvo” |
| Observabilidade | Diagnóstico local sem conteúdo pessoal desnecessário ou credenciais |

## 10. Condições de liberação

Fechar propostas necessárias, implementar e executar os testes de domínio/arquivo/nativo, validar fluxos com a proprietária, resolver falhas de integridade e registrar revisão/aceite. Nenhum requisito está marcado como implementado nesta entrega documental.

## Atualização de backup — S-1, 19/10/2026

**DECIDIDO:** [D-016](DECISIONS.md) permite recusar ZIPs externos legítimos por razão de compressão; exportações Atlas permanecem restauráveis via store. Regra central em [VAULT_CONTRACT §7.5](VAULT_CONTRACT.md). Nenhum schema de entidade muda. **PENDENTE:** limite numérico padrão; mecanismo explícito verificado apenas na PoC ([TEST_PLAN §20](TEST_PLAN.md)), não na aplicação V1.
