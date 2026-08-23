-- ===========================================================================
-- DineFlow / 0002 - Multi-tenant: restaurantes e usuarios
-- ===========================================================================

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$' and length(slug) between 3 and 60),
  logo_url text,
  timezone text not null default 'America/Sao_Paulo',
  status public.restaurant_status not null default 'trial',
  plan text not null default 'basic' check (plan in ('basic', 'pro', 'enterprise')),
  trial_ends_at timestamptz,
  onboarding_completed_at timestamptz,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.restaurants is 'Tenant raiz. Todo dado operacional pendura em restaurant_id.';
comment on column public.restaurants.status is 'suspended/cancelled bloqueiam acesso operacional via app.current_restaurant_id().';

create index restaurants_status_idx on public.restaurants (status);

create trigger restaurants_set_updated_at
  before update on public.restaurants
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Perfil do usuario. As credenciais vivem em auth.users (Supabase Auth);
-- aqui ficam papel, tenant e status operacional.
-- ---------------------------------------------------------------------------

create table public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  restaurant_id uuid references public.restaurants (id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 120),
  email text not null check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  role public.user_role not null default 'waiter',
  status public.user_status not null default 'active',
  phone text check (phone is null or length(btrim(phone)) between 8 and 20),
  avatar_url text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Admin da plataforma nao pertence a nenhum restaurante; todos os demais
  -- papeis obrigatoriamente pertencem a um.
  constraint users_tenant_scope check (
    (role = 'platform_admin' and restaurant_id is null)
    or (role <> 'platform_admin' and restaurant_id is not null)
  )
);

comment on table public.users is 'Perfil/tenant do usuario. auth.users guarda apenas as credenciais.';

-- Necessario para as foreign keys compostas (restaurant_id, user_id) que
-- impedem um pedido de apontar para um garcom de outro restaurante.
create unique index users_restaurant_id_id_key on public.users (restaurant_id, id);

create unique index users_restaurant_email_key
  on public.users (restaurant_id, lower(email))
  where restaurant_id is not null;

create unique index users_platform_admin_email_key
  on public.users (lower(email))
  where restaurant_id is null;

create index users_restaurant_role_idx on public.users (restaurant_id, role) where status = 'active';

create trigger users_set_updated_at
  before update on public.users
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Resolucao de tenant
--
-- Estas funcoes sao SECURITY DEFINER porque precisam ler public.users sem
-- passar pelas policies de public.users -- caso contrario teriamos recursao
-- infinita (a policy de users dependeria dela mesma).
-- ---------------------------------------------------------------------------

-- Restaurante do usuario autenticado, SEM validar status.
-- Usada apenas onde o usuario precisa enxergar o proprio restaurante mesmo
-- suspenso (para ver o aviso de bloqueio, por exemplo).
create or replace function app.current_restaurant_id_unchecked()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.restaurant_id
  from public.users u
  where u.id = (select auth.uid())
$$;

-- Restaurante efetivo do usuario autenticado.
-- Retorna NULL (bloqueando todo acesso a dados operacionais) quando:
--   - nao ha sessao;
--   - o usuario foi desativado;
--   - o restaurante esta suspenso ou cancelado (inadimplencia).
create or replace function app.current_restaurant_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.restaurant_id
  from public.users u
  join public.restaurants r on r.id = u.restaurant_id
  where u.id = (select auth.uid())
    and u.status = 'active'
    and r.status in ('trial', 'active')
$$;

-- Papel do usuario autenticado.
-- Nome com sufixo _user_ porque "current_role" e palavra reservada no SQL.
create or replace function app.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select u.role
  from public.users u
  where u.id = (select auth.uid())
    and u.status = 'active'
$$;

create or replace function app.has_role(variadic p_roles public.user_role[])
returns boolean
language sql
stable
as $$
  select app.current_user_role() = any(p_roles)
$$;

-- Gerente e admin do restaurante compartilham todas as permissoes de gestao.
create or replace function app.is_manager()
returns boolean
language sql
stable
as $$
  select app.has_role('manager', 'admin')
$$;

create or replace function app.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select u.role = 'platform_admin' and u.status = 'active'
      from public.users u
      where u.id = (select auth.uid())
    ),
    false
  )
$$;

-- Data operacional do restaurante (o "dia" do restaurante, no fuso dele).
-- Um pedido feito as 01h da manha ainda pertence ao movimento da noite
-- anterior, por isso o corte usa 05:00 como virada.
create or replace function app.business_date(p_restaurant_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select ((now() at time zone coalesce(r.timezone, 'America/Sao_Paulo')) - interval '5 hours')::date
  from public.restaurants r
  where r.id = p_restaurant_id
$$;

-- ---------------------------------------------------------------------------
-- Numeracao de pedidos por restaurante, reiniciada a cada dia operacional.
-- "Pedido #104" precisa ser curto e reconhecivel pela equipe, entao a
-- sequencia e por (restaurante, dia) e nao um contador global.
-- ---------------------------------------------------------------------------

create table public.order_counters (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  business_date date not null,
  last_number integer not null default 0 check (last_number >= 0),
  primary key (restaurant_id, business_date)
);

comment on table public.order_counters is 'Contador sequencial de pedidos por dia operacional do restaurante.';

-- Reserva o proximo numero de forma atomica: o UPDATE trava a linha, entao
-- dois garcons enviando ao mesmo tempo nunca recebem o mesmo numero.
create or replace function app.next_order_number(p_restaurant_id uuid, p_business_date date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_number integer;
begin
  insert into public.order_counters (restaurant_id, business_date, last_number)
  values (p_restaurant_id, p_business_date, 1)
  on conflict (restaurant_id, business_date)
    do update set last_number = public.order_counters.last_number + 1
  returning last_number into v_number;

  return v_number;
end;
$$;
