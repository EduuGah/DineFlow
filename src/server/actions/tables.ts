"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertRestaurantPermission } from "./guard";
import { tableSchema } from "@/domain/schemas";
import { fail, ok, type ActionResult } from "@/lib/errors";

function parseTable(formData: FormData) {
  return tableSchema.safeParse({
    number: formData.get("number"),
    name: formData.get("name") || undefined,
    capacity: formData.get("capacity"),
    area: formData.get("area") || undefined,
    active: formData.get("active") === "on" || formData.get("active") === "true",
  });
}

export async function saveTable(_prev: unknown, formData: FormData): Promise<ActionResult<null>> {
  try {
    const session = await assertRestaurantPermission("tables.manage");
    const parsed = parseTable(formData);

    if (!parsed.success) {
      return {
        ok: false,
        error: "Confira os dados da mesa.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const supabase = await createClient();
    const id = formData.get("id") as string | null;

    const payload = {
      number: parsed.data.number,
      name: parsed.data.name,
      capacity: parsed.data.capacity,
      area: parsed.data.area,
      active: parsed.data.active,
    };

    const { error } = id
      ? await supabase.from("tables").update(payload).eq("id", id)
      : await supabase.from("tables").insert({ ...payload, restaurant_id: session.restaurantId });

    if (error) return fail(error);

    revalidatePath("/gerente/mesas");
    revalidatePath("/garcom");
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

export async function deleteTable(id: string): Promise<ActionResult<null>> {
  try {
    await assertRestaurantPermission("tables.manage");
    const supabase = await createClient();

    // Mesa com histórico de pedidos não pode sumir -- levaria o histórico
    // junto. Nesse caso o caminho e desativar.
    const { count } = await supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("table_id", id);

    if ((count ?? 0) > 0) {
      const { error } = await supabase.from("tables").update({ active: false }).eq("id", id);
      if (error) return fail(error);

      revalidatePath("/gerente/mesas");
      revalidatePath("/garcom");
      return {
        ok: false,
        error: "Esta mesa já tem pedidos no histórico, então foi apenas desativada.",
      };
    }

    const { error } = await supabase.from("tables").delete().eq("id", id);
    if (error) return fail(error);

    revalidatePath("/gerente/mesas");
    revalidatePath("/garcom");
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

/**
 * Criacao em lote no onboarding: "tenho 20 mesas" não deveria custar 20
 * formularios.
 */
export async function createTablesInBulk(
  from: number,
  to: number,
  capacity: number,
): Promise<ActionResult<number>> {
  try {
    const session = await assertRestaurantPermission("tables.manage");

    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from) {
      return { ok: false, error: "Informe um intervalo valido de números de mesa." };
    }

    if (to - from >= 200) {
      return { ok: false, error: "Crie no máximo 200 mesas por vez." };
    }

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("tables")
      .select("number")
      .gte("number", from)
      .lte("number", to);

    const taken = new Set((existing ?? []).map((table) => table.number));

    const rows = Array.from({ length: to - from + 1 }, (_, index) => from + index)
      .filter((number) => !taken.has(number))
      .map((number) => ({
        restaurant_id: session.restaurantId,
        number,
        capacity: Math.min(50, Math.max(1, capacity)),
      }));

    if (rows.length === 0) {
      return { ok: false, error: "Todas as mesas desse intervalo já existem." };
    }

    const { error } = await supabase.from("tables").insert(rows);
    if (error) return fail(error);

    revalidatePath("/gerente/mesas");
    revalidatePath("/garcom");
    return ok(rows.length);
  } catch (error) {
    return fail(error);
  }
}
