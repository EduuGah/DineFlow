-- ===========================================================================
-- DineFlow / 0007 - Cadastro, realtime e agregacoes do gerente
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Slug do restaurante
-- ---------------------------------------------------------------------------

create or replace function app.slugify(p_text text)
returns text
language sql
immutable
as $$
  select btrim(
    regexp_replace(
      translate(
        lower(btrim(coalesce(p_text, ''))),
        'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
        'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
      ),
      '[^a-z0-9]+', '-', 'g'
    ),
    '-'
  )
$$;

create or replace function app.unique_restaurant_slug(p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text := app.slugify(p_name);
  v_slug text;
  v_suffix integer := 1;
begin
  if length(v_base) < 3 then
    v_base := 'restaurante-' || v_base;
  end if;

  v_base := left(v_base, 50);
  v_slug := v_base;

  while exists (select 1 from public.restaurants r where r.slug = v_slug) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base || '-' || v_suffix;
  end loop;

  return v_slug;
end;
$$;

-- ---------------------------------------------------------------------------
-- Provisionamento do perfil a partir do Supabase Auth
--
-- Dois caminhos entram por aqui:
--   1. Dono cadastrando o restaurante  -> user_metadata.restaurant_name
--   2. Funcionario convidado pelo gerente -> app_metadata.restaurant_id/role
--
-- A distincao importa: app_metadata so pode ser escrito pela service_role, ou
-- seja, um usuario nao consegue se auto-atribuir a um restaurante existente
-- mandando metadados no signup.
-- ---------------------------------------------------------------------------

create or replace function app.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_restaurant_id uuid;
  v_restaurant_name text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'restaurant_name', '')), '');
  v_name text := coalesce(
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'name', '')), ''),
    split_part(new.email, '@', 1)
  );
  v_role public.user_role;
begin
  if exists (select 1 from public.users u where u.id = new.id) then
    return new;
  end if;

  if new.raw_app_meta_data ? 'restaurant_id' then
    v_restaurant_id := (new.raw_app_meta_data ->> 'restaurant_id')::uuid;
    v_role := coalesce((new.raw_app_meta_data ->> 'role')::public.user_role, 'waiter');

    if v_role = 'platform_admin' then
      v_role := 'waiter';
    end if;

  elsif v_restaurant_name is not null then
    insert into public.restaurants (name, slug, status, trial_ends_at)
    values (
      v_restaurant_name,
      app.unique_restaurant_slug(v_restaurant_name),
      'trial',
      now() + interval '14 days'
    )
    returning id into v_restaurant_id;

    v_role := 'admin';

  else
    -- Sem tenant identificavel: o perfil sera criado manualmente
    -- (admin da plataforma via seed/console).
    return new;
  end if;

  insert into public.users (id, restaurant_id, name, email, role, status)
  values (new.id, v_restaurant_id, left(v_name, 120), new.email, v_role, 'active');

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function app.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Espelha papel e tenant no JWT
--
-- Permite ao middleware do Next decidir para onde redirecionar sem consultar o
-- banco a cada navegacao. E APENAS para roteamento: a claim so atualiza no
-- proximo refresh do token, entao nenhuma decisao de acesso a dado depende
-- dela -- essas continuam vindo do RLS, que le a tabela ao vivo.
-- ---------------------------------------------------------------------------

create or replace function app.sync_role_to_auth()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object(
         'role', new.role::text,
         'restaurant_id', new.restaurant_id
       )
  where id = new.id;

  return null;
end;
$$;

create trigger users_sync_role_to_auth
  after insert or update of role, restaurant_id on public.users
  for each row execute function app.sync_role_to_auth();

-- ---------------------------------------------------------------------------
-- Realtime
--
-- O Supabase Realtime reaplica o RLS por assinante: a cozinha do restaurante A
-- nunca recebe o evento de um pedido do restaurante B, mesmo que assine o
-- canal sem filtro.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_items;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.tables;

