import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  createTestDb,
  seedRestaurant,
  type SeededRestaurant,
  type TestDb,
} from "../support/pglite";

/**
 * As funcoes do painel do gerente sao SECURITY INVOKER: passam pelo RLS do
 * chamador. Um erro aqui nao apareceria como falha visivel -- apareceria como
 * um restaurante vendo o faturamento do outro.
 */
describe("agregacoes do painel", () => {
  let db: TestDb;
  let alpha: SeededRestaurant;
  let beta: SeededRestaurant;

  beforeAll(async () => {
    db = await createTestDb();
    alpha = await seedRestaurant(db, "Painel Alpha");
    beta = await seedRestaurant(db, "Painel Beta");

    // Um pedido entregue no Alpha: 2 x 32.50 = 65.00
    const [order] = await db.asUser(alpha.users.waiter, async (session) => {
      const rows = await session.sql<{ id: string }>(
        `insert into public.orders (restaurant_id, table_id, waiter_id)
         values ($1, $2, $3) returning id`,
        [alpha.restaurantId, alpha.tableId, alpha.users.waiter],
      );
      await session.sql(
        `insert into public.order_items (restaurant_id, order_id, product_id, product_name, quantity, unit_price, batch)
         values ($1, $2, $3, 'x', 2, 0, 1)`,
        [alpha.restaurantId, rows[0].id, alpha.productId],
      );
      return rows;
    });

    const move = (userId: string, status: string) =>
      db.asUser(userId, (session) =>
        session.sql(`update public.orders set status = $2 where id = $1`, [order.id, status]),
      );

    await move(alpha.users.waiter, "sent");
    await move(alpha.users.kitchen, "preparing");
    await move(alpha.users.kitchen, "ready");
    await move(alpha.users.waiter, "delivered");

    // Um pedido cancelado no Alpha, para conferir que nao entra no faturamento.
    await db.asUser(alpha.users.waiter, async (session) => {
      const rows = await session.sql<{ id: string }>(
        `insert into public.orders (restaurant_id, table_id, waiter_id)
         values ($1, $2, $3) returning id`,
        [alpha.restaurantId, alpha.tableId, alpha.users.waiter],
      );
      await session.sql(
        `insert into public.order_items (restaurant_id, order_id, product_id, product_name, quantity, unit_price, batch)
         values ($1, $2, $3, 'x', 5, 0, 1)`,
        [alpha.restaurantId, rows[0].id, alpha.productId],
      );
      await session.sql(
        `update public.orders
         set status = 'cancelled', cancellation_reason = 'customer_gave_up'
         where id = $1`,
        [rows[0].id],
      );
    });
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  it("resume o movimento do dia para o gerente", async () => {
    const [row] = await db.asUser(alpha.users.manager, (session) =>
      session.sql<{ summary: Record<string, number> }>(
        `select public.dashboard_summary() as summary`,
      ),
    );

    expect(row.summary.orders_total).toBe(2);
    expect(row.summary.orders_delivered).toBe(1);
    expect(row.summary.orders_cancelled).toBe(1);
    expect(Number(row.summary.revenue)).toBe(65);
    expect(Number(row.summary.average_ticket)).toBe(65);
    expect(row.summary.tables_total).toBe(1);
  });

  it("mede o tempo de cada etapa do pedido", async () => {
    const [row] = await db.asUser(alpha.users.manager, (session) =>
      session.sql<{ summary: Record<string, number | null> }>(
        `select public.dashboard_summary() as summary`,
      ),
    );

    // Os quatro tempos do roadmap precisam existir; os valores sao ~0 porque
    // o teste percorre o fluxo inteiro em milissegundos.
    for (const key of [
      "seconds_to_send",
      "seconds_to_start",
      "seconds_to_prepare",
      "seconds_to_deliver",
    ]) {
      expect(row.summary[key], `${key} deveria ser medido`).not.toBeNull();
    }
  });

  it("nunca mistura o movimento de dois restaurantes", async () => {
    const [row] = await db.asUser(beta.users.manager, (session) =>
      session.sql<{ summary: Record<string, number> }>(
        `select public.dashboard_summary() as summary`,
      ),
    );

    expect(row.summary.orders_total).toBe(0);
    expect(Number(row.summary.revenue)).toBe(0);
  });

  it("lista os produtos mais pedidos, ignorando cancelados", async () => {
    const rows = await db.asUser(alpha.users.manager, (session) =>
      session.sql<{ product_name: string; quantity: string; revenue: string }>(
        `select * from public.top_products()`,
      ),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].product_name).toBe("Hamburguer X");
    // 2 do pedido entregue + 5 do cancelado; os itens cancelados nao contam.
    expect(Number(rows[0].quantity)).toBe(2);
    expect(Number(rows[0].revenue)).toBe(65);
  });

  it("reporta o progresso da configuracao inicial", async () => {
    const [row] = await db.asUser(alpha.users.admin, (session) =>
      session.sql<{ status: Record<string, number | null> }>(
        `select public.onboarding_status() as status`,
      ),
    );

    expect(row.status.tables).toBe(1);
    expect(row.status.categories).toBe(1);
    expect(row.status.products).toBe(1);
    expect(row.status.waiters).toBe(1);
    expect(row.status.kitchen).toBe(1);
    expect(row.status.completed_at).toBeNull();
  });
});
