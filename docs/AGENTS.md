# Instruções específicas da documentação

Aplicam-se as [instruções da raiz](../AGENTS.md).

- Escreva em português, em UTF-8, com títulos hierárquicos, links relativos e blocos de código com linguagem.
- Defina regras uma vez no documento responsável e referencie-o nos demais.
- Use as classificações DECIDIDO, PROPOSTO, PENDENTE, RELATADO e VERIFICADO.
- Não transforme exemplos YAML em enums literais como `"todo | done"`; exemplos devem conter um valor real.
- Campos opcionais, valores nulos e listas vazias têm significados distintos; documente-os.
- Preserve fontes recebidas no arquivo histórico; não reutilize instruções antigas sem conferir a reconciliação.
- Atualize DATA_MODEL, especificação funcional e plano de testes juntos quando um contrato mudar.
- Um plano de teste escrito não é teste implementado nem executado.
