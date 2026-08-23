import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

/**
 * Consultas compartilhadas entre servidor e cliente.
 *
 * Todas recebem o client como parametro: no Server Component chega o client de
 * servidor (cookies da sessão) e no browser o client do navegador. A query e a
 * mesma, e o RLS aplica o mesmo recorte de tenant nos dois casos.
 */
export type Db = SupabaseClient<Database>;

const OPEN_STATUSES = "(completed,cancelled)";

export type TableWithOrders = Tables<"tables"> & {
  orders: Pick<
    Tables<"orders">,
    | "id"
    | "number"
    | "status"
    | "created_at"
    | "sent_at"
    | "ready_at"
    | "items_count"
    | "total"
    | "waiter_id"
  >[];
};

/** Salão do garçom: mesas ativas com as comandas ainda abertas. */
export async function fetchTablesWithOrders(db: Db): Promise<TableWithOrders[]> {
  const { data, error } = await db
    .from("tables")
    .select(
      `*, orders(id, number, status, created_at, sent_at, ready_at, items_count, total, waiter_id)`,
    )
    .eq("active", true)
    .not("orders.status", "in", OPEN_STATUSES)
    .order("number", { ascending: true });

  if (error) throw error;
  return (data ?? []) as TableWithOrders[];
}

export type OrderWithItems = Tables<"orders"> & {
  order_items: Tables<"order_items">[];
  tables: Pick<Tables<"tables">, "id" | "number" | "name"> | null;
  waiter: Pick<Tables<"users">, "id" | "name"> | null;
};

/*
 * `users!orders_waiter_same_restaurant` nomeia a foreign key de proposito:
 * orders aponta para users duas vezes (waiter_id e cancelled_by), então um
 * `users(...)` solto seria ambiguo e o PostgREST recusaria a consulta.
 */
const ORDER_SELECT = `
  *,
  order_items(*),
  tables(id, number, name),
  waiter:users!orders_waiter_same_restaurant(id, name)
`;

export async function fetchOrder(db: Db, orderId: string): Promise<OrderWithItems | null> {
  const { data, error } = await db
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw error;
  return data as OrderWithItems | null;
}

/**
 * Comanda aberta da mesa, em qualquer status não finalizado.
 *
 * Se for rascunho, o garçom continua montando; se já foi enviada, os proximos
 * itens entram como adicional. As duas situações usam a mesma tela.
 */
export async function fetchOpenOrderForTable(
  db: Db,
  tableId: string,
): Promise<OrderWithItems | null> {
  const { data, error } = await db
    .from("orders")
    .select(ORDER_SELECT)
    .eq("table_id", tableId)
    .not("status", "in", OPEN_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  return (data?.[0] as OrderWithItems | undefined) ?? null;
}

/** Fila da cozinha, mais antigo primeiro: quem esperou mais sai primeiro. */
export async function fetchKitchenOrders(db: Db): Promise<OrderWithItems[]> {
  const { data, error } = await db
    .from("orders")
    .select(ORDER_SELECT)
    .in("status", ["sent", "received", "preparing", "ready"])
    .order("sent_at", { ascending: true, nullsFirst: true });

  if (error) throw error;
  return (data ?? []) as OrderWithItems[];
}

export async function fetchOpenOrders(db: Db): Promise<OrderWithItems[]> {
  const { data, error } = await db
    .from("orders")
    .select(ORDER_SELECT)
    .not("status", "in", OPEN_STATUSES)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as OrderWithItems[];
}

export async function fetchOrderHistory(
  db: Db,
  { from, to, limit = 100 }: { from?: string; to?: string; limit?: number } = {},
): Promise<OrderWithItems[]> {
  let query = db.from("orders").select(ORDER_SELECT).neq("status", "draft");

  if (from) query = query.gte("business_date", from);
  if (to) query = query.lte("business_date", to);

  const { data, error } = await query
    .order("business_date", { ascending: false })
    .order("number", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as OrderWithItems[];
}

// ---------------------------------------------------------------------------
// Cardápio
// ---------------------------------------------------------------------------

export type MenuCategory = Tables<"categories"> & { products: Tables<"products">[] };

export async function fetchMenu(db: Db, { onlyActive = true } = {}): Promise<MenuCategory[]> {
  let query = db
    .from("categories")
    .select("*, products(*)")
    .order("position", { ascending: true })
    .order("name", { ascending: true })
    .order("position", { ascending: true, referencedTable: "products" })
    .order("name", { ascending: true, referencedTable: "products" });

  if (onlyActive) {
    query = query.eq("active", true).eq("products.active", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as MenuCategory[];
}

export async function fetchProducts(db: Db): Promise<Tables<"products">[]> {
  const { data, error } = await db
    .from("products")
    .select("*")
    .order("position", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchCategories(db: Db): Promise<Tables<"categories">[]> {
  const { data, error } = await db
    .from("categories")
    .select("*")
    .order("position", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchTables(db: Db): Promise<Tables<"tables">[]> {
  const { data, error } = await db.from("tables").select("*").order("number", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchStaff(db: Db): Promise<Tables<"users">[]> {
  const { data, error } = await db
    .from("users")
    .select("*")
    .order("role", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Convites que ainda esperam o primeiro login da pessoa. */
export async function fetchPendingInvitations(db: Db): Promise<Tables<"staff_invitations">[]> {
  const { data, error } = await db
    .from("staff_invitations")
    .select("*")
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** Linha do tempo de um pedido (secao 18): quem fez o que, e quando. */
export async function fetchOrderTimeline(db: Db, orderId: string): Promise<Tables<"audit_logs">[]> {
  const { data, error } = await db
    .from("audit_logs")
    .select("*")
    .eq("entity", "order")
    .eq("entity_id", orderId)
    .order("id", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function fetchAuditLog(db: Db, { limit = 200 } = {}): Promise<Tables<"audit_logs">[]> {
  const { data, error } = await db
    .from("audit_logs")
    .select("*")
    .order("id", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}
