-- ===========================================================================
-- DineFlow / 0004 - Pedidos, itens e maquina de estados
--
-- Codigos de erro (SQLSTATE) usados pela aplicacao para traduzir mensagens:
--   DF001  transicao de status invalida
--   DF002  papel sem permissao para a transicao
--   DF003  produto inexistente / indisponivel
--   DF004  pedido nao editavel no status atual
--   DF005  pedido sem itens para enviar
-- ===========================================================================

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,

  -- Numero curto mostrado a equipe ("Pedido #104"), sequencial por dia.
  -- Preenchido pelo trigger app.orders_before_insert().
  number integer not null,
  business_date date not null,

  table_id uuid not null,
  waiter_id uuid not null,
  status public.order_status not null default 'draft',
  notes text check (notes is null or length(notes) <= 500),

  -- Idempotencia: o cliente gera um UUID antes de enviar. Dois cliques no
  -- botao "Enviar" produzem a mesma chave e o segundo insert e rejeitado
  -- pelo indice unico em vez de criar um pedido duplicado.
  client_request_id uuid not null default gen_random_uuid(),

  -- Derivados, mantidos pelo trigger de itens.
  items_count integer not null default 0 check (items_count >= 0),
  total numeric(12, 2) not null default 0 check (total >= 0),

  cancellation_reason public.cancellation_reason,
  cancellation_note text check (cancellation_note is null or length(cancellation_note) <= 500),
  cancelled_by uuid references public.users (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  received_at timestamptz,
  started_at timestamptz,
  ready_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,

  unique (restaurant_id, business_date, number),
  unique (restaurant_id, client_request_id),

  -- Cancelamento sempre carrega motivo e horario; pedido nao cancelado nunca
  -- carrega nenhum dos dois.
  constraint orders_cancellation_consistency check (
    (status = 'cancelled' and cancellation_reason is not null and cancelled_at is not null)
    or (status <> 'cancelled' and cancellation_reason is null and cancelled_at is null)
  ),

  constraint orders_table_same_restaurant
    foreign key (restaurant_id, table_id) references public.tables (restaurant_id, id),

  constraint orders_waiter_same_restaurant
    foreign key (restaurant_id, waiter_id) references public.users (restaurant_id, id)
);

comment on table public.orders is 'Comanda. O status agregado governa a mesa e a fila da cozinha.';
comment on column public.orders.client_request_id is 'Chave de idempotencia gerada no cliente. Ver docs/regras-de-negocio.md.';

create index orders_restaurant_status_idx on public.orders (restaurant_id, status, created_at);
create index orders_restaurant_date_idx on public.orders (restaurant_id, business_date desc, number desc);
create index orders_table_open_idx on public.orders (restaurant_id, table_id)
  where status not in ('completed', 'cancelled');
create index orders_waiter_idx on public.orders (restaurant_id, waiter_id, created_at desc);
create index orders_kitchen_queue_idx on public.orders (restaurant_id, sent_at)
  where status in ('sent', 'received', 'preparing');

create unique index orders_restaurant_id_id_key on public.orders (restaurant_id, id);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Itens do pedido
--
-- product_name e unit_price sao SNAPSHOTS gravados pelo trigger a partir da
-- tabela products. O cliente nunca escolhe o preco -- se o gerente reajustar
-- o cardapio amanha, a comanda de hoje continua com o valor cobrado hoje.
-- ---------------------------------------------------------------------------

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  order_id uuid not null,
  product_id uuid not null,

  product_name text not null,
  quantity smallint not null check (quantity > 0 and quantity <= 99),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  total_price numeric(12, 2) generated always as (round(unit_price * quantity, 2)) stored,
  notes text check (notes is null or length(notes) <= 280),

  -- Rodada do pedido. batch 1 = pedido original; 2+ = complementos pedidos
  -- depois que a cozinha ja recebeu a comanda.
  batch smallint not null check (batch >= 1),
  status public.order_item_status not null default 'draft',

  sent_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint order_items_order_same_restaurant
    foreign key (restaurant_id, order_id) references public.orders (restaurant_id, id) on delete cascade,

  constraint order_items_product_same_restaurant
    foreign key (restaurant_id, product_id) references public.products (restaurant_id, id)
);

