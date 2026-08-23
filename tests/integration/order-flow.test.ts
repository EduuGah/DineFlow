import { describe, expect, it, beforeAll, afterAll } from "vitest";
import {
  createTestDb,
  seedRestaurant,
  type SeededRestaurant,
  type TestDb,
} from "../support/pglite";

/**
 * Secao 26 do roadmap: testes de integracao do fluxo principal.
 *
 * "Um restaurante nao tolera perder um pedido" -- estes testes exercitam o
 * caminho GARCOM -> PEDIDO -> COZINHA -> PRONTO -> GARCOM contra o banco real,
 * com os papeis corretos em cada passo.
 */
describe("fluxo do pedido", () => {
  let db: TestDb;
  let seed: SeededRestaurant;

  beforeAll(async () => {
    db = await createTestDb();
    seed = await seedRestaurant(db, "Restaurante Fluxo");
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  /** Abre um rascunho como garcom e adiciona um item. */
  async function openOrder(quantity = 2) {
    return db.asUser(seed.users.waiter, async (session) => {
      const [order] = await session.sql<{ id: string; number: number }>(
        `insert into public.orders (restaurant_id, table_id, waiter_id)
         values ($1, $2, $3) returning id, number`,
        [seed.restaurantId, seed.tableId, seed.users.waiter],
      );

      await session.sql(
        `insert into public.order_items (restaurant_id, order_id, product_id, product_name, quantity, unit_price, batch, notes)
         values ($1, $2, $3, 'ignorado', $4, 0, 1, 'Sem cebola')`,
        [seed.restaurantId, order.id, seed.productId, quantity],
      );

      return order;
    });
  }

  const setStatus = (userId: string, orderId: string, status: string) =>
    db.asUser(userId, (session) =>
      session.sql(`update public.orders set status = $2 where id = $1`, [orderId, status]),
    );

  const readOrder = async (orderId: string) => {
    const [order] = await db.sql<Record<string, unknown>>(
      `select * from public.orders where id = $1`,
      [orderId],
    );
    return order;
  };

  it("percorre o ciclo completo carimbando cada horario", async () => {
    const order = await openOrder();

    await setStatus(seed.users.waiter, order.id, "sent");
    await setStatus(seed.users.kitchen, order.id, "received");
    await setStatus(seed.users.kitchen, order.id, "preparing");
    await setStatus(seed.users.kitchen, order.id, "ready");
    await setStatus(seed.users.waiter, order.id, "delivered");
    await setStatus(seed.users.waiter, order.id, "completed");

    const final = await readOrder(order.id);

    expect(final.status).toBe("completed");
    for (const stamp of [
      "sent_at",
      "received_at",
      "started_at",
      "ready_at",
      "delivered_at",
      "completed_at",
    ]) {
      expect(final[stamp], `${stamp} deveria estar preenchido`).not.toBeNull();
    }
  });

  it("calcula o total a partir do cardapio, ignorando o preco enviado pelo cliente", async () => {
    const order = await openOrder(2);
    const final = await readOrder(order.id);

    // O produto do seed custa 32.50 e o payload mandou unit_price = 0.
    expect(Number(final.total)).toBe(65);
    expect(final.items_count).toBe(2);

    const [item] = await db.sql<{ unit_price: string; product_name: string }>(
      `select unit_price, product_name from public.order_items where order_id = $1`,
      [order.id],
    );
    expect(Number(item.unit_price)).toBe(32.5);
    expect(item.product_name).toBe("Hamburguer X");
  });

  it("recusa transicao invalida", async () => {
    const order = await openOrder();
    await setStatus(seed.users.waiter, order.id, "sent");

    await expect(setStatus(seed.users.kitchen, order.id, "delivered")).rejects.toThrow(
      /DF001|Transicao invalida/,
    );
  });

  it("recusa transicao feita pelo papel errado", async () => {
    const order = await openOrder();
    await setStatus(seed.users.waiter, order.id, "sent");
    await setStatus(seed.users.kitchen, order.id, "preparing");

    // Marcar pronto e da cozinha; o garcom nao pode antecipar.
    await expect(setStatus(seed.users.waiter, order.id, "ready")).rejects.toThrow(
      /DF002|nao pode mover/,
    );
  });

  it("nao envia comanda vazia para a cozinha", async () => {
    const [order] = await db.asUser(seed.users.waiter, (session) =>
      session.sql<{ id: string }>(
        `insert into public.orders (restaurant_id, table_id, waiter_id)
         values ($1, $2, $3) returning id`,
        [seed.restaurantId, seed.tableId, seed.users.waiter],
      ),
    );

    await expect(setStatus(seed.users.waiter, order.id, "sent")).rejects.toThrow(
      /DF005|Nao ha itens novos/,
    );
  });

  it("rejeita o segundo envio quando o garcom clica duas vezes (idempotencia)", async () => {
    const clientRequestId = "11111111-1111-4111-8111-111111111111";

    const insert = () =>
      db.asUser(seed.users.waiter, (session) =>
        session.sql(
          `insert into public.orders (restaurant_id, table_id, waiter_id, client_request_id)
           values ($1, $2, $3, $4)`,
          [seed.restaurantId, seed.tableId, seed.users.waiter, clientRequestId],
        ),
      );

    await insert();
    await expect(insert()).rejects.toThrow(/duplicate key|orders_restaurant_id_client_request/i);

    const [{ count }] = await db.sql<{ count: string }>(
      `select count(*) from public.orders where client_request_id = $1`,
      [clientRequestId],
    );
    expect(Number(count)).toBe(1);
  });

  it("bloqueia produto indisponivel", async () => {
    await db.sql(`update public.products set available = false where id = $1`, [seed.productId]);

    const [order] = await db.asUser(seed.users.waiter, (session) =>
      session.sql<{ id: string }>(
        `insert into public.orders (restaurant_id, table_id, waiter_id)
         values ($1, $2, $3) returning id`,
        [seed.restaurantId, seed.tableId, seed.users.waiter],
      ),
    );

    await expect(
      db.asUser(seed.users.waiter, (session) =>
        session.sql(
          `insert into public.order_items (restaurant_id, order_id, product_id, product_name, quantity, unit_price, batch)
           values ($1, $2, $3, 'x', 1, 0, 1)`,
          [seed.restaurantId, order.id, seed.productId],
        ),
      ),
    ).rejects.toThrow(/DF003|indisponivel/);

    await db.sql(`update public.products set available = true where id = $1`, [seed.productId]);
  });

  it("congela o item depois que ele foi para a cozinha", async () => {
    const order = await openOrder();
    await setStatus(seed.users.waiter, order.id, "sent");

    const [item] = await db.sql<{ id: string }>(
      `select id from public.order_items where order_id = $1`,
      [order.id],
    );

    await expect(
      db.asUser(seed.users.waiter, (session) =>
        session.sql(`update public.order_items set quantity = 9 where id = $1`, [item.id]),
      ),
    ).rejects.toThrow(/DF004|nao pode ser editado/);

    await expect(
      db.asUser(seed.users.waiter, (session) =>
        session.sql(`delete from public.order_items where id = $1`, [item.id]),
      ),
    ).rejects.toThrow(/DF004|nao pode ser removido/);
  });
});

// ---------------------------------------------------------------------------

describe("pedidos adicionais (complemento)", () => {
  let db: TestDb;
  let seed: SeededRestaurant;

  beforeAll(async () => {
    db = await createTestDb();
    seed = await seedRestaurant(db, "Restaurante Adicional");
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  it("abre uma nova rodada e manda so os itens novos para a cozinha", async () => {
    const [order] = await db.asUser(seed.users.waiter, (session) =>
      session.sql<{ id: string }>(
        `insert into public.orders (restaurant_id, table_id, waiter_id)
         values ($1, $2, $3) returning id`,
        [seed.restaurantId, seed.tableId, seed.users.waiter],
      ),
    );

    const addItem = (quantity: number) =>
      db.asUser(seed.users.waiter, (session) =>
        session.sql(
          `insert into public.order_items (restaurant_id, order_id, product_id, product_name, quantity, unit_price, batch)
           values ($1, $2, $3, 'x', $4, 0, 1)`,
          [seed.restaurantId, order.id, seed.productId, quantity],
        ),
      );

    await addItem(2);
    await db.asUser(seed.users.waiter, (s) =>
      s.sql(`update public.orders set status = 'sent' where id = $1`, [order.id]),
    );
    await db.asUser(seed.users.kitchen, (s) =>
      s.sql(`update public.orders set status = 'preparing' where id = $1`, [order.id]),
    );
    await db.asUser(seed.users.kitchen, (s) =>
      s.sql(`update public.orders set status = 'ready' where id = $1`, [order.id]),
    );

    // Cliente pede uma agua depois que o prato ja ficou pronto.
    await addItem(1);

    const batches = await db.sql<{ batch: number; status: string; quantity: number }>(
      `select batch, status, quantity from public.order_items where order_id = $1 order by batch`,
      [order.id],
    );

    expect(batches).toEqual([
      { batch: 1, status: "sent", quantity: 2 },
      { batch: 2, status: "draft", quantity: 1 },
    ]);

    // A comanda volta para a fila da cozinha...
    await db.asUser(seed.users.waiter, (s) =>
      s.sql(`update public.orders set status = 'sent' where id = $1`, [order.id]),
    );

    const after = await db.sql<{ batch: number; status: string }>(
      `select batch, status from public.order_items where order_id = $1 order by batch`,
      [order.id],
    );

    // ...e apenas a rodada 2 muda de estado: a rodada 1 nao e refeita.
    expect(after).toEqual([
      { batch: 1, status: "sent" },
      { batch: 2, status: "sent" },
    ]);

    const [totals] = await db.sql<{ items_count: number; total: string }>(
      `select items_count, total from public.orders where id = $1`,
      [order.id],
    );
    expect(totals.items_count).toBe(3);
    expect(Number(totals.total)).toBe(97.5);

    const [audit] = await db.sql<{ action: string }>(
      `select action from public.audit_logs
       where entity_id = $1 and action = 'order.complement_sent'`,
      [order.id],
    );
    expect(audit?.action).toBe("order.complement_sent");
  });
});

// ---------------------------------------------------------------------------

describe("cancelamento, notificacoes e auditoria", () => {
  let db: TestDb;
  let seed: SeededRestaurant;

  beforeAll(async () => {
    db = await createTestDb();
    seed = await seedRestaurant(db, "Restaurante Cancel");
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  async function orderWithItem() {
    return db.asUser(seed.users.waiter, async (session) => {
      const [order] = await session.sql<{ id: string; number: number }>(
        `insert into public.orders (restaurant_id, table_id, waiter_id)
         values ($1, $2, $3) returning id, number`,
        [seed.restaurantId, seed.tableId, seed.users.waiter],
      );
      await session.sql(
        `insert into public.order_items (restaurant_id, order_id, product_id, product_name, quantity, unit_price, batch)
         values ($1, $2, $3, 'x', 1, 0, 1)`,
        [seed.restaurantId, order.id, seed.productId],
      );
      return order;
    });
  }

  it("exige motivo para cancelar", async () => {
    const order = await orderWithItem();

    await expect(
      db.asUser(seed.users.waiter, (s) =>
        s.sql(`update public.orders set status = 'cancelled' where id = $1`, [order.id]),
      ),
    ).rejects.toThrow(/orders_cancellation_consistency|check constraint/i);
  });

  it("registra motivo, autor e itens ao cancelar", async () => {
    const order = await orderWithItem();

    await db.asUser(seed.users.waiter, (s) =>
      s.sql(
        `update public.orders
         set status = 'cancelled', cancellation_reason = 'customer_gave_up',
             cancellation_note = 'Cliente desistiu antes do preparo'
         where id = $1`,
        [order.id],
      ),
    );

    const [cancelled] = await db.sql<{ cancelled_by: string; cancelled_at: string }>(
      `select cancelled_by, cancelled_at from public.orders where id = $1`,
      [order.id],
    );
    expect(cancelled.cancelled_by).toBe(seed.users.waiter);
    expect(cancelled.cancelled_at).not.toBeNull();

    const items = await db.sql<{ status: string }>(
      `select status from public.order_items where order_id = $1`,
      [order.id],
    );
    expect(items.every((i) => i.status === "cancelled")).toBe(true);

    // Pedido cancelado nao conta no faturamento, mas fica no historico.
    const [{ total }] = await db.sql<{ total: string }>(
      `select total from public.orders where id = $1`,
      [order.id],
    );
    expect(Number(total)).toBe(0);
  });

  it("notifica a cozinha no envio e o garcom quando fica pronto", async () => {
    const order = await orderWithItem();

    await db.asUser(seed.users.waiter, (s) =>
      s.sql(`update public.orders set status = 'sent' where id = $1`, [order.id]),
    );

    const kitchenNotice = await db.sql<{ title: string; user_id: string }>(
      `select title, user_id from public.notifications where order_id = $1 and type = 'order_sent'`,
      [order.id],
    );
    expect(kitchenNotice.map((n) => n.user_id)).toContain(seed.users.kitchen);
    expect(kitchenNotice[0].title).toBe(`Novo pedido #${order.number}`);

    await db.asUser(seed.users.kitchen, (s) =>
      s.sql(`update public.orders set status = 'preparing' where id = $1`, [order.id]),
    );
    await db.asUser(seed.users.kitchen, (s) =>
      s.sql(`update public.orders set status = 'ready' where id = $1`, [order.id]),
    );

    const [readyNotice] = await db.sql<{ title: string; message: string; user_id: string }>(
      `select title, message, user_id from public.notifications
       where order_id = $1 and type = 'order_ready'`,
      [order.id],
    );
    expect(readyNotice.user_id).toBe(seed.users.waiter);
    expect(readyNotice.title).toBe(`Pedido #${order.number} esta pronto`);
    expect(readyNotice.message).toContain("pronto para retirada");
  });

  it("monta a linha do tempo do pedido na auditoria", async () => {
    const order = await orderWithItem();

    await db.asUser(seed.users.waiter, (s) =>
      s.sql(`update public.orders set status = 'sent' where id = $1`, [order.id]),
    );
    await db.asUser(seed.users.kitchen, (s) =>
      s.sql(`update public.orders set status = 'preparing' where id = $1`, [order.id]),
    );

    const timeline = await db.sql<{ action: string; actor_role: string }>(
      `select action, actor_role from public.audit_logs
       where entity = 'order' and entity_id = $1 order by id`,
      [order.id],
    );

    expect(timeline.map((t) => t.action)).toEqual([
      "order.created",
      "order_item.added",
      "order.sent",
      "order.preparing",
    ]);
    expect(timeline.at(-1)?.actor_role).toBe("kitchen");
  });

  it("nao guarda dado pessoal no log de auditoria", async () => {
    const [log] = await db.sql<{ metadata: Record<string, Record<string, unknown>> }>(
      `select metadata from public.audit_logs where entity = 'user' order by id limit 1`,
    );

    expect(log.metadata.after).toBeDefined();
    expect(log.metadata.after.email).toBeUndefined();
    expect(log.metadata.after.phone).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------

describe("estado da mesa e numeracao", () => {
  let db: TestDb;
  let seed: SeededRestaurant;

  beforeAll(async () => {
    db = await createTestDb();
    seed = await seedRestaurant(db, "Restaurante Mesa");
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  const tableStatus = async () => {
    const [table] = await db.sql<{ status: string }>(
      `select status from public.tables where id = $1`,
      [seed.tableId],
    );
    return table.status;
  };

  it("acompanha o pedido no painel de mesas do garcom", async () => {
    expect(await tableStatus()).toBe("available");

    const [order] = await db.asUser(seed.users.waiter, async (session) => {
      const rows = await session.sql<{ id: string }>(
        `insert into public.orders (restaurant_id, table_id, waiter_id)
         values ($1, $2, $3) returning id`,
        [seed.restaurantId, seed.tableId, seed.users.waiter],
      );
      await session.sql(
        `insert into public.order_items (restaurant_id, order_id, product_id, product_name, quantity, unit_price, batch)
         values ($1, $2, $3, 'x', 1, 0, 1)`,
        [seed.restaurantId, rows[0].id, seed.productId],
      );
      return rows;
    });

    expect(await tableStatus()).toBe("occupied");

    await db.asUser(seed.users.waiter, (s) =>
      s.sql(`update public.orders set status = 'sent' where id = $1`, [order.id]),
    );
    expect(await tableStatus()).toBe("waiting");

    await db.asUser(seed.users.kitchen, (s) =>
      s.sql(`update public.orders set status = 'preparing' where id = $1`, [order.id]),
    );
    expect(await tableStatus()).toBe("waiting");

    await db.asUser(seed.users.kitchen, (s) =>
      s.sql(`update public.orders set status = 'ready' where id = $1`, [order.id]),
    );
    expect(await tableStatus()).toBe("ready");

    await db.asUser(seed.users.waiter, (s) =>
      s.sql(`update public.orders set status = 'delivered' where id = $1`, [order.id]),
    );
    expect(await tableStatus()).toBe("occupied");

    await db.asUser(seed.users.waiter, (s) =>
      s.sql(`update public.orders set status = 'completed' where id = $1`, [order.id]),
    );
    expect(await tableStatus()).toBe("available");
  });

  it("numera os pedidos em sequencia dentro do dia operacional", async () => {
    const numbers: number[] = [];

    for (let i = 0; i < 3; i += 1) {
      const [order] = await db.asUser(seed.users.waiter, (session) =>
        session.sql<{ number: number }>(
          `insert into public.orders (restaurant_id, table_id, waiter_id)
           values ($1, $2, $3) returning number`,
          [seed.restaurantId, seed.tableId, seed.users.waiter],
        ),
      );
      numbers.push(order.number);
    }

    expect(numbers).toEqual([numbers[0], numbers[0] + 1, numbers[0] + 2]);
  });
});
