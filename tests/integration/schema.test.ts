import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { createTestDb, seedRestaurant, type TestDb } from "../support/pglite";

/**
 * Valida que as migrations aplicam num Postgres limpo e que os invariantes
 * estruturais do schema existem. Substitui `supabase db reset` onde nao ha
 * Docker (CI incluso).
 */
describe("migrations", () => {
  let db: TestDb;

  beforeAll(async () => {
    db = await createTestDb();
  }, 120_000);

  afterAll(async () => {
    await db?.close();
  });

  it("aplica todas as migrations num banco limpo", async () => {
    const tables = await db.sql<{ table_name: string }>(
      `select table_name from information_schema.tables
       where table_schema = 'public' order by table_name`,
    );

    expect(tables.map((t) => t.table_name)).toEqual([
      "audit_logs",
      "categories",
      "notifications",
      "order_counters",
      "order_items",
      "orders",
      "products",
      "restaurants",
      "staff_invitations",
      "tables",
      "users",
    ]);
  });

  it("mantem RLS habilitado em toda tabela com dado de tenant", async () => {
    const unprotected = await db.sql<{ relname: string }>(
      `select c.relname
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );

    expect(unprotected).toEqual([]);
  });

  it("publica as tabelas operacionais no realtime", async () => {
    const published = await db.sql<{ tablename: string }>(
      `select tablename from pg_publication_tables
       where pubname = 'supabase_realtime' order by tablename`,
    );

    expect(published.map((p) => p.tablename)).toEqual([
      "notifications",
      "order_items",
      "orders",
      "tables",
    ]);
  });

  it("concede a authenticated o privilegio de tocar as tabelas do tenant", async () => {
    /*
     * Privilegio de tabela e RLS sao camadas diferentes, e a falta de cada uma
     * falha de um jeito diferente: sem GRANT vem "permission denied for table",
     * sem policy vem zero linhas. O primeiro caso ja chegou a producao -- o app
     * mostrava "cadastre seu restaurante" para quem tinha um, porque a leitura
     * do perfil era negada e o erro era engolido.
     */
    const semPrivilegio = await db.sql<{ relname: string }>(
      `select c.relname
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relkind = 'r'
         and c.relname <> 'order_counters'
         and not has_table_privilege('authenticated', c.oid, 'SELECT')
       order by c.relname`,
    );

    expect(semPrivilegio).toEqual([]);
  });

  it("mantem o contador de pedidos fora do alcance do cliente", async () => {
    // Manipulado apenas por app.next_order_number(), que e SECURITY DEFINER.
    const [{ tem }] = await db.sql<{ tem: boolean }>(
      `select has_table_privilege('authenticated', 'public.order_counters', 'SELECT') as tem`,
    );

    expect(tem).toBe(false);
  });

  it("nao deixa nenhuma superficie para anon", async () => {
    const acessiveis = await db.sql<{ relname: string }>(
      `select c.relname
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public'
         and c.relkind = 'r'
         and has_table_privilege('anon', c.oid, 'SELECT')
       order by c.relname`,
    );

    expect(acessiveis).toEqual([]);
  });

  it("provisiona restaurante e perfil no cadastro do dono", async () => {
    const seeded = await seedRestaurant(db, "Cantina Bella");

    const [owner] = await db.sql<{ role: string; restaurant_id: string; name: string }>(
      `select role, restaurant_id, name from public.users where id = $1`,
      [seeded.users.admin],
    );

    expect(owner.role).toBe("admin");
    expect(owner.restaurant_id).toBe(seeded.restaurantId);

    const [restaurant] = await db.sql<{ slug: string; status: string }>(
      `select slug, status from public.restaurants where id = $1`,
      [seeded.restaurantId],
    );

    expect(restaurant.slug).toBe("cantina-bella");
    expect(restaurant.status).toBe("trial");
  });

  it("gera slugs distintos para restaurantes homonimos", async () => {
    await seedRestaurant(db, "Bar do Ze");
    const [{ slug }] = await db.sql<{ slug: string }>(
      `insert into public.restaurants (name, slug)
       values ('Bar do Ze', app.unique_restaurant_slug('Bar do Ze')) returning slug`,
    );

    expect(slug).toBe("bar-do-ze-2");
  });
});
