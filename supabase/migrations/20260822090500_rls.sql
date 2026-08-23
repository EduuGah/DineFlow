-- ===========================================================================
-- DineFlow / 0006 - Row Level Security
--
-- Regra critica do produto (secao 6 do roadmap): um usuario do restaurante A
-- jamais pode ler ou escrever dados do restaurante B. O frontend nao participa
-- dessa garantia -- se alguem chamar a API diretamente com um UUID valido de
-- outro tenant, as policies abaixo devolvem zero linhas.
--
-- Toda policy compara contra app.current_restaurant_id(), que ja embute:
--   - sessao valida
--   - usuario ativo
--   - restaurante nao suspenso
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Privilegios base
-- O DineFlow nao tem nenhuma superficie anonima: sem sessao, sem dado.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;

grant usage on schema app to authenticated, service_role;

alter table public.restaurants     enable row level security;
alter table public.users           enable row level security;
alter table public.tables          enable row level security;
alter table public.categories      enable row level security;
alter table public.products        enable row level security;
alter table public.orders          enable row level security;
alter table public.order_items     enable row level security;
alter table public.notifications   enable row level security;
alter table public.audit_logs      enable row level security;
alter table public.order_counters  enable row level security;

-- order_counters nao tem nenhuma policy: e manipulada exclusivamente por
-- app.next_order_number() (SECURITY DEFINER). Sem policy = ninguem acessa.
revoke all on public.order_counters from authenticated;

-- ===========================================================================
-- restaurants
-- ===========================================================================

create policy restaurants_select on public.restaurants
  for select to authenticated
  using (
    id = app.current_restaurant_id_unchecked()
    or app.is_platform_admin()
  );

comment on policy restaurants_select on public.restaurants is
  'Usa a versao _unchecked para que um restaurante suspenso ainda consiga ler o proprio cadastro e exibir o aviso de bloqueio.';

create policy restaurants_update on public.restaurants
  for update to authenticated
  using (
    (id = app.current_restaurant_id() and app.is_manager())
    or app.is_platform_admin()
  )
  with check (
    (id = app.current_restaurant_id() and app.is_manager())
    or app.is_platform_admin()
  );

create policy restaurants_insert on public.restaurants
  for insert to authenticated
  with check (app.is_platform_admin());

create policy restaurants_delete on public.restaurants
  for delete to authenticated
  using (app.is_platform_admin());

-- ===========================================================================
-- users
-- ===========================================================================

create policy users_select on public.users
  for select to authenticated
  using (
    id = (select auth.uid())
    or restaurant_id = app.current_restaurant_id()
    or app.is_platform_admin()
  );

create policy users_insert on public.users
  for insert to authenticated
  with check (
    restaurant_id = app.current_restaurant_id()
    and app.is_manager()
    and role <> 'platform_admin'
  );

create policy users_update on public.users
  for update to authenticated
  using (
    id = (select auth.uid())
    or (restaurant_id = app.current_restaurant_id() and app.is_manager())
  )
  with check (
    id = (select auth.uid())
    or (restaurant_id = app.current_restaurant_id() and app.is_manager() and role <> 'platform_admin')
  );

create policy users_delete on public.users
  for delete to authenticated
  using (
    restaurant_id = app.current_restaurant_id()
    and app.is_manager()
    and id <> (select auth.uid())
  );

-- ===========================================================================
-- tables / categories / products
-- Leitura: todo mundo do restaurante. Escrita: gerencia.
-- ===========================================================================

create policy tables_select on public.tables
  for select to authenticated
  using (restaurant_id = app.current_restaurant_id());

create policy tables_write on public.tables
  for all to authenticated
  using (restaurant_id = app.current_restaurant_id() and app.is_manager())
  with check (restaurant_id = app.current_restaurant_id() and app.is_manager());

create policy categories_select on public.categories
  for select to authenticated
  using (restaurant_id = app.current_restaurant_id());

create policy categories_write on public.categories
  for all to authenticated
  using (restaurant_id = app.current_restaurant_id() and app.is_manager())
  with check (restaurant_id = app.current_restaurant_id() and app.is_manager());

create policy products_select on public.products
  for select to authenticated
  using (restaurant_id = app.current_restaurant_id());

create policy products_write on public.products
  for all to authenticated
  using (restaurant_id = app.current_restaurant_id() and app.is_manager())
  with check (restaurant_id = app.current_restaurant_id() and app.is_manager());

-- A cozinha e quem descobre primeiro que acabou o hamburguer. Ela pode marcar
-- indisponibilidade -- e apenas isso; o trigger products_guard_kitchen_update
-- bloqueia qualquer outra coluna.
create policy products_kitchen_availability on public.products
  for update to authenticated
  using (restaurant_id = app.current_restaurant_id() and app.has_role('kitchen'))
  with check (restaurant_id = app.current_restaurant_id() and app.has_role('kitchen'));

