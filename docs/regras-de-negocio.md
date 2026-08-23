# Regras de negócio

Este documento responde às perguntas da seção 4 do roadmap. Cada resposta está implementada no banco — não é convenção de código.

## Máquina de estados do pedido

```text
   ┌─────────┐
   │  DRAFT  │  garçom montando; a cozinha não vê
   └────┬────┘
        │ enviar
   ┌────▼────┐
   │  SENT   │  na fila da cozinha
   └────┬────┘
        ├──────────────┐
        │              │ aceitar
        │         ┌────▼─────┐
        │         │ RECEIVED │  cozinha confirmou que viu
        │         └────┬─────┘
        │ iniciar      │ iniciar
   ┌────▼──────────────▼────┐
   │      PREPARING         │
   └──────────┬─────────────┘
              │ pronto
        ┌─────▼─────┐
        │   READY   │◄──── reabrir (cozinha) ─── volta para PREPARING
        └─────┬─────┘
              │ entregar
       ┌──────▼──────┐
       │  DELIVERED  │
       └──────┬──────┘
              │ finalizar
       ┌──────▼──────┐
       │  COMPLETED  │  terminal
       └─────────────┘

   Qualquer estado aberto até READY ──► CANCELLED (terminal)
```

Fonte da verdade: `app.order_transition_allowed()` na migration `..._orders.sql`.
Espelho para a interface: `src/domain/orders/state-machine.ts`.

### Transições fora do caminho feliz

| Transição           | Quando acontece                  | Quem pode         |
| ------------------- | -------------------------------- | ----------------- |
| `ready → preparing` | Cozinha marcou pronto por engano | Cozinha, gerência |
| `delivered → ready` | Garçom marcou entrega por engano | Gerência          |
| `ready → sent`      | Entrou um adicional na comanda   | Garçom, gerência  |
| `delivered → sent`  | Adicional depois da entrega      | Garçom, gerência  |

`completed` e `cancelled` são terminais. Não existe caminho de volta — nem por SQL direto, porque o trigger recusa.

## Quem pode alterar cada status

| De → Para                   | Garçom | Cozinha | Gerente / Admin |
| --------------------------- | :----: | :-----: | :-------------: |
| draft → sent                |   ✅   |    —    |       ✅        |
| sent → received / preparing |   —    |   ✅    |       ✅        |
| received → preparing        |   —    |   ✅    |       ✅        |
| preparing → ready           |   —    |   ✅    |       ✅        |
| ready → preparing (reabrir) |   —    |   ✅    |       ✅        |
| ready → delivered           |   ✅   |    —    |       ✅        |
| delivered → completed       |   ✅   |    —    |       ✅        |
| delivered → ready           |   —    |    —    |       ✅        |
| draft → cancelled           |   ✅   |    —    |       ✅        |
| sent/received → cancelled   |   ✅   |   ✅    |       ✅        |
| preparing/ready → cancelled |   —    |   ✅    |       ✅        |

O garçom deixa de poder cancelar assim que a cozinha começa a preparar: naquele momento o insumo já foi gasto e a decisão passa a ser da cozinha ou da gerência.

## Respostas às perguntas do roadmap

**Um pedido pode ser cancelado depois de enviado?**
Sim, até `ready`. Depois de `delivered` não — o cliente já recebeu; o caso vira estorno, que está fora do MVP.

**O garçom pode editar o pedido depois de enviado?**
Não. Item com status diferente de `draft` não aceita mudança de quantidade nem de observação (`app.order_items_before_write`, erro `DF004`). O prato já está sendo feito. Os caminhos são cancelar o pedido ou lançar um adicional.

**Como adicionar itens depois que o pedido já foi enviado?**
Abrindo a mesma mesa e adicionando normalmente. O trigger detecta que não há rodada aberta e cria a próxima (`batch = 2, 3, ...`). Ao enviar, **só a rodada nova** muda de estado — a cozinha não refaz o que já preparou. Se a comanda estava `ready` ou `delivered`, ela volta para `sent` e o evento é registrado como `order.complement_sent`.

**Uma mesa pode ter vários pedidos?**
Pode. O status da mesa é derivado do conjunto de comandas abertas, com esta prioridade:

