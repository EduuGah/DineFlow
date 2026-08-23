-- ===========================================================================
-- DineFlow / 0003 - Mesas e cardapio
--
-- Todas as FKs sao COMPOSTAS por (restaurant_id, id). Isso torna
-- estruturalmente impossivel um produto do restaurante A ser vinculado a uma
-- categoria do restaurante B, mesmo que alguem envie o UUID correto na API.
-- ===========================================================================

create table public.tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  number integer not null check (number > 0 and number <= 9999),
  name text check (name is null or length(btrim(name)) between 1 and 60),
  capacity smallint not null default 4 check (capacity between 1 and 50),
  status public.table_status not null default 'available',
  area text check (area is null or length(btrim(area)) between 1 and 60),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (restaurant_id, number)
);

comment on table public.tables is 'Mesas do salao. O status e derivado dos pedidos abertos pelo trigger de pedidos.';

create unique index tables_restaurant_id_id_key on public.tables (restaurant_id, id);
create index tables_restaurant_status_idx on public.tables (restaurant_id, status) where active;

create trigger tables_set_updated_at
  before update on public.tables
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Categorias
-- ---------------------------------------------------------------------------

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null check (length(btrim(name)) between 2 and 80),
  description text check (description is null or length(description) <= 280),
  position integer not null default 0 check (position >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (restaurant_id, name)
);

create unique index categories_restaurant_id_id_key on public.categories (restaurant_id, id);
create index categories_restaurant_position_idx on public.categories (restaurant_id, position) where active;

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Produtos
-- ---------------------------------------------------------------------------

create table public.products (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  category_id uuid,
  name text not null check (length(btrim(name)) between 2 and 120),
  description text check (description is null or length(description) <= 500),
  price numeric(10, 2) not null check (price >= 0 and price <= 99999.99),
  image_url text,
  -- active  = existe no cardapio (desligar esconde do garcom e do gerente)
  -- available = tem no estoque hoje (desligar mostra "indisponivel" ao garcom)
  active boolean not null default true,
  available boolean not null default true,
  prep_minutes smallint check (prep_minutes is null or prep_minutes between 0 and 600),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Categoria obrigatoriamente do mesmo restaurante.
  -- Sem ON DELETE: excluir categoria com produtos e bloqueado de proposito;
  -- o gerente precisa reatribuir ou desativar antes.
  constraint products_category_same_restaurant
    foreign key (restaurant_id, category_id)
    references public.categories (restaurant_id, id)
);

comment on column public.products.available is
  'Disponibilidade do dia. Produto indisponivel nao pode ser adicionado a um pedido (validado por trigger).';

create unique index products_restaurant_id_id_key on public.products (restaurant_id, id);
create index products_restaurant_category_idx on public.products (restaurant_id, category_id, position) where active;
create index products_restaurant_name_idx on public.products (restaurant_id, lower(name));

create trigger products_set_updated_at
  before update on public.products
  for each row execute function app.set_updated_at();