comment on column public.order_items.batch is
  'Rodada: 1 = pedido original, 2+ = adicionais. A cozinha destaca batches novos.';

create index order_items_order_idx on public.order_items (order_id, batch, created_at);
create index order_items_product_idx on public.order_items (restaurant_id, product_id);

create trigger order_items_set_updated_at
  before update on public.order_items
  for each row execute function app.set_updated_at();

-- ===========================================================================
-- Maquina de estados
-- ===========================================================================

create or replace function app.order_transition_allowed(
  p_from public.order_status,
  p_to public.order_status
)
returns boolean
language sql
immutable
as $$
  select case p_from
    when 'draft'     then p_to in ('sent', 'cancelled')
    when 'sent'      then p_to in ('received', 'preparing', 'cancelled')
    when 'received'  then p_to in ('preparing', 'cancelled')
    when 'preparing' then p_to in ('ready', 'cancelled')
    -- ready -> preparing: cozinha reabre um pedido marcado pronto por engano
    -- ready -> sent: um complemento foi enviado e a comanda volta para a fila
    when 'ready'     then p_to in ('preparing', 'delivered', 'sent', 'cancelled')
    -- delivered -> ready: garcom marcou entrega por engano
    when 'delivered' then p_to in ('completed', 'ready', 'sent')
    when 'completed' then false
    when 'cancelled' then false
  end
$$;

comment on function app.order_transition_allowed is
  'Unica fonte de verdade das transicoes no banco. Espelhada em src/domain/orders/state-machine.ts.';

create or replace function app.order_transition_roles(
  p_from public.order_status,
  p_to public.order_status
)
returns public.user_role[]
language sql
immutable
as $$
  select case
    -- Cancelamento: enquanto a cozinha nao comecou, o garcom resolve sozinho.
    -- Depois que virou insumo gasto, so gerencia (ou a cozinha, quando o
    -- motivo e "produto indisponivel").
    when p_to = 'cancelled' and p_from = 'draft'
      then array['waiter', 'manager', 'admin']::public.user_role[]
    when p_to = 'cancelled' and p_from in ('sent', 'received')
      then array['waiter', 'kitchen', 'manager', 'admin']::public.user_role[]
    when p_to = 'cancelled'
      then array['kitchen', 'manager', 'admin']::public.user_role[]

    when p_from = 'draft' and p_to = 'sent'
      then array['waiter', 'manager', 'admin']::public.user_role[]

    when p_to in ('received', 'preparing')
      then array['kitchen', 'manager', 'admin']::public.user_role[]

    when p_from = 'preparing' and p_to = 'ready'
      then array['kitchen', 'manager', 'admin']::public.user_role[]
    when p_from = 'delivered' and p_to = 'ready'
      then array['manager', 'admin']::public.user_role[]

    when p_to = 'delivered'
      then array['waiter', 'manager', 'admin']::public.user_role[]
    when p_to = 'completed'
      then array['waiter', 'manager', 'admin']::public.user_role[]

    -- Reabertura por complemento
    when p_to = 'sent'
      then array['waiter', 'manager', 'admin']::public.user_role[]

    else array[]::public.user_role[]
  end
$$;

-- ---------------------------------------------------------------------------
-- Trigger de insercao: numero sequencial e dia operacional
-- ---------------------------------------------------------------------------

create or replace function app.orders_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.business_date := coalesce(new.business_date, app.business_date(new.restaurant_id));
  new.number := coalesce(new.number, app.next_order_number(new.restaurant_id, new.business_date));
  return new;
end;
$$;

create trigger orders_assign_number
  before insert on public.orders
  for each row execute function app.orders_before_insert();

-- ---------------------------------------------------------------------------
-- Trigger de transicao: valida, autoriza e carimba os horarios
-- ---------------------------------------------------------------------------

