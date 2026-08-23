"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { restaurantNameSchema } from "@/domain/schemas";
import { fail, ok, type ActionResult } from "@/lib/errors";

/**
 * Cadastro do restaurante no primeiro acesso.
 *
 * Com login via Google nao existe formulario de cadastro: a pessoa chega ja
 * autenticada e sem vinculo. Esta action fecha essa lacuna chamando a funcao
 * `public.create_restaurant`, que cria restaurante e perfil de administrador
 * numa transacao so -- nao existe estado intermediario em que a conta ficaria
 * com restaurante mas sem perfil.
 */
export async function createRestaurant(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<null>> {
  const parsed = restaurantNameSchema.safeParse({ name: formData.get("name") });

  if (!parsed.success) {
    return {
      ok: false,
      error: "Confira o nome do restaurante.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, error: "Sua sessao expirou. Entre novamente." };
    }

    const { error } = await supabase.rpc("create_restaurant", { p_name: parsed.data.name });
    if (error) return fail(error);

    revalidatePath("/", "layout");
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}
