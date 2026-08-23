-- ===========================================================================
-- DineFlow / 0001 - Fundacao
-- Schema utilitario, enums do dominio e funcoes de resolucao de tenant.
--
-- Regra central do produto: o isolamento entre restaurantes e garantido pelo
-- banco, nunca pelo frontend. Todas as policies desta base derivam das funcoes
-- app.current_restaurant_id() e app.current_user_role() definidas aqui.
-- ===========================================================================

create schema if not exists app;

comment on schema app is
  'Funcoes internas do DineFlow (resolucao de tenant, maquina de estados, triggers). Nao exposta via API.';

-- ---------------------------------------------------------------------------
-- Enums do dominio
-- ---------------------------------------------------------------------------

create type public.user_role as enum (
  'waiter',
  'kitchen',
  'manager',
  'admin',
  'platform_admin'
);

create type public.user_status as enum ('invited', 'active', 'inactive');

create type public.restaurant_status as enum ('trial', 'active', 'suspended', 'cancelled');

create type public.table_status as enum ('available', 'occupied', 'waiting', 'ready', 'closed');

create type public.order_status as enum (
  'draft',
  'sent',
  'received',
  'preparing',
  'ready',
  'delivered',
  'completed',
  'cancelled'
);

create type public.order_item_status as enum (
  'draft',
  'sent',
  'preparing',
  'ready',
  'delivered',
  'cancelled'
);

create type public.cancellation_reason as enum (
  'customer_gave_up',
  'waiter_error',
  'product_unavailable',
  'duplicate',
  'other'
);

create type public.notification_type as enum (
  'order_sent',
  'order_received',
  'order_preparing',
  'order_ready',
  'order_delivered',
  'order_completed',
  'order_cancelled',
  'order_complement'
);

-- ---------------------------------------------------------------------------
-- Trigger utilitario: updated_at
-- ---------------------------------------------------------------------------

create or replace function app.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
