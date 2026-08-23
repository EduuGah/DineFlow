"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertRestaurantPermission } from "./guard";
import { categorySchema, productSchema } from "@/domain/schemas";
import { canAny } from "@/domain/permissions";
import { fail, ok, type ActionResult } from "@/lib/errors";

/**
 * Checkbox HTML nao envia nada quando desmarcado -- ler o campo como "true a
 * menos que venha 'false'" faria toda desmarcacao ser ignorada em silencio.
 */
function isChecked(formData: FormData, field: string): boolean {
  const value = formData.get(field);
  return value === "on" || value === "true";
}

function revalidateMenu() {
  revalidatePath("/gerente/cardapio");
  revalidatePath("/garcom");
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

export async function saveCategory(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<null>> {
  try {
    const session = await assertRestaurantPermission("menu.manage");

    const parsed = categorySchema.safeParse({
      name: formData.get("name"),
      description: formData.get("description") || undefined,
      position: formData.get("position") ?? 0,
      active: isChecked(formData, "active"),
    });

    if (!parsed.success) {
      return {
        ok: false,
        error: "Confira os dados da categoria.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const supabase = await createClient();
    const id = formData.get("id") as string | null;

    const { error } = id
      ? await supabase.from("categories").update(parsed.data).eq("id", id)
      : await supabase
          .from("categories")
          .insert({ ...parsed.data, restaurant_id: session.restaurantId });

    if (error) return fail(error);

    revalidateMenu();
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

export async function deleteCategory(id: string): Promise<ActionResult<null>> {
  try {
    await assertRestaurantPermission("menu.manage");
    const supabase = await createClient();

    // O banco bloqueia a exclusao por foreign key; checar antes permite dar
    // uma mensagem util em vez de um erro de constraint.
    const { count } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("category_id", id);

    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error: `Esta categoria tem ${count} produto(s). Mova-os para outra categoria antes de excluir, ou apenas desative a categoria.`,
      };
    }

    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return fail(error);

    revalidateMenu();
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

export async function reorderCategories(ids: string[]): Promise<ActionResult<null>> {
  try {
    await assertRestaurantPermission("menu.manage");
    const supabase = await createClient();

    await Promise.all(
      ids.map((id, index) => supabase.from("categories").update({ position: index }).eq("id", id)),
    );

    revalidateMenu();
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

// ---------------------------------------------------------------------------
// Produtos
// ---------------------------------------------------------------------------

export async function saveProduct(_prev: unknown, formData: FormData): Promise<ActionResult<null>> {
  try {
    const session = await assertRestaurantPermission("menu.manage");

    const parsed = productSchema.safeParse({
      name: formData.get("name"),
      description: formData.get("description") || undefined,
      categoryId: (formData.get("categoryId") as string) || null,
      // O formulario usa virgula decimal, como todo teclado brasileiro.
      price: String(formData.get("price") ?? "").replace(",", "."),
      prepMinutes: formData.get("prepMinutes") || null,
      imageUrl: (formData.get("imageUrl") as string) || null,
      position: formData.get("position") ?? 0,
      active: isChecked(formData, "active"),
      available: isChecked(formData, "available"),
    });

    if (!parsed.success) {
      return {
        ok: false,
        error: "Confira os dados do produto.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const supabase = await createClient();
    const id = formData.get("id") as string | null;

    const payload = {
      name: parsed.data.name,
      description: parsed.data.description,
      category_id: parsed.data.categoryId,
      price: parsed.data.price,
      prep_minutes: parsed.data.prepMinutes,
      image_url: parsed.data.imageUrl,
      position: parsed.data.position,
      active: parsed.data.active,
      available: parsed.data.available,
    };

    const { error } = id
      ? await supabase.from("products").update(payload).eq("id", id)
      : await supabase.from("products").insert({ ...payload, restaurant_id: session.restaurantId });

    if (error) return fail(error);

    revalidateMenu();
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

export async function deleteProduct(id: string): Promise<ActionResult<null>> {
  try {
    await assertRestaurantPermission("menu.manage");
    const supabase = await createClient();

    // Produto ja vendido nao pode ser apagado: as comandas antigas apontam
    // para ele. Desativar tira do cardapio e preserva o historico.
    const { count } = await supabase
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("product_id", id);

    if ((count ?? 0) > 0) {
      const { error } = await supabase.from("products").update({ active: false }).eq("id", id);
      if (error) return fail(error);

      revalidateMenu();
      return {
        ok: false,
        error: "Este produto ja foi vendido, entao foi retirado do cardapio em vez de excluido.",
      };
    }

    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return fail(error);

    revalidateMenu();
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

/**
 * Liga/desliga a disponibilidade do dia.
 *
 * Permitido tambem para a cozinha -- e ela que descobre primeiro que acabou o
 * ingrediente. O trigger products_guard_kitchen_update garante que a cozinha
 * so consiga mudar esta coluna.
 */
export async function setProductAvailability(
  id: string,
  available: boolean,
): Promise<ActionResult<null>> {
  try {
    const session = await assertRestaurantPermission("orders.view_all");

    if (!canAny(session.profile.role, ["menu.manage", "kitchen.view"])) {
      return { ok: false, error: "Voce nao tem permissao para alterar a disponibilidade." };
    }

    const supabase = await createClient();

    const { error } = await supabase.from("products").update({ available }).eq("id", id);
    if (error) return fail(error);

    revalidateMenu();
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}
