# Manual do gerente

## Primeiro dia: configurar

O painel mostra um checklist enquanto a configuração mínima não está pronta. Na ordem:

**1. Mesas** — `Mesas → Criar várias de uma vez`. Informe o intervalo (da 1 até a última) e a quantidade de lugares. Ajuste depois as que forem diferentes.

**2. Categorias** — `Cardápio → Nova categoria`. Crie as seções do cardápio: Entradas, Pratos principais, Bebidas, Sobremesas. A ordem que você definir é a que o garçom vê.

**3. Produtos** — `Cardápio → Novo produto`. Nome e preço bastam. Descrição e tempo de preparo ajudam, mas são opcionais.

**4. Equipe** — `Equipe → Convidar pelo e-mail`. Informe o e-mail da conta Google da pessoa e escolha o papel. Não existe senha: quando ela entrar com o Google desse e-mail, o acesso já aparece vinculado ao restaurante.

O e-mail precisa ser exatamente o da conta Google que a pessoa usa no celular. Enquanto o convite não for usado, ele fica listado em "Convites aguardando o primeiro acesso" e pode ser cancelado a qualquer momento.

| Papel         | O que faz                                             |
| ------------- | ----------------------------------------------------- |
| Garçom        | Abre pedidos, envia para a cozinha, entrega nas mesas |
| Cozinha       | Recebe pedidos, controla o preparo, marca pronto      |
| Gerente       | Tudo acima, mais cardápio, mesas, equipe e relatórios |
| Administrador | Tudo do gerente, mais as configurações do restaurante |

Cada pessoa precisa do **próprio acesso**. É assim que o histórico sabe quem fez o quê — e é a diferença entre "alguém cancelou o pedido 104" e "o João cancelou às 20h42, por desistência do cliente".

## Painel do dia

Números do movimento de hoje:

- **Pedidos, em preparo, prontos, cancelados** — a foto do momento.
- **Faturamento e ticket médio** — considera pedidos entregues e finalizados; cancelados não entram.
- **Tempo médio de cada etapa** — onde o pedido está demorando:

| Etapa                          | O que revela                           |
| ------------------------------ | -------------------------------------- |
| Do lançamento até o envio      | Garçom demorando para fechar a comanda |
| Do envio até a cozinha começar | Fila de espera; cozinha sobrecarregada |
| Preparo                        | Tempo real de produção                 |
| Do pronto até a entrega        | Prato esfriando no balcão              |

- **Mais pedidos hoje** — os cinco itens que mais saíram.

## Histórico

`Histórico` lista todos os pedidos do período, com filtro por data e por status. Cancelados aparecem com o motivo.

Em **Detalhes** você vê os itens e a **linha do tempo** do pedido:

```text
20:32  João Pereira    abriu o pedido
20:33  João Pereira    enviou para a cozinha
20:34  Carlos Lima     iniciou o preparo
20:51  Carlos Lima     marcou como pronto
20:53  Maria Alves     entregou na mesa
```

É a resposta para "onde esse pedido parou?".

## Auditoria

`Auditoria` registra também as mudanças de cadastro: quem alterou preço, quem desativou um produto, quem mudou o papel de um funcionário.

Os registros são gravados pelo banco e **não podem ser editados ou apagados** por ninguém — nem por você.

## Cardápio no dia a dia

- **Acabou o ingrediente?** Use o ícone de olho para marcar indisponível. O produto some da tela do garçom e volta com um toque. A cozinha também pode fazer isso sozinha.
- **Tirar do cardápio de vez?** Desmarque "Ativo no cardápio" ao editar.
- **Excluir?** Só funciona para produto que nunca foi vendido. Se já saiu em alguma comanda, o sistema desativa em vez de excluir — apagar deixaria buracos no histórico.

## Equipe no dia a dia

- **Funcionário saiu:** desative. O acesso é bloqueado na hora e o histórico dele continua íntegro.
- **Trocou de e-mail:** desative o acesso antigo e envie um convite novo para o e-mail atual.
- **Mudou de função:** edite e troque o papel. Você não pode alterar o próprio papel — peça a outro administrador.

## Cancelamentos

Vale olhar os motivos toda semana. Padrões dizem coisas concretas:

| Padrão                       | Provável causa                                    |
| ---------------------------- | ------------------------------------------------- |
| Muito "produto indisponível" | Compras ou estoque desalinhados com o movimento   |
| Muito "erro do garçom"       | Treinamento, ou cardápio confuso na tela          |
| Muito "cliente desistiu"     | Tempo de preparo alto; confira o painel de tempos |
