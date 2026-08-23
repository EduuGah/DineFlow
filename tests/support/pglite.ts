import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
const BOOTSTRAP = path.join(ROOT, "tests", "support", "supabase-bootstrap.sql");

/**
 * Banco de teste: Postgres real (PGlite/WASM) com as migrations de producao
 * aplicadas na ordem. Sem Docker, o que mantem os testes de RLS rodando em CI.
 */
export type TestDb = {
  pg: PGlite;
  /** Executa como superusuario: setup, fixtures e asserts fora do RLS. */
  sql<T = Record<string, unknown>>(query: string, params?: unknown[]): Promise<T[]>;
  /** Executa como `authenticated` com o JWT do usuario -- o RLS vale aqui. */
  asUser<T>(userId: string, fn: (db: TestDb) => Promise<T>): Promise<T>;
  /** Executa sem sessao, como o role `anon` faria numa chamada direta a API. */
  asAnon<T>(fn: (db: TestDb) => Promise<T>): Promise<T>;
  close(): Promise<void>;
};

export async function migrationFiles(): Promise<string[]> {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries.filter((file) => file.endsWith(".sql")).sort();
}

export async function createTestDb(): Promise<TestDb> {
  const pg = await PGlite.create();

  await pg.exec(await readFile(BOOTSTRAP, "utf8"));

  for (const file of await migrationFiles()) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    try {
      await pg.exec(sql);
    } catch (error) {
      throw new Error(`Falha ao aplicar a migration ${file}: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }

  const db: TestDb = {
    pg,
    async sql(query, params) {
      const result = await pg.query(query, params as never[]);
      return result.rows as never;
    },
    async asUser(userId, fn) {
      await pg.exec(
        `select set_config('request.jwt.claims', '${JSON.stringify({
          sub: userId,
          role: "authenticated",
        })}', false);
         set role authenticated;`,
      );
      try {
        return await fn(db);
      } finally {
        await pg.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
      }
    },
    async asAnon(fn) {
      await pg.exec(`select set_config('request.jwt.claims', '', false); set role anon;`);
      try {
        return await fn(db);
      } finally {
        await pg.exec(`reset role;`);
      }
    },
    async close() {
      await pg.close();
    },
  };

  return db;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

export type SeededRestaurant = {
  restaurantId: string;
  users: Record<string, string>;
  tableId: string;
  categoryId: string;
  productId: string;
};

/**
 * Cria um restaurante completo: dono, garcom, cozinha, uma mesa, uma categoria
 * e um produto. O dono e criado pelo caminho real (trigger em auth.users), o
 * que tambem exercita o provisionamento de cadastro.
 */
export async function seedRestaurant(db: TestDb, name: string): Promise<SeededRestaurant> {
  const slugBase = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const [owner] = await db.sql<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data)
     values ($1, jsonb_build_object('name', $2::text, 'restaurant_name', $3::text))
     returning id`,
    [`dono@${slugBase}.test`, `Dono ${name}`, name],
  );

  const [restaurant] = await db.sql<{ id: string }>(
    `select restaurant_id as id from public.users where id = $1`,
    [owner.id],
  );
  const restaurantId = restaurant.id;

  const users: Record<string, string> = { admin: owner.id };

  for (const role of ["waiter", "kitchen", "manager"] as const) {
    const [created] = await db.sql<{ id: string }>(
      `insert into auth.users (email, raw_user_meta_data, raw_app_meta_data)
       values ($1, jsonb_build_object('name', $2::text),
               jsonb_build_object('restaurant_id', $3::text, 'role', $4::text))
       returning id`,
      [`${role}@${slugBase}.test`, `${role} ${name}`, restaurantId, role],
    );
    users[role] = created.id;
  }

  const [table] = await db.sql<{ id: string }>(
    `insert into public.tables (restaurant_id, number, capacity) values ($1, 1, 4) returning id`,
    [restaurantId],
  );

  const [category] = await db.sql<{ id: string }>(
    `insert into public.categories (restaurant_id, name) values ($1, 'Pratos') returning id`,
    [restaurantId],
  );

  const [product] = await db.sql<{ id: string }>(
    `insert into public.products (restaurant_id, category_id, name, price)
     values ($1, $2, 'Hamburguer X', 32.50) returning id`,
    [restaurantId, category.id],
  );

  return {
    restaurantId,
    users,
    tableId: table.id,
    categoryId: category.id,
    productId: product.id,
  };
}