-- ===========================================================================
-- orders
-- ===========================================================================

create policy orders_select on public.orders
  for select to authenticated
  using (restaurant_id = app.current_restaurant_id());

comment on policy orders_select on public.orders is
  'Todos os papeis do restaurante leem todos os pedidos: a cozinha precisa da fila inteira e dois garcons atendem a mesma mesa (ver docs/regras-de-negocio.md).';

create policy orders_insert on public.orders
  for insert to authenticated
  with check (
    restaurant_id = app.current_restaurant_id()
    and app.has_role('waiter', 'manager', 'admin')
    -- Garcom abre pedido no proprio nome; gerencia pode abrir por outro.
    and (app.is_manager() or waiter_id = (select auth.uid()))
    -- Pedido nasce sempre em rascunho: ninguem insere um pedido ja "pronto".
    and status = 'draft'
  );

create policy orders_update on public.orders
  for update to authenticated
  using (
    restaurant_id = app.current_restaurant_id()
    and app.has_role('waiter', 'kitchen', 'manager', 'admin')
  )
  with check (restaurant_id = app.current_restaurant_id());

comment on policy orders_update on public.orders is
  'O RLS libera a linha; QUEM pode fazer QUAL transicao e decidido pelo trigger app.orders_enforce_transition().';

-- Pedido enviado nunca e apagado, e cancelado (mantem historico e auditoria).
-- Rascunho abandonado pode sumir.
create policy orders_delete on public.orders
  for delete to authenticated
  using (
    restaurant_id = app.current_restaurant_id()
    and status = 'draft'
    and (app.is_manager() or waiter_id = (select auth.uid()))
  );

-- ===========================================================================
-- order_items
-- ===========================================================================

create policy order_items_select on public.order_items
  for select to authenticated
  using (restaurant_id = app.current_restaurant_id());

create policy order_items_write on public.order_items
  for all to authenticated
  using (
    restaurant_id = app.current_restaurant_id()
    and app.has_role('waiter', 'manager', 'admin')
  )
  with check (
    restaurant_id = app.current_restaurant_id()
    and app.has_role('waiter', 'manager', 'admin')
  );

-- ===========================================================================
-- notifications
-- Cada usuario ve apenas as proprias. Insercao so por trigger.
-- ===========================================================================

create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy notifications_delete on public.notifications
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ===========================================================================
-- audit_logs -- append-only, sem INSERT/UPDATE/DELETE para clientes
-- ===========================================================================

create policy audit_logs_select_manager on public.audit_logs
  for select to authenticated
  using (
    (restaurant_id = app.current_restaurant_id() and app.is_manager())
    or app.is_platform_admin()
  );

-- A linha do tempo de um pedido especifico e visivel para toda a equipe:
-- e ela que responde "onde foi que esse pedido parou?".
create policy audit_logs_select_order_timeline on public.audit_logs
  for select to authenticated
  using (restaurant_id = app.current_restaurant_id() and entity = 'order');

-- ===========================================================================
-- Triggers de guarda: o que o RLS nao consegue expressar por coluna
-- ===========================================================================

-- Sem isto, um garcom conseguiria dar UPDATE no proprio perfil trocando
-- role para 'admin'. A policy users_update precisa liberar o self-update
-- (nome, telefone, avatar), entao a trava de escalonamento vem aqui.
create or replace function app.users_guard_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app.is_manager() or app.current_user_role() is null then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.restaurant_id is distinct from old.restaurant_id
     or new.email is distinct from old.email
  then
    raise exception 'Somente a gerencia pode alterar papel, status, restaurante ou e-mail de um usuario.'
      using errcode = 'DF002';
  end if;

  return new;
end;
$$;

create trigger users_guard_privilege_escalation
  before update on public.users
  for each row execute function app.users_guard_privilege_escalation();

-- A cozinha so mexe na disponibilidade do dia, nunca no preco.
create or replace function app.products_guard_kitchen_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not app.has_role('kitchen') then
    return new;
  end if;

  if to_jsonb(new) - 'available' - 'updated_at'
     is distinct from to_jsonb(old) - 'available' - 'updated_at'
  then
    raise exception 'A cozinha pode alterar apenas a disponibilidade do produto.'
      using errcode = 'DF002';
  end if;

  return new;
end;
$$;

create trigger products_guard_kitchen_update
  before update on public.products
  for each row execute function app.products_guard_kitchen_update();

-- Notificacao e registro historico: o usuario so marca como lida.
create or replace function app.notifications_guard_update()
returns trigger
language plpgsql
as $$
begin
  if to_jsonb(new) - 'read_at' is distinct from to_jsonb(old) - 'read_at' then
    raise exception 'Somente o campo read_at pode ser alterado em uma notificacao.'
      using errcode = 'DF002';
  end if;
  return new;
end;
$$;

create trigger notifications_guard_update
  before update on public.notifications
  for each row execute function app.notifications_guard_update();
