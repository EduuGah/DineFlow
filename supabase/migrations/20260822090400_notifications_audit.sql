-- ===========================================================================
-- DineFlow / 0005 - Notificacoes e auditoria
--
-- Auditoria e notificacao sao efeitos do banco, nao da aplicacao. Se alguem
-- alterar um pedido por SQL direto, o log e a notificacao acontecem do mesmo
-- jeito -- que e exatamente o que um cliente real vai cobrar quando um pedido
-- "sumir".
-- ===========================================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  order_id uuid references public.orders (id) on delete cascade,
  type public.notification_type not null,
  title text not null check (length(btrim(title)) between 1 and 120),
  message text not null check (length(btrim(message)) between 1 and 300),
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

create index notifications_user_recent_idx on public.notifications (user_id, created_at desc);
create index notifications_order_idx on public.notifications (order_id);

-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id bigint generated always as identity primary key,
  restaurant_id uuid references public.restaurants (id) on delete cascade,
  user_id uuid references public.users (id) on delete set null,
  -- Nome copiado no momento do evento: o log continua legivel mesmo depois de
  -- o funcionario ser excluido do sistema.
  actor_name text,
  actor_role public.user_role,
  action text not null check (length(action) between 3 and 80),
  entity text not null check (length(entity) between 2 and 40),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_restaurant_recent_idx on public.audit_logs (restaurant_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity, entity_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (restaurant_id, user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- LGPD (secao 25 do roadmap): o log de auditoria registra O QUE mudou, nao
-- dados pessoais. Contato e imagem sao removidos antes de virar historico.
create or replace function app.redact_pii(p_row jsonb)
returns jsonb
language sql
immutable
as $$
  select p_row - 'email' - 'phone' - 'avatar_url'
$$;

create or replace function app.write_audit(
  p_restaurant_id uuid,
  p_action text,
  p_entity text,
  p_entity_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user public.users%rowtype;
begin
  select * into v_user from public.users where id = (select auth.uid());

  insert into public.audit_logs
    (restaurant_id, user_id, actor_name, actor_role, action, entity, entity_id, metadata)
  values
    (
      p_restaurant_id,
      v_user.id,
      coalesce(v_user.name, 'sistema'),
      v_user.role,
      p_action,
      p_entity,
      p_entity_id,
      coalesce(p_metadata, '{}'::jsonb)
    );
end;
$$;

create or replace function app.notify_users(
  p_restaurant_id uuid,
  p_user_ids uuid[],
  p_order_id uuid,
  p_type public.notification_type,
  p_title text,
  p_message text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications
    (restaurant_id, user_id, order_id, type, title, message, metadata)
  select p_restaurant_id, u.id, p_order_id, p_type, p_title, p_message, coalesce(p_metadata, '{}'::jsonb)
  from public.users u
  where u.id = any(p_user_ids)
    and u.status = 'active';
end;
$$;

create or replace function app.kitchen_user_ids(p_restaurant_id uuid)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(u.id), array[]::uuid[])
  from public.users u
  where u.restaurant_id = p_restaurant_id
    and u.status = 'active'
    and u.role in ('kitchen', 'manager', 'admin')
$$;

-- ---------------------------------------------------------------------------
-- Auditoria e notificacao dos pedidos
-- ---------------------------------------------------------------------------

create or replace function app.orders_audit_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.write_audit(
    new.restaurant_id,
    'order.created',
    'order',
    new.id,
    jsonb_build_object('number', new.number, 'table_id', new.table_id)
  );
  return null;
end;
$$;

create trigger orders_audit_insert
  after insert on public.orders
  for each row execute function app.orders_audit_insert();

create or replace function app.orders_audit_and_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table_number integer;
  v_is_complement boolean := old.status in ('ready', 'delivered') and new.status = 'sent';
begin
  if new.status is not distinct from old.status then
    return null;
  end if;

  select t.number into v_table_number from public.tables t where t.id = new.table_id;

  perform app.write_audit(
    new.restaurant_id,
    case when v_is_complement then 'order.complement_sent' else 'order.' || new.status::text end,
    'order',
    new.id,
    jsonb_build_object(
      'number', new.number,
      'from', old.status,
      'to', new.status,
      'table_number', v_table_number,
      'reason', new.cancellation_reason,
      'reason_note', new.cancellation_note
    )
  );

  if new.status = 'sent' then
    perform app.notify_users(
      new.restaurant_id,
      app.kitchen_user_ids(new.restaurant_id),
      new.id,
      case when v_is_complement then 'order_complement' else 'order_sent' end::public.notification_type,
      case when v_is_complement then 'Adicional no pedido #' || new.number
           else 'Novo pedido #' || new.number end,
      'Mesa ' || coalesce(v_table_number::text, '?') || ' enviou ' || new.items_count || ' item(ns).',
      jsonb_build_object('order_number', new.number, 'table_number', v_table_number)
    );

  elsif new.status = 'preparing' then
    perform app.notify_users(
      new.restaurant_id,
      array[new.waiter_id],
      new.id,
      'order_preparing',
      'Pedido #' || new.number || ' em preparo',
      'A cozinha comecou a preparar o pedido da mesa ' || coalesce(v_table_number::text, '?') || '.',
      jsonb_build_object('order_number', new.number, 'table_number', v_table_number)
    );

  elsif new.status = 'ready' then
    perform app.notify_users(
      new.restaurant_id,
      array[new.waiter_id],
      new.id,
      'order_ready',
      'Pedido #' || new.number || ' esta pronto',
      'Mesa ' || coalesce(v_table_number::text, '?') || ' - pronto para retirada.',
      jsonb_build_object('order_number', new.number, 'table_number', v_table_number)
    );

  elsif new.status = 'cancelled' then
    perform app.notify_users(
      new.restaurant_id,
      app.kitchen_user_ids(new.restaurant_id) || array[new.waiter_id],
      new.id,
      'order_cancelled',
      'Pedido #' || new.number || ' cancelado',
      'Mesa ' || coalesce(v_table_number::text, '?') || ' - ' ||
        coalesce(new.cancellation_note, new.cancellation_reason::text, 'sem motivo informado') || '.',
      jsonb_build_object('order_number', new.number, 'table_number', v_table_number)
    );
  end if;

  return null;
end;
$$;

create trigger orders_audit_and_notify
  after update on public.orders
  for each row execute function app.orders_audit_and_notify();

-- ---------------------------------------------------------------------------
-- Auditoria dos itens
-- ---------------------------------------------------------------------------

create or replace function app.order_items_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.order_items%rowtype;
  v_number integer;
begin
  if tg_op = 'DELETE' then
    v_row := old;
  else
    v_row := new;
  end if;

  select o.number into v_number from public.orders o where o.id = v_row.order_id;

  perform app.write_audit(
    v_row.restaurant_id,
    case tg_op when 'INSERT' then 'order_item.added' else 'order_item.removed' end,
    'order',
    v_row.order_id,
    jsonb_build_object(
      'order_number', v_number,
      'product', v_row.product_name,
      'quantity', v_row.quantity,
      'batch', v_row.batch,
      'notes', v_row.notes
    )
  );

  return null;
end;
$$;

create trigger order_items_audit
  after insert or delete on public.order_items
  for each row execute function app.order_items_audit();

-- ---------------------------------------------------------------------------
-- Auditoria generica das entidades de configuracao
-- (mesas, categorias, produtos, funcionarios)
-- ---------------------------------------------------------------------------

create or replace function app.audit_config_entity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity text := tg_argv[0];
  v_restaurant_id uuid;
  v_entity_id uuid;
  v_metadata jsonb;
  v_before jsonb;
  v_after jsonb;
begin
  if tg_op <> 'INSERT' then
    v_before := app.redact_pii(to_jsonb(old));
  end if;

  if tg_op <> 'DELETE' then
    v_after := app.redact_pii(to_jsonb(new));
  end if;

  v_restaurant_id := (coalesce(v_after, v_before) ->> 'restaurant_id')::uuid;
  v_entity_id := (coalesce(v_after, v_before) ->> 'id')::uuid;

  v_metadata := jsonb_strip_nulls(jsonb_build_object('before', v_before, 'after', v_after));

  perform app.write_audit(
    v_restaurant_id,
    v_entity || '.' || lower(tg_op),
    v_entity,
    v_entity_id,
    v_metadata
  );

  return null;
end;
$$;

create trigger tables_audit
  after insert or update or delete on public.tables
  for each row execute function app.audit_config_entity('table');

create trigger categories_audit
  after insert or update or delete on public.categories
  for each row execute function app.audit_config_entity('category');

create trigger products_audit
  after insert or update or delete on public.products
  for each row execute function app.audit_config_entity('product');

create trigger users_audit
  after insert or update or delete on public.users
  for each row execute function app.audit_config_entity('user');
