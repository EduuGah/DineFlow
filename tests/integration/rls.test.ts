import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  createTestDb,
  seedRestaurant,
  type SeededRestaurant,
  type TestDb,
} from "../support/pglite";

/**
 * Secoes 8 e 26 do roadmap: testes de seguranca.
 *
 * Cada teste aqui simula um atacante que ja tem sessao valida e o UUID correto
 * do alvo -- exatamente o cenario em que "confiar no frontend" falha. Se
 * qualquer um destes passar a devolver dados, o produto nao pode ser vendido
 * para dois restaurantes.
 */
describe("isolamento multi-tenant (RLS)", () => {
  let db: TestDb;
  let alpha: SeededRestaurant;
  let beta: SeededRestaurant;
  let alphaOrderId: string;

  beforeAll(async () => {
    db = await createTestDb();
    alpha = await seedRestaurant(db, "Restaurante Alpha");
    beta = await seedRestaurant(db, "Restaurante Beta");

    const [order] = await db.sql<{ id: string }>(
      `insert into public.orders (restaurant_id, table_id, waiter_id)
       values ($1, $2, $3) returning id`,
      [alpha.restaurantId, alpha.tableId, alpha.users.waiter],
    );
    alphaOrderId = order.id;

    await db.sql(
      `insert into public.order_items (restaurant_id, order_id, product_id, product_name, quantity, unit_price, batch)
       values ($1, $2, $3, 'x', 1, 0, 1)`,
      [alpha.restaurantId, alphaOrderId, alpha.productId],
    );
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  it("nao entrega nenhum dado a uma chamada sem sessao", async () => {
    await db.asAnon(async (session) => {
      for (const table of ["restaurants", "users", "orders", "products", "tables"]) {
        await expect(session.sql(`select * from public.${table}`)).rejects.toThrow(/permission/i);
      }
    });
  });

  it("esconde pedidos de outro restaurante mesmo com sessao valida", async () => {
    const rows = await db.asUser(beta.users.manager, (session) =>
      session.sql(`select id from public.orders where id = $1`, [alphaOrderId]),
    );

    expect(rows).toEqual([]);
  });

  it("ignora update em pedido de outro restaurante (nao levanta erro, nao afeta linha)", async () => {
    await db.asUser(beta.users.kitchen, (session) =>
      session.sql(`update public.orders set status = 'cancelled' where id = $1`, [alphaOrderId]),
    );

    const [order] = await db.sql<{ status: string }>(
      `select status from public.orders where id = $1`,
      [alphaOrderId],
    );

    expect(order.status).toBe("draft");
  });

  it("impede criar pedido em mesa de outro restaurante", async () => {
    await expect(
      db.asUser(beta.users.waiter, (session) =>
        session.sql(
          `insert into public.orders (restaurant_id, table_id, waiter_id) values ($1, $2, $3)`,
          [beta.restaurantId, alpha.tableId, beta.users.waiter],
        ),
      ),
    ).rejects.toThrow(/orders_table_same_restaurant|foreign key/i);
  });

  it("impede forjar restaurant_id para gravar dentro de outro tenant", async () => {
    await expect(
      db.asUser(beta.users.waiter, (session) =>
        session.sql(
          `insert into public.orders (restaurant_id, table_id, waiter_id) values ($1, $2, $3)`,
          [alpha.restaurantId, alpha.tableId, alpha.users.waiter],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("impede adicionar produto de outro restaurante a um pedido", async () => {
    const [order] = await db.sql<{ id: string }>(
      `insert into public.orders (restaurant_id, table_id, waiter_id) values ($1, $2, $3) returning id`,
      [beta.restaurantId, beta.tableId, beta.users.waiter],
    );

    await expect(
      db.asUser(beta.users.waiter, (session) =>
        session.sql(
          `insert into public.order_items (restaurant_id, order_id, product_id, product_name, quantity, unit_price, batch)
           values ($1, $2, $3, 'forjado', 1, 0, 1)`,
          [beta.restaurantId, order.id, alpha.productId],
        ),
      ),
    ).rejects.toThrow(/DF003|Produto nao encontrado/i);
  });

  it("bloqueia o acesso operacional quando o restaurante e suspenso", async () => {
    await db.sql(`update public.restaurants set status = 'suspended' where id = $1`, [
      beta.restaurantId,
    ]);

    const orders = await db.asUser(beta.users.waiter, (session) =>
      session.sql(`select id from public.orders`),
    );
    expect(orders).toEqual([]);

    // ...mas o proprio cadastro continua legivel, para a UI conseguir explicar
    // o bloqueio em vez de mostrar uma tela vazia.
    const restaurants = await db.asUser(beta.users.waiter, (session) =>
      session.sql<{ status: string }>(`select status from public.restaurants`),
    );
    expect(restaurants).toEqual([{ status: "suspended" }]);

    await db.sql(`update public.restaurants set status = 'active' where id = $1`, [
      beta.restaurantId,
    ]);
  });

  it("bloqueia usuario desativado sem precisar revogar o token", async () => {
    await db.sql(`update public.users set status = 'inactive' where id = $1`, [beta.users.waiter]);

    const rows = await db.asUser(beta.users.waiter, (session) =>
      session.sql(`select id from public.orders`),
    );
    expect(rows).toEqual([]);

    await db.sql(`update public.users set status = 'active' where id = $1`, [beta.users.waiter]);
  });
});

describe("permissoes por papel", () => {
  let db: TestDb;
  let seed: SeededRestaurant;

  beforeAll(async () => {
    db = await createTestDb();
    seed = await seedRestaurant(db, "Restaurante Papeis");
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  it("impede o garcom de criar produto", async () => {
    await expect(
      db.asUser(seed.users.waiter, (session) =>
        session.sql(
          `insert into public.products (restaurant_id, name, price) values ($1, 'X', 10)`,
          [seed.restaurantId],
        ),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("impede o garcom de criar mesa", async () => {
    await expect(
      db.asUser(seed.users.waiter, (session) =>
        session.sql(`insert into public.tables (restaurant_id, number) values ($1, 99)`, [
          seed.restaurantId,
        ]),
      ),
    ).rejects.toThrow(/row-level security/i);
  });

  it("impede o garcom de promover a si mesmo a admin", async () => {
    await expect(
      db.asUser(seed.users.waiter, (session) =>
        session.sql(`update public.users set role = 'admin' where id = $1`, [seed.users.waiter]),
      ),
    ).rejects.toThrow(/DF002|Somente a gerencia/i);

    const [user] = await db.sql<{ role: string }>(`select role from public.users where id = $1`, [
      seed.users.waiter,
    ]);
    expect(user.role).toBe("waiter");
  });

  it("permite ao garcom atualizar o proprio nome", async () => {
    await db.asUser(seed.users.waiter, (session) =>
      session.sql(`update public.users set name = 'Joao da Silva' where id = $1`, [
        seed.users.waiter,
      ]),
    );

    const [user] = await db.sql<{ name: string }>(`select name from public.users where id = $1`, [
      seed.users.waiter,
    ]);
    expect(user.name).toBe("Joao da Silva");
  });

  it("deixa a cozinha marcar indisponibilidade, mas nao mexer no preco", async () => {
    await db.asUser(seed.users.kitchen, (session) =>
      session.sql(`update public.products set available = false where id = $1`, [seed.productId]),
    );

    const [product] = await db.sql<{ available: boolean }>(
      `select available from public.products where id = $1`,
      [seed.productId],
    );
    expect(product.available).toBe(false);

    await expect(
      db.asUser(seed.users.kitchen, (session) =>
        session.sql(`update public.products set price = 1 where id = $1`, [seed.productId]),
      ),
    ).rejects.toThrow(/DF002|apenas a disponibilidade/i);

    await db.sql(`update public.products set available = true where id = $1`, [seed.productId]);
  });

  it("esconde a auditoria geral de quem nao e gerente", async () => {
    const asWaiter = await db.asUser(seed.users.waiter, (session) =>
      session.sql(`select id from public.audit_logs where entity <> 'order'`),
    );
    expect(asWaiter).toEqual([]);

    const asManager = await db.asUser(seed.users.manager, (session) =>
      session.sql(`select id from public.audit_logs where entity <> 'order'`),
    );
    expect(asManager.length).toBeGreaterThan(0);
  });

  it("mostra a cada usuario apenas as proprias notificacoes", async () => {
    await db.sql(
      `insert into public.notifications (restaurant_id, user_id, type, title, message)
       values ($1, $2, 'order_ready', 'Pedido pronto', 'Mesa 1')`,
      [seed.restaurantId, seed.users.waiter],
    );

    const waiterView = await db.asUser(seed.users.waiter, (session) =>
      session.sql(`select id from public.notifications`),
    );
    const kitchenView = await db.asUser(seed.users.kitchen, (session) =>
      session.sql(`select id from public.notifications`),
    );

    expect(waiterView.length).toBe(1);
    expect(kitchenView).toEqual([]);
  });
});
