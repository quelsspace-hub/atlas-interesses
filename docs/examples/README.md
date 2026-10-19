# Exemplos fictícios de vault

**Estado:** ilustrações do DATA_MODEL proposto. Não são dados pessoais, PoC, teste executável ou evidência de software funcionando. Não são um backup: não há manifest.json nem ZIP de restauração aqui.

## Conteúdo

- Uma Tag UX Design compartilhada pelos grupos Design e Tecnologia.
- Um projeto com essa tag; deve aparecer nos dois grupos por OR.
- Três tarefas: done, todo e canceled; progresso esperado 50%.
- Uma nota work contextual, uma reading independente e uma permanent global.
- A permanente aponta para a work; a leitura aponta para a permanente. Os backlinks podem ser reconstruídos desses links.
- Uma captura processed ligada ao projeto e uma pending ainda sem resultado.

Total: **12 registros**. UUIDs repetitivos foram escolhidos apenas para leitura didática; são sintaticamente UUID v4 válidos. Os campos de data não afirmam que tarefas reais foram executadas.

## Percurso de leitura

1. [Tag](vault/tags/11111111-1111-4111-8111-111111111111.md).
2. [Grupo Design](vault/groups/22222222-2222-4222-8222-222222222222.md) e [Tecnologia](vault/groups/33333333-3333-4333-8333-333333333333.md).
3. [Projeto](vault/items/44444444-4444-4444-8444-444444444444.md).
4. [Nota de origem](vault/notes/work/66666666-6666-4666-8666-666666666666.md) e [nova permanente](vault/notes/permanent/77777777-7777-4777-8777-777777777777.md).
5. [Captura processada](vault/inbox/88888888-8888-4888-8888-888888888888.md).

## Como utilizar na futura PoC

Copiar `vault/` para uma pasta descartável fora do repositório. Não editar estes exemplos para simular execução real. A suíte deverá criar variações de arquivos inválidos, permissão negada, interrupção e backup; esses casos não estão implementados aqui.

A fixture já respeita os seis contratos confirmados em [DECISIONS.md](../DECISIONS.md): os valores de status/prioridade são permitidos; os grupos e tarefas possuem sort_order inteiro; as capturas possuem capture_kind válido. Seus valores não estabelecem defaults. Os 12 registros permanecem intactos nesta correção. Para os demais campos, continuam aplicáveis as propostas remanescentes Q-01/Q-02/Q-03; quando forem fechadas, revisar exemplos, validadores e casos de teste em conjunto. Arquivos de configuração/anexos não foram adicionados porque seu formato ainda precisa de definição.