create or replace function app.orders_enforce_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
  v_allowed public.user_role[];
  v_pending integer;
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if not app.order_transition_allowed(old.status, new.status) then
    raise exception 'Transicao invalida: pedido nao pode ir de % para %.', old.status, new.status
      using errcode = 'DF001';
  end if;

  v_role := app.current_user_role();

  -- v_role NULL = execucao por service_role, migration ou seed: sem sessao de
  -- usuario nao ha papel a checar (o acesso ja foi barrado antes, pelo RLS).
  if v_role is not null then
    v_allowed := app.order_transition_roles(old.status, new.status);
    if not (v_role = any(v_allowed)) then
      raise exception 'O papel % nao pode mover um pedido de % para %.', v_role, old.status, new.status
        using errcode = 'DF002';
    end if;
  end if;

  -- Nao existe comanda vazia na cozinha.
  if new.status = 'sent' then
    select count(*) into v_pending
    from public.order_items i
    where i.order_id = new.id and i.status = 'draft';

    if v_pending = 0 then
      raise exception 'Nao ha itens novos para enviar a cozinha.'
        using errcode = 'DF005';
    end if;
  end if;

  new.sent_at      := case when new.status = 'sent'      then coalesce(new.sent_at, now())    else new.sent_at end;
  new.received_at  := case when new.status = 'received'  then now()                           else new.received_at end;
  new.started_at   := case when new.status = 'preparing' then coalesce(new.started_at, now()) else new.started_at end;
  new.ready_at     := case when new.status = 'ready'     then now()                           else new.ready_at end;
  new.delivered_at := case when new.status = 'delivered' then now()                           else new.delivered_at end;
  new.completed_at := case when new.status = 'completed' then now()                           else new.completed_at end;

  if new.status = 'cancelled' then
    new.cancelled_at := coalesce(new.cancelled_at, now());
    new.cancelled_by := coalesce(new.cancelled_by, (select auth.uid()));
  end if;

  return new;
end;
$$;

create trigger orders_enforce_transition
  before update on public.orders
  for each row execute function app.orders_enforce_transition();

-- ---------------------------------------------------------------------------
-- Propagacao do status do pedido para os itens
-- ---------------------------------------------------------------------------

create or replace function app.orders_propagate_item_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then
    return null;
  end if;

  if new.status = 'sent' then
    -- So a rodada aberta vai para a cozinha. Itens ja enviados nao sao
    -- reenviados -- e isso que faz o complemento chegar sozinho la.
    update public.order_items
    set status = 'sent', sent_at = now()
    where order_id = new.id and status = 'draft';

  elsif new.status = 'delivered' then
    update public.order_items
    set status = 'delivered', delivered_at = now()
    where order_id = new.id and status = 'sent';

  elsif new.status = 'cancelled' then
    update public.order_items
    set status = 'cancelled', cancelled_at = now()
    where order_id = new.id and status <> 'cancelled';
  end if;

  return null;
end;
$$;

create trigger orders_propagate_item_status
  after update on public.orders
  for each row execute function app.orders_propagate_item_status();

-- ---------------------------------------------------------------------------
-- Itens: snapshot do produto, rodada e trava de edicao
-- ---------------------------------------------------------------------------

create or replace function app.order_items_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_product public.products%rowtype;
  v_batch smallint;
  v_content_changed boolean;