| Situação                                         | Status da mesa     |
| ------------------------------------------------ | ------------------ |
| Alguma comanda `ready`                           | Pedido pronto      |
| Alguma comanda `sent`, `received` ou `preparing` | Aguardando cozinha |
| Alguma comanda `draft` ou `delivered`            | Ocupada            |
| Nenhuma comanda aberta                           | Livre              |

**Dois garçons podem atender a mesma mesa?**
Sim. Qualquer garçom do restaurante pode agir sobre qualquer pedido — é o que acontece no salão real quando alguém sai para o intervalo. O responsável fica registrado em `orders.waiter_id`, e a auditoria guarda quem fez cada mudança. A tela "Meus pedidos" filtra pelo garçom, mas a aba "Todos abertos" está a um toque.

**Como registrar alterações e cancelamentos?**
Triggers gravam em `audit_logs` a cada mudança de status, item adicionado ou removido, e alteração de cadastro. Nenhum papel tem permissão de INSERT, UPDATE ou DELETE nessa tabela — ela é append-only, escrita apenas pelos triggers.

**Mesa dividida e mesa agrupada?**
Fora do MVP. Hoje cada mesa é independente. Divisão de conta e agrupamento estão na Fase 2 do roadmap (seção 45), e o modelo suporta: várias comandas por mesa já funcionam.

## Cancelamento

Motivo é obrigatório — a constraint `orders_cancellation_consistency` recusa `status = 'cancelled'` sem `cancellation_reason` e sem `cancelled_at`.

| Motivo               | Uso típico                         |
| -------------------- | ---------------------------------- |
| Cliente desistiu     | Cliente saiu antes do prato        |
| Erro do garçom       | Lançou na mesa errada              |
| Produto indisponível | Acabou o ingrediente               |
| Pedido duplicado     | Mesma comanda lançada duas vezes   |
| Outro motivo         | Campo livre obrigatório na prática |

Efeitos: os itens vão para `cancelled`, o total do pedido zera (não entra no faturamento), a cozinha recebe notificação, o pedido continua visível no histórico e o evento fica na auditoria com quem cancelou e por quê.

## Idempotência

Um garçom com pressa clica duas vezes. Uma rede ruim faz o cliente reenviar. Nos dois casos o resultado precisa ser **um** pedido.

Três camadas garantem isso:

1. **`orders.client_request_id`** — UUID gerado no aparelho antes do envio, com índice único por restaurante. O segundo insert é recusado com `23505`.
2. **Id gerado no cliente** — pedido e itens levam UUID escolhido no browser e usado como chave primária. Reenviar a mesma operação colide com a linha existente; a fila trata isso como "já aplicada" e segue em frente.
3. **Transições idempotentes por natureza** — mudar o status para o valor que ele já tem é um no-op: o trigger retorna cedo quando `new.status` é igual a `old.status`.

O id vir do cliente não enfraquece nada: ele identifica uma linha que o usuário já tem permissão de criar, e nenhuma decisão de acesso depende dele — o tenant continua sendo derivado da sessão pelo RLS.

## Numeração dos pedidos

`#104` precisa ser curto e reconhecível pela equipe, então a sequência é por restaurante e por dia operacional, não um contador global. O dia vira às 05:00 no fuso do restaurante: um pedido lançado à 01h ainda pertence ao movimento da noite anterior.

A reserva do número usa `UPDATE ... RETURNING` sobre `order_counters`, que trava a linha. Dois garçons enviando no mesmo instante nunca recebem o mesmo número.

## Preços

`order_items.unit_price` e `product_name` são snapshots gravados pelo trigger a partir de `products`. O payload do cliente é sobrescrito. Duas consequências:

- reajustar o cardápio amanhã não muda o valor das comandas de hoje;
- ninguém consegue lançar um prato de R$ 68 por R$ 0 mexendo na requisição.

## Disponibilidade de produto

`products.active` = existe no cardápio. `products.available` = tem hoje.

A cozinha pode alterar **apenas** `available` — é ela quem descobre primeiro que acabou o hambúrguer. O trigger `app.products_guard_kitchen_update` recusa qualquer outra coluna vinda da cozinha, inclusive preço.

Produto indisponível não pode ser adicionado a um pedido (`DF003`), nem que o UUID seja enviado direto para a API.