-- ---------------------------------------------------------------------------
-- Agregacoes do dashboard do gerente
--
-- SECURITY INVOKER (padrao) de proposito: as queries abaixo passam pelo RLS,
-- entao um gerente so agrega os proprios dados.
-- ---------------------------------------------------------------------------

create or replace function public.dashboard_summary(
  p_from date default null,
  p_to date default null
)
returns jsonb
language sql
stable
set search_path = public, pg_catalog
as $$
  with scope as (
    select o.*
    from public.orders o
    where o.business_date between
      coalesce(p_from, app.business_date(o.restaurant_id))
      and coalesce(p_to, app.business_date(o.restaurant_id))
  ),
  durations as (
    select
      extract(epoch from (sent_at - created_at))      as to_send,
      extract(epoch from (started_at - sent_at))      as to_start,
      extract(epoch from (ready_at - started_at))     as to_prepare,
      extract(epoch from (delivered_at - ready_at))   as to_deliver
    from scope
    where status not in ('draft', 'cancelled')
  )
  select jsonb_build_object(
    'orders_total',       (select count(*) from scope where status <> 'draft'),
    'orders_open',        (select count(*) from scope where status in ('sent', 'received', 'preparing')),
    'orders_ready',       (select count(*) from scope where status = 'ready'),
    'orders_delivered',   (select count(*) from scope where status in ('delivered', 'completed')),
    'orders_cancelled',   (select count(*) from scope where status = 'cancelled'),
    'revenue',            (select coalesce(sum(total), 0) from scope where status in ('delivered', 'completed')),
    'average_ticket',     (select coalesce(round(avg(total), 2), 0) from scope where status in ('delivered', 'completed')),
    'tables_occupied',    (select count(*) from public.tables t where t.status <> 'available' and t.active),
    'tables_total',       (select count(*) from public.tables t where t.active),
    'seconds_to_send',    (select round(avg(to_send)) from durations),
    'seconds_to_start',   (select round(avg(to_start)) from durations),
    'seconds_to_prepare', (select round(avg(to_prepare)) from durations),
    'seconds_to_deliver', (select round(avg(to_deliver)) from durations),
    'staff_active',       (select count(*) from public.users u where u.status = 'active')
  )
$$;

comment on function public.dashboard_summary is
  'Metricas operacionais do periodo. SECURITY INVOKER: respeita o RLS do chamador.';

create or replace function public.top_products(
  p_from date default null,
  p_to date default null,
  p_limit integer default 10
)
returns table (
  product_id uuid,
  product_name text,
  quantity bigint,
  revenue numeric
)
language sql
stable
set search_path = public, pg_catalog
as $$
  select
    i.product_id,
    max(i.product_name) as product_name,
    sum(i.quantity)::bigint as quantity,
    sum(i.total_price) as revenue
  from public.order_items i
  join public.orders o on o.id = i.order_id
  where i.status <> 'cancelled'
    and o.status <> 'draft'
    and o.business_date between
      coalesce(p_from, app.business_date(o.restaurant_id))
      and coalesce(p_to, app.business_date(o.restaurant_id))
  group by i.product_id
  order by sum(i.quantity) desc
  limit greatest(1, least(coalesce(p_limit, 10), 50))
$$;

-- ---------------------------------------------------------------------------
-- Progresso do onboarding (secao 31 do roadmap)
-- ---------------------------------------------------------------------------

create or replace function public.onboarding_status()
returns jsonb
language sql
stable
set search_path = public, pg_catalog
as $$
  select jsonb_build_object(
    'tables',    (select count(*) from public.tables where active),
    'categories',(select count(*) from public.categories where active),
    'products',  (select count(*) from public.products where active),
    'waiters',   (select count(*) from public.users where role = 'waiter' and status = 'active'),
    'kitchen',   (select count(*) from public.users where role = 'kitchen' and status = 'active'),
    'completed_at', (
      select r.onboarding_completed_at
      from public.restaurants r
      where r.id = app.current_restaurant_id_unchecked()
    )
  )
$$;
