# Arquitetura

## Forma geral

Monólito modular, organizado por domínio. Nada de microserviços antes de existir necessidade real — mas com as fronteiras nos lugares certos, para que separar depois seja possível.

```text
                       ┌─────────────────────┐
                       │  Next.js (App Router)│
                       │  Server Components   │
                       │  Client Components   │
                       │  Server Actions      │
                       └──────────┬───────────┘
                                  │  sessão em cookie
                       ┌──────────▼───────────┐
                       │  Supabase            │
                       │  Auth · PostgREST    │
                       │  Realtime            │
                       └──────────┬───────────┘
                                  │
                       ┌──────────▼───────────┐
                       │  Postgres            │
                       │  RLS · triggers      │
                       │  máquina de estados  │
                       └──────────────────────┘
```

## Onde cada decisão mora

A pergunta que organiza o projeto é: **se alguém chamar a API direto, sem passar pela tela, o que continua valendo?**

| Decisão                             | Onde é aplicada                                | Por quê                                                     |
| ----------------------------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| A qual restaurante o dado pertence  | RLS no Postgres                                | Único lugar que nenhum cliente consegue contornar           |
| Quais transições de status existem  | Trigger `app.orders_enforce_transition`        | Vale para a UI, para a API e para SQL manual                |
| Quem pode fazer cada transição      | O mesmo trigger, via `app.current_user_role()` | Papel lido da tabela ao vivo, não do token                  |
| Preço e nome do item                | Trigger `app.order_items_before_write`         | Snapshot vem do cardápio; o payload do cliente é ignorado   |
| Qual botão aparece na tela          | `src/domain/orders/state-machine.ts`           | Evita round-trip; espelha o banco e o CI garante a paridade |
| Para onde redirecionar após o login | `src/proxy.ts` + `src/domain/permissions.ts`   | Roteamento, não segurança                                   |

O TypeScript **duplica** as regras da máquina de estados de propósito, para a interface não precisar consultar o servidor só para saber se mostra "Marcar pronto". Duplicação só é aceitável com prova de que as cópias concordam: `tests/integration/state-machine-parity.test.ts` percorre as 64 combinações de status e falha se as duas divergirem.

## Caminhos de escrita

Existem dois, escolhidos por característica da operação:

**1. Server Actions** — cadastro e configuração (mesas, cardápio, equipe).
Passam por `assertRestaurantPermission()` antes de qualquer query. São operações de escritório: se a rede cair, o gerente tenta de novo.

**2. Client Supabase + fila local** — operação do salão (abrir pedido, adicionar item, mudar status).
Escrevem direto pelo client do browser, que carrega a sessão do usuário e portanto continua sujeito ao RLS. A diferença é que passam pela fila em `src/lib/offline/outbox.ts`: se a rede falhar, a operação fica gravada no aparelho e sai sozinha depois.

Um garçom no meio do movimento não pode perder um pedido porque o Wi-Fi oscilou. Um gerente cadastrando produto pode simplesmente clicar de novo.

## Leitura

Server Components carregam o estado inicial (`fetchTablesWithOrders`, `fetchKitchenOrders`, ...) usando o client de servidor, com a sessão vinda do cookie. O mesmo módulo `src/lib/queries` é reutilizado no browser para as recargas disparadas por eventos de realtime — a query é idêntica, e o RLS aplica o mesmo recorte nos dois lados.

Todas as páginas de operação usam `export const dynamic = "force-dynamic"`: não há nada a cachear entre requisições quando o dado muda a cada pedido.

## Camadas de autorização

```text
1. proxy.ts        → tem sessão? o papel pode abrir esta rota?   (roteamento)
2. requirePermission → a página pode ser renderizada?            (interface)
3. assertPermission  → a Server Action pode executar?            (endpoint)
4. RLS + triggers    → esta linha pode ser lida/escrita?          (verdade)
```

As três primeiras existem para dar boa experiência: redirecionar em vez de mostrar tela vazia, esconder botão que iria falhar. A quarta é a que segura. Se as três primeiras sumissem, o sistema continuaria correto — só ficaria desagradável de usar.

## Escala

O modelo suporta a evolução prevista sem redesenho:

- **Um restaurante grande** (20 garçons, 100 mesas, 1000 pedidos/dia): os índices parciais em `orders` cobrem as três consultas quentes (fila da cozinha, mesas abertas, pedidos do garçom).
- **Muitos restaurantes**: todo dado é particionável por `restaurant_id`, e as assinaturas de realtime já são filtradas por tenant.
- **Separar serviços depois**: a cozinha (KDS) e a operação do salão já são módulos independentes que conversam por eventos do banco, não por chamadas diretas entre si.

O que ainda não foi feito é medir: teste de carga e piloto real são as seções 41–43 do roadmap.
