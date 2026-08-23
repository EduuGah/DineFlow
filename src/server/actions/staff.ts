"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertRestaurantPermission } from "./guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { staffAccountSchema, staffUpdateSchema } from "@/domain/schemas";
import { fail, ok, type ActionResult } from "@/lib/errors";

/**
 * Cria o acesso de um funcionário: usuário e senha.
 *
 * O restaurante não deveria depender de o garçom ter conta Google de trabalho.
 * Quem dá acesso é o administrador, e a credencial nasce pronta -- basta
 * entregar e-mail e senha para a pessoa.
 *
 * A ordem aqui é o que torna seguro usar a chave que ignora o RLS:
 *
 *   1. assertRestaurantPermission confirma que quem chamou é gerência;
 *   2. restaurant_id vem da SESSÃO, nunca do formulário;
 *   3. só então a chave privilegiada entra, com o escopo já definido.
 *
 * Inverter esses passos transformaria esta action num criador de usuários para
 * qualquer restaurante da plataforma.
 */
export async function createStaffAccount(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<null>> {
  try {
    const session = await assertRestaurantPermission("staff.manage");

    const parsed = staffAccountSchema.safeParse({
      name: formData.get("name"),
      email: formData.get("email"),
      role: formData.get("role"),
      phone: formData.get("phone") || undefined,
      password: formData.get("password"),
    });

    if (!parsed.success) {
      return {
        ok: false,
        error: "Confira os dados do funcionário.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    // Somente o dono cria outro administrador.
    if (parsed.data.role === "admin" && session.profile.role !== "admin") {
      return {
        ok: false,
        error: "Apenas o administrador do restaurante pode criar outro admin.",
      };
    }

    const supabase = await createClient();
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", parsed.data.email)
      .maybeSingle();

    if (existing) {
      return { ok: false, error: "Esse e-mail já faz parte da equipe." };
    }

    const admin = createAdminClient();
    const { error } = await admin.auth.admin.createUser({
      email: parsed.data.email,
      password: parsed.data.password,
      // Sem etapa de confirmação: quem confirma o e-mail é o gerente, ao
      // digitá-lo. O garçom precisa entrar hoje, não abrir caixa de entrada.
      email_confirm: true,
      user_metadata: { name: parsed.data.name },
      // app_metadata só pode ser escrito pela service_role. É daí que o trigger
      // app.handle_new_auth_user() lê o tenant e o papel -- por isso ninguém
      // consegue se auto-vincular a um restaurante.
      app_metadata: {
        restaurant_id: session.restaurantId,
        role: parsed.data.role,
      },
    });

    if (error) {
      if (error.message.toLowerCase().includes("already been registered")) {
        return {
          ok: false,
          error: "Esse e-mail já tem conta no DineFlow. Use outro para este funcionário.",
        };
      }
      return fail(error);
    }

    if (parsed.data.phone) {
      await supabase
        .from("users")
        .update({ phone: parsed.data.phone })
        .eq("email", parsed.data.email);
    }

    revalidatePath("/gerente/funcionarios");
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

/** Define uma nova senha para um funcionário do próprio restaurante. */
export async function resetStaffPassword(
  id: string,
  password: string,
): Promise<ActionResult<null>> {
  try {
    const session = await assertRestaurantPermission("staff.manage");

    if (password.length < 8) {
      return { ok: false, error: "A senha precisa ter pelo menos 8 caracteres." };
    }

    // Confirma pelo client COM RLS que o funcionário é deste restaurante,
    // antes de usar a chave que ignora o RLS.
    const supabase = await createClient();
    const { data: target } = await supabase
      .from("users")
      .select("id, restaurant_id")
      .eq("id", id)
      .maybeSingle();

    if (!target || target.restaurant_id !== session.restaurantId) {
      return { ok: false, error: "Funcionário não encontrado." };
    }

    const admin = createAdminClient();
    const { error } = await admin.auth.admin.updateUserById(id, { password });
    if (error) return fail(error);

    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

export async function updateStaff(_prev: unknown, formData: FormData): Promise<ActionResult<null>> {
  try {
    const session = await assertRestaurantPermission("staff.manage");
    const id = String(formData.get("id") ?? "");

    const parsed = staffUpdateSchema.safeParse({
      name: formData.get("name"),
      role: formData.get("role"),
      phone: formData.get("phone") || undefined,
      status: formData.get("status"),
    });

    if (!parsed.success) {
      return {
        ok: false,
        error: "Confira os dados do funcionário.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    if (parsed.data.role === "admin" && session.profile.role !== "admin") {
      return { ok: false, error: "Apenas o administrador do restaurante pode promover a admin." };
    }

    // Um gerente rebaixando a si mesmo ficaria sem ninguem para gerenciar a
    // equipe; a saida e outro admin fazer isso.
    if (id === session.userId && parsed.data.role !== session.profile.role) {
      return { ok: false, error: "Você não pode alterar o próprio papel." };
    }

    const supabase = await createClient();
    const { error } = await supabase
      .from("users")
      .update({
        name: parsed.data.name,
        role: parsed.data.role,
        phone: parsed.data.phone,
        status: parsed.data.status,
      })
      .eq("id", id);

    if (error) return fail(error);

    revalidatePath("/gerente/funcionarios");
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

/**
 * Desativa em vez de excluir.
 *
 * O funcionário aparece em pedidos e logs de meses atrás; apaga-lo deixaria
 * buracos no histórico que o restaurante precisa manter.
 */
export async function deactivateStaff(id: string): Promise<ActionResult<null>> {
  try {
    const session = await assertRestaurantPermission("staff.manage");

    if (id === session.userId) {
      return { ok: false, error: "Você não pode desativar o próprio acesso." };
    }

    const supabase = await createClient();
    const { error } = await supabase.from("users").update({ status: "inactive" }).eq("id", id);
    if (error) return fail(error);

    revalidatePath("/gerente/funcionarios");
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

export async function reactivateStaff(id: string): Promise<ActionResult<null>> {
  try {
    await assertRestaurantPermission("staff.manage");

    const supabase = await createClient();
    const { error } = await supabase.from("users").update({ status: "active" }).eq("id", id);
    if (error) return fail(error);

    revalidatePath("/gerente/funcionarios");
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}
