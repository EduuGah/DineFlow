-- ===========================================================================
-- DineFlow / 0008 - Acesso via Google
--
-- Com OAuth o usuario nao preenche formulario de cadastro: ele chega ao
-- sistema ja autenticado, e so entao descobrimos a que restaurante pertence.
-- Isso troca o modelo de provisionamento por dois caminhos explicitos:
--
--   DONO       entra com Google -> sem vinculo -> cria o restaurante (RPC)
--   FUNCIONARIO entra com Google -> convite pendente pelo e-mail -> vinculado
--
-- Codigos de erro novos:
--   DF006  conta ja vinculada a um restaurante
--   DF007  nome de restaurante invalido
-- ===========================================================================

create table public.staff_invitations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  email text not null check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  role public.user_role not null check (role <> 'platform_admin'),
  invited_by uuid references public.users (id) on delete set null,
  accepted_at timestamptz,
  accepted_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.staff_invitations is
  'Convite de acesso. O vinculo com o restaurante e feito no primeiro login com Google, casando pelo e-mail.';

-- Unico convite pendente por e-mail em toda a plataforma.
-- Dois restaurantes convidando a mesma pessoa criaria ambiguidade justamente
-- no momento em que ninguem esta olhando: o primeiro login dela.
create unique index staff_invitations_pending_email_key
  on public.staff_invitations (lower(email))
  where accepted_at is null;

create index staff_invitations_restaurant_idx
  on public.staff_invitations (restaurant_id, created_at desc);

alter table public.staff_invitations enable row level security;

create policy staff_invitations_select on public.staff_invitations
  for select to authenticated
  using (restaurant_id = app.current_restaurant_id() and app.is_manager());

create policy staff_invitations_write on public.staff_invitations
  for all to authenticated
  using (restaurant_id = app.current_restaurant_id() and app.is_manager())
  with check (
    restaurant_id = app.current_restaurant_id()
    and app.is_manager()
    and role <> 'platform_admin'
  );

-- ---------------------------------------------------------------------------
-- Provisionamento no primeiro login
-- ---------------------------------------------------------------------------

create or replace function app.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_restaurant_id uuid;
  v_role public.user_role;
  v_invitation public.staff_invitations%rowtype;
  v_restaurant_name text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'restaurant_name', '')), '');
  -- O Google devolve o nome em full_name; os outros caminhos usam name.
  v_name text := coalesce(
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'name', '')), ''),
    split_part(new.email, '@', 1)
  );
begin
  if exists (select 1 from public.users u where u.id = new.id) then
    return new;
  end if;

  -- 1. Provisionamento pela service_role (scripts, migracao, suporte).
  if new.raw_app_meta_data ? 'restaurant_id' then
    v_restaurant_id := (new.raw_app_meta_data ->> 'restaurant_id')::uuid;
    v_role := coalesce((new.raw_app_meta_data ->> 'role')::public.user_role, 'waiter');

    if v_role = 'platform_admin' then
      v_role := 'waiter';
    end if;

  -- 2. Cadastro com nome de restaurante no metadata (seed e testes).
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
    -- 3. Convite pendente para este e-mail.
    select * into v_invitation
    from public.staff_invitations i
    where lower(i.email) = lower(new.email)
      and i.accepted_at is null
    limit 1;

    if found then
      v_restaurant_id := v_invitation.restaurant_id;
      v_role := v_invitation.role;
    else
      -- 4. Sem vinculo: a aplicacao leva para a tela de criar restaurante.
      return new;
    end if;
  end if;

  insert into public.users (id, restaurant_id, name, email, role, status, avatar_url)
  values (
    new.id,
    v_restaurant_id,
    left(v_name, 120),
    new.email,
    v_role,
    'active',
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'avatar_url', '')), '')
  );

  if v_invitation.id is not null then
    update public.staff_invitations
    set accepted_at = now(), accepted_by = new.id
    where id = v_invitation.id;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Criacao do restaurante pelo proprio dono
--
-- SECURITY DEFINER porque cria as duas linhas que o usuario ainda nao tem
-- permissao de criar: o restaurante (so platform_admin pode inserir) e o
-- proprio perfil (so gerente pode inserir). As duas guardas que substituem o
-- RLS aqui sao explicitas: exige sessao, e recusa quem ja tem vinculo.
-- ---------------------------------------------------------------------------

create or replace function public.create_restaurant(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_email text;
  v_name text;
  v_restaurant_id uuid;
begin
  if v_uid is null then
    raise exception 'Sessao invalida. Entre novamente.' using errcode = 'DF002';
  end if;

  if exists (select 1 from public.users u where u.id = v_uid) then
    raise exception 'Sua conta ja esta vinculada a um restaurante.' using errcode = 'DF006';
  end if;

  if length(btrim(coalesce(p_name, ''))) < 2 then
    raise exception 'Informe o nome do restaurante.' using errcode = 'DF007';
  end if;

  select
    u.email,
    coalesce(
      nullif(btrim(coalesce(u.raw_user_meta_data ->> 'full_name', '')), ''),
      nullif(btrim(coalesce(u.raw_user_meta_data ->> 'name', '')), ''),
      split_part(u.email, '@', 1)
    )
  into v_email, v_name
  from auth.users u
  where u.id = v_uid;

  insert into public.restaurants (name, slug, status, trial_ends_at)
  values (
    left(btrim(p_name), 120),
    app.unique_restaurant_slug(p_name),
    'trial',
    now() + interval '14 days'
  )
  returning id into v_restaurant_id;

  insert into public.users (id, restaurant_id, name, email, role, status)
  values (v_uid, v_restaurant_id, left(v_name, 120), v_email, 'admin', 'active');

  return v_restaurant_id;
end;
$$;

revoke all on function public.create_restaurant(text) from public, anon;
grant execute on function public.create_restaurant(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Convites visiveis para a gerencia, incluindo os ja aceitos
-- ---------------------------------------------------------------------------

create or replace function public.pending_invitations()
returns setof public.staff_invitations
language sql
stable
set search_path = public, pg_catalog
as $$
  select *
  from public.staff_invitations
  where accepted_at is null
  order by created_at desc
$$;
