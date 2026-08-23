-- ===========================================================================
-- DineFlow / 0009 - Privilegios de tabela explicitos
--
-- Privilegio de tabela (GRANT) e RLS sao camadas DIFERENTES, e as duas
-- precisam permitir a operacao:
--
--   sem GRANT  -> "permission denied for table users"  (erro)
--   sem policy -> zero linhas                          (silencio)
--
-- Ate aqui o schema dependia dos privilegios padrao que o Supabase configura
-- para objetos criados no schema public. Isso e configuracao do PROJETO, nao
-- do schema: dependendo de qual papel roda a migration, os grants nao chegam a
-- ser aplicados -- e o app quebra com "permission denied" num projeto e
-- funciona em outro, a partir das mesmas migrations.
--
-- Conceder aqui torna o schema autossuficiente: aplicar estas migrations num
-- Postgres vazio produz um banco que funciona, sem depender de nada externo.
-- ===========================================================================

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema app to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- authenticated
--
-- O GRANT libera TOCAR a tabela. QUAIS linhas cada um enxerga ou altera
-- continua sendo decidido exclusivamente pelas policies de RLS -- que ja estao
-- em ..._rls.sql e nao mudam aqui.
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on
  public.restaurants,
  public.users,
  public.tables,
  public.categories,
  public.products,
  public.orders,
  public.order_items,
  public.staff_invitations
to authenticated;

-- Notificacao nasce de trigger (SECURITY DEFINER), nunca do cliente: sem
-- INSERT. O usuario so marca como lida ou apaga a propria.
grant select, update, delete on public.notifications to authenticated;

-- Auditoria e append-only: leitura e so.
grant select on public.audit_logs to authenticated;

-- Contador de pedidos e manipulado apenas por app.next_order_number().
revoke all on public.order_counters from authenticated, anon;

-- ---------------------------------------------------------------------------
-- anon
--
-- O DineFlow nao tem nenhuma superficie anonima: sem sessao, sem dado. Repetido
-- aqui porque a revogacao de ..._rls.sql so alcancou as tabelas que existiam
-- naquele momento -- staff_invitations foi criada depois.
-- ---------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;

-- ---------------------------------------------------------------------------
-- Funcoes chamadas pelo cliente via RPC
-- ---------------------------------------------------------------------------

grant execute on function public.create_restaurant(text) to authenticated;
grant execute on function public.dashboard_summary(date, date) to authenticated;
grant execute on function public.top_products(date, date, integer) to authenticated;
grant execute on function public.onboarding_status() to authenticated;
grant execute on function public.pending_invitations() to authenticated;

-- ---------------------------------------------------------------------------
-- service_role
--
-- A aplicacao nao usa esta chave, mas ferramentas do proprio Supabase
-- (Studio, backups, jobs) contam com ela.
-- ---------------------------------------------------------------------------

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
