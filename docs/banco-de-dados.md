# Banco de dados

## Modelo

```text
restaurants ──┬── users ──────────┐
              ├── tables ─────────┤
              ├── categories ── products ──┐
              │                            │
              └── orders ──────────────────┴── order_items
                     │
                     ├── notifications
                     └── audit_logs
```

Toda tabela operacional carrega `restaurant_id`. Isso é redundante em `order_items` (dá para chegar lá via `orders`), e a redundância é proposital: permite que a policy de RLS decida sem JOIN, e permite as foreign keys compostas descritas abaixo.

## Foreign keys compostas

O padrão mais importante do schema:

```sql
constraint orders_table_same_restaurant
  foreign key (restaurant_id, table_id) references public.tables (restaurant_id, id)
```

A chave não é `table_id → tables.id`, e sim `(restaurant_id, table_id) → (restaurant_id, id)`. Com isso, vincular um pedido do restaurante A a uma mesa do restaurante B é **estruturalmente impossível** — não depende de o código lembrar de checar, nem do RLS. Um UUID válido do tenant errado simplesmente viola a constraint.

O mesmo vale para:

| Tabela        | Referência composta                   |
| ------------- | ------------------------------------- |
| `products`    | categoria do mesmo restaurante        |
| `orders`      | mesa e garçom do mesmo restaurante    |
| `order_items` | pedido e produto do mesmo restaurante |

## Tabelas

### `restaurants`

Tenant raiz. `status` (`trial`, `active`, `suspended`, `cancelled`) controla o acesso operacional: suspenso ou cancelado faz `app.current_restaurant_id()` retornar NULL e todo dado some para aquele restaurante. O cadastro em si continua legível, para a interface conseguir explicar o bloqueio.

### `users`

Perfil. As credenciais ficam em `auth.users`; aqui moram papel, tenant e status. A constraint `users_tenant_scope` garante que `platform_admin` nunca tenha restaurante, e que todos os outros papéis sempre tenham.

### `tables`

Mesas do salão. `status` é derivado pelos triggers de pedido — ninguém muda na mão.

### `categories` / `products`

Cardápio. `active` tira do cadastro, `available` tira do dia. `price` é `numeric(10,2)` com `check (price >= 0)`.

### `orders`

Comanda. Além do status e dos totais derivados, guarda um carimbo por etapa (`sent_at`, `received_at`, `started_at`, `ready_at`, `delivered_at`, `completed_at`, `cancelled_at`) — é daí que saem as métricas de tempo do painel do gerente.

### `order_items`

`batch` separa a rodada original (1) dos adicionais (2+). `total_price` é coluna gerada (`round(unit_price * quantity, 2)`), então nunca sai de sincronia com quantidade e preço.

### `notifications`

Uma linha por destinatário. RLS restringe ao próprio usuário. Nenhum cliente pode inserir — só os triggers.

### `audit_logs`

Append-only. Sem policy de INSERT, UPDATE ou DELETE para nenhum papel. `actor_name` é copiado no momento do evento, para o log continuar legível depois de o funcionário sair. Dados pessoais (e-mail, telefone, avatar) são removidos do metadata por `app.redact_pii()`.

### `order_counters`

Contador `(restaurant_id, business_date) → last_number`. Sem policy nenhuma e com privilégios revogados de `authenticated`: só `app.next_order_number()` toca nela.

## Triggers

| Trigger                            | Tabela        | O que faz                                          |
| ---------------------------------- | ------------- | -------------------------------------------------- |
| `orders_assign_number`             | orders        | Atribui dia operacional e número sequencial        |
| `orders_enforce_transition`        | orders        | Valida a transição, o papel, e carimba os horários |
| `orders_propagate_item_status`     | orders        | Envia só a rodada aberta; entrega/cancela os itens |
| `orders_sync_table_status`         | orders        | Recalcula o status da mesa                         |
| `orders_audit_and_notify`          | orders        | Grava o log e cria as notificações                 |
| `order_items_before_write`         | order_items   | Snapshot de nome/preço, rodada, trava de edição    |
| `order_items_guard_delete`         | order_items   | Impede remover item já enviado                     |
| `order_items_sync_totals`          | order_items   | Recalcula `items_count` e `total`                  |
| `users_guard_privilege_escalation` | users         | Impede alterar o próprio papel/status              |
| `products_guard_kitchen_update`    | products      | Cozinha só muda `available`                        |
| `notifications_guard_update`       | notifications | Só `read_at` pode mudar                            |
| `on_auth_user_created`             | auth.users    | Cria restaurante (dono) ou perfil (convidado)      |
| `users_sync_role_to_auth`          | users         | Espelha papel e tenant no JWT, para roteamento     |

Um detalhe que custou um bug: em PL/pgSQL, `NEW` não existe em trigger de `DELETE` e `OLD` não existe em `INSERT`. Referenciar o registro errado levanta _"record is not assigned yet"_. Por isso as funções que atendem os três eventos ramificam por `TG_OP` em vez de usar `coalesce(new, old)`.

## Índices

Cobrem as três consultas quentes da operação:

```sql
-- fila da cozinha
orders_kitchen_queue_idx (restaurant_id, sent_at) where status in ('sent','received','preparing')

-- salão do garçom
orders_table_open_idx (restaurant_id, table_id) where status not in ('completed','cancelled')

-- histórico do gerente
orders_restaurant_date_idx (restaurant_id, business_date desc, number desc)
```

Índices parciais em vez de completos: numa casa com meses de histórico, a fila da cozinha tem dezenas de linhas, não milhares.

## Migrations

Ficam em `supabase/migrations/`, aplicadas em ordem alfabética.

```bash
npm run db:reset   # recria o banco local e roda o seed
npm run db:push    # aplica no projeto remoto ligado
npm run db:types   # regenera src/types/database.ts
```

Regenere os tipos sempre que criar uma migration. Enquanto não há Supabase local rodando, `src/types/database.ts` é mantido à mão no mesmo formato do gerador.

### Ordem importa mais do que parece

Funções `language sql` têm o corpo validado no momento da criação. As funções de resolução de tenant (`app.current_restaurant_id()` e companhia) leem `public.users`, então precisam ser criadas **depois** da tabela — é por isso que elas vivem na migration de tenancy e não na de fundação.

## Validando sem Docker

`tests/integration/schema.test.ts` aplica todas as migrations num Postgres real rodando em WASM (PGlite), com os objetos do Supabase recriados em `tests/support/supabase-bootstrap.sql`. Roda em CI e serve como `db reset` de bolso:

```bash
npx vitest run tests/integration
```