begin
  select * into v_order from public.orders where id = new.order_id;

  if not found then
    raise exception 'Pedido % nao encontrado.', new.order_id using errcode = 'DF004';
  end if;

  if tg_op = 'INSERT' then
    if v_order.status in ('completed', 'cancelled') then
      raise exception 'Pedido #% esta % e nao aceita mais alteracoes.', v_order.number, v_order.status
        using errcode = 'DF004';
    end if;

    select * into v_product
    from public.products
    where id = new.product_id and restaurant_id = v_order.restaurant_id;

    if not found then
      raise exception 'Produto nao encontrado neste restaurante.' using errcode = 'DF003';
    end if;

    if not v_product.active or not v_product.available then
      raise exception 'O produto "%" esta indisponivel.', v_product.name using errcode = 'DF003';
    end if;

    -- Preco e nome vem SEMPRE do cardapio, nunca do payload do cliente.
    new.restaurant_id := v_order.restaurant_id;
    new.product_name := v_product.name;
    new.unit_price := v_product.price;
    new.status := 'draft';
    new.sent_at := null;

    -- A rodada aberta e a que ainda tem itens em rascunho; se nao houver
    -- nenhuma, abre-se a proxima (complemento).
    select min(i.batch) into v_batch
    from public.order_items i
    where i.order_id = new.order_id and i.status = 'draft';

    if v_batch is null then
      select coalesce(max(i.batch), 0) + 1 into v_batch
      from public.order_items i
      where i.order_id = new.order_id;
    end if;

    new.batch := v_batch;

  else
    -- A trava vale para o CONTEUDO do item, nao para o ciclo de vida dele:
    -- os triggers de propagacao precisam poder carimbar status/horarios sem
    -- esbarrar nesta regra.
    v_content_changed := new.quantity is distinct from old.quantity
                      or new.notes is distinct from old.notes;

    if v_content_changed then
      if v_order.status in ('completed', 'cancelled') then
        raise exception 'Pedido #% esta % e nao aceita mais alteracoes.', v_order.number, v_order.status
          using errcode = 'DF004';
      end if;

      -- Item ja enviado a cozinha nao tem quantidade nem observacao mexida
      -- pelo garcom: o prato ja esta sendo feito. O caminho e cancelar o
      -- pedido ou pedir um complemento.
      if old.status <> 'draft' then
        raise exception 'Item ja enviado a cozinha nao pode ser editado.' using errcode = 'DF004';
      end if;
    end if;

    new.restaurant_id := old.restaurant_id;
    new.order_id := old.order_id;
    new.product_id := old.product_id;
    new.product_name := old.product_name;
    new.unit_price := old.unit_price;
    new.batch := old.batch;
  end if;

  return new;
end;
$$;

create trigger order_items_before_write
  before insert or update on public.order_items
  for each row execute function app.order_items_before_write();

create or replace function app.order_items_guard_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status <> 'draft' then
    raise exception 'Item ja enviado a cozinha nao pode ser removido; cancele o pedido.'
      using errcode = 'DF004';
  end if;
  return old;
end;
$$;

create trigger order_items_guard_delete
  before delete on public.order_items
  for each row execute function app.order_items_guard_delete();

-- ---------------------------------------------------------------------------
-- Totais derivados
-- ---------------------------------------------------------------------------

create or replace function app.order_items_sync_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- NEW nao existe em trigger de DELETE (e OLD nao existe em INSERT):
  -- referenciar o registro errado levanta "record is not assigned yet".
  v_order_id uuid := case tg_op when 'DELETE' then old.order_id else new.order_id end;
begin
  update public.orders o
  set items_count = agg.qty,
      total = agg.amount
  from (
    select
      coalesce(sum(i.quantity), 0) as qty,
      coalesce(sum(i.total_price), 0) as amount
    from public.order_items i
    where i.order_id = v_order_id
      and i.status <> 'cancelled'
  ) agg
  where o.id = v_order_id
    and (o.items_count is distinct from agg.qty or o.total is distinct from agg.amount);

  return null;
end;
$$;

create trigger order_items_sync_totals
  after insert or update or delete on public.order_items
  for each row execute function app.order_items_sync_totals();

-- ---------------------------------------------------------------------------
-- Status da mesa derivado dos pedidos abertos
-- ---------------------------------------------------------------------------

create or replace function app.sync_table_status(p_table_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.table_status;
begin
  select case
    when bool_or(o.status = 'ready') then 'ready'
    when bool_or(o.status in ('sent', 'received', 'preparing')) then 'waiting'
    when bool_or(o.status in ('draft', 'delivered')) then 'occupied'
    else 'available'
  end
  into v_status
  from public.orders o
  where o.table_id = p_table_id
    and o.status not in ('completed', 'cancelled');

  update public.tables t
  set status = coalesce(v_status, 'available')
  where t.id = p_table_id
    and t.active
    and t.status is distinct from coalesce(v_status, 'available');
end;
$$;

create or replace function app.orders_sync_table_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform app.sync_table_status(old.table_id);
  else
    perform app.sync_table_status(new.table_id);
    -- Pedido movido de mesa: a mesa antiga tambem precisa ser reavaliada.
    if tg_op = 'UPDATE' and old.table_id is distinct from new.table_id then
      perform app.sync_table_status(old.table_id);
    end if;
  end if;
  return null;
end;
$$;

create trigger orders_sync_table_status
  after insert or update or delete on public.orders
  for each row execute function app.orders_sync_table_status();
