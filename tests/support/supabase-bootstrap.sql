-- ===========================================================================
-- Stubs do ambiente Supabase para rodar as migrations do DineFlow no PGlite.
--
-- O Supabase provisiona estes objetos automaticamente em qualquer projeto.
-- Aqui eles sao recriados no minimo necessario para que as migrations de
-- producao rodem sem alteracao -- e para que os testes de RLS exercitem
-- exatamente as mesmas policies que vao para producao.
-- ===========================================================================

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Assinatura identica a do Supabase: le o "sub" do JWT da requisicao atual.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ),
    ''
  )::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'),
    'anon'
  )
$$;

create or replace function auth.email()
returns text
language sql
stable
as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
$$;

create publication supabase_realtime;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;

/*
 * NAO concedemos privilegios padrao aqui, de proposito.
 *
 * Um projeto Supabase costuma vir com `alter default privileges` concedendo
 * tudo em public para anon/authenticated/service_role. Reproduzir isso no teste
 * mascarava um defeito real: as migrations nao concediam privilegio nenhum, e
 * passavam porque o ambiente de teste concedia por elas. Em producao o app
 * quebrava com "permission denied for table users".
 *
 * Deixando os privilegios padrao de fora, o teste exige que as migrations sejam
 * autossuficientes -- que e o que torna o schema instalavel em qualquer
 * Postgres, e nao so num projeto configurado do jeito certo.
 */
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
