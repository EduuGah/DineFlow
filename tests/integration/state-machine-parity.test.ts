import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createTestDb, type TestDb } from "../support/pglite";
import {
  ORDER_STATUSES,
  canTransition,
  transitionRoles,
  type OrderStatus,
} from "@/domain/orders/state-machine";

/**
 * A maquina de estados existe em dois lugares: no banco (autoridade) e em
 * TypeScript (para a UI decidir quais botoes mostrar sem round-trip).
 *
 * Duplicacao so e aceitavel com prova de que as duas copias concordam. Este
 * teste percorre as 64 combinacoes de status e falha no primeiro desvio -- se
 * alguem mudar uma regra so de um lado, o CI para.
 */
describe("paridade entre a maquina de estados do banco e a do TypeScript", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  it("concorda sobre quais transicoes existem", async () => {
    const divergences: string[] = [];

    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        const [row] = await db.sql<{ allowed: boolean }>(
          `select app.order_transition_allowed($1::public.order_status, $2::public.order_status) as allowed`,
          [from, to],
        );

        if (row.allowed !== canTransition(from, to)) {
          divergences.push(`${from} -> ${to}: banco=${row.allowed} ts=${canTransition(from, to)}`);
        }
      }
    }

    expect(divergences).toEqual([]);
  });

  it("concorda sobre quem pode fazer cada transicao", async () => {
    const divergences: string[] = [];

    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        // array_to_string em vez do array cru: o driver devolve arrays do
        // Postgres como texto ("{waiter,admin}") e a comparacao ficaria
        // comparando strings malformadas.
        const [row] = await db.sql<{ roles: string }>(
          `select array_to_string(
             app.order_transition_roles($1::public.order_status, $2::public.order_status), ','
           ) as roles`,
          [from, to],
        );

        const fromDb = (row.roles ? row.roles.split(",") : []).sort().join(",");
        const fromTs = [...transitionRoles(from as OrderStatus, to as OrderStatus)]
          .sort()
          .join(",");

        if (fromDb !== fromTs) {
          divergences.push(`${from} -> ${to}: banco=[${fromDb}] ts=[${fromTs}]`);
        }
      }
    }

    expect(divergences).toEqual([]);
  });

  it("usa exatamente os mesmos valores de enum dos dois lados", async () => {
    const rows = await db.sql<{ value: string }>(
      `select unnest(enum_range(null::public.order_status))::text as value`,
    );

    expect(rows.map((r) => r.value)).toEqual([...ORDER_STATUSES]);
  });
});
