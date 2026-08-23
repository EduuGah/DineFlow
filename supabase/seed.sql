-- ===========================================================================
-- DineFlow -- dados de demonstracao
--
-- Roda automaticamente em `supabase db reset` (ambiente local). Tambem pode
-- ser colado no SQL Editor do Supabase para montar um restaurante de exemplo
-- num projeto novo.
--
-- Com login via Google nao existe senha para semear: o vinculo entre pessoa e
-- restaurante acontece por CONVITE. Por isso o seed cria a casa montada
-- (mesas, cardapio) e deixa os convites pendentes -- veja o final do arquivo
-- para liberar o seu proprio e-mail.
-- ===========================================================================

do $$
declare
  v_restaurant uuid;
  v_entradas uuid;
  v_pratos uuid;
  v_bebidas uuid;
  v_sobremesas uuid;
begin
  insert into public.restaurants (name, slug, status, onboarding_completed_at)
  values (
    'Cantina da Esquina',
    app.unique_restaurant_slug('Cantina da Esquina'),
    'active',
    now()
  )
  returning id into v_restaurant;

  -- Salao: 12 mesas, sendo 4 na varanda.
  insert into public.tables (restaurant_id, number, capacity, area)
  select
    v_restaurant,
    n,
    case when n <= 8 then 4 else 6 end,
    case when n <= 8 then 'Salao' else 'Varanda' end
  from generate_series(1, 12) as n;

  -- Cardapio
  insert into public.categories (restaurant_id, name, position)
  values (v_restaurant, 'Entradas', 0) returning id into v_entradas;

  insert into public.categories (restaurant_id, name, position)
  values (v_restaurant, 'Pratos principais', 1) returning id into v_pratos;

  insert into public.categories (restaurant_id, name, position)
  values (v_restaurant, 'Bebidas', 2) returning id into v_bebidas;

  insert into public.categories (restaurant_id, name, position)
  values (v_restaurant, 'Sobremesas', 3) returning id into v_sobremesas;

  insert into public.products (restaurant_id, category_id, name, description, price, prep_minutes, position)
  values
    (v_restaurant, v_entradas, 'Bruschetta', 'Pao italiano, tomate e manjericao', 24.00, 8, 0),
    (v_restaurant, v_entradas, 'Bolinho de bacalhau', 'Seis unidades', 38.00, 12, 1),
    (v_restaurant, v_entradas, 'Batata frita', 'Porcao grande', 32.00, 10, 2),

    (v_restaurant, v_pratos, 'Hamburguer artesanal', 'Blend 180g, queijo e bacon', 42.00, 15, 0),
    (v_restaurant, v_pratos, 'File a parmegiana', 'Acompanha arroz e fritas', 68.00, 25, 1),
    (v_restaurant, v_pratos, 'Risoto de camarao', 'Arroz arborio e camarao rosa', 74.00, 22, 2),
    (v_restaurant, v_pratos, 'Massa ao pesto', 'Talharim fresco', 46.00, 18, 3),
    (v_restaurant, v_pratos, 'Salada Caesar', 'Frango grelhado e croutons', 38.00, 10, 4),

    (v_restaurant, v_bebidas, 'Agua sem gas', '500ml', 6.00, 1, 0),
    (v_restaurant, v_bebidas, 'Refrigerante', 'Lata 350ml', 8.00, 1, 1),
    (v_restaurant, v_bebidas, 'Suco natural', 'Laranja, abacaxi ou maracuja', 14.00, 4, 2),
    (v_restaurant, v_bebidas, 'Chopp', '300ml', 12.00, 2, 3),

    (v_restaurant, v_sobremesas, 'Pudim', 'Fatia generosa', 18.00, 3, 0),
    (v_restaurant, v_sobremesas, 'Petit gateau', 'Com sorvete de creme', 26.00, 12, 1);

  -- Um produto indisponivel, para a tela do garcom ja mostrar esse estado.
  update public.products
  set available = false
  where restaurant_id = v_restaurant and name = 'Risoto de camarao';

  -- Convites de exemplo, um por papel. Trocar pelos e-mails reais da equipe.
  insert into public.staff_invitations (restaurant_id, email, role)
  values
    (v_restaurant, 'dono@dineflow.test', 'admin'),
    (v_restaurant, 'gerente@dineflow.test', 'manager'),
    (v_restaurant, 'garcom@dineflow.test', 'waiter'),
    (v_restaurant, 'cozinha@dineflow.test', 'kitchen');
end;
$$;

-- ---------------------------------------------------------------------------
-- Para entrar neste restaurante de demonstracao:
--
-- Descomente e troque pelo e-mail da SUA conta Google. Depois entre em
-- /entrar -- o convite e consumido no primeiro login e voce ja cai no painel
-- com o cardapio pronto.
--
--   insert into public.staff_invitations (restaurant_id, email, role)
--   select id, 'seu-email@gmail.com', 'admin'
--   from public.restaurants
--   where slug = 'cantina-da-esquina';
-- ---------------------------------------------------------------------------
