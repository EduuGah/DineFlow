"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertRestaurantPermission } from "./guard";
import { invitationSchema, staffUpdateSchema } from "@/domain/schemas";
import { fail, ok, type ActionResult } from "@/lib/errors";

/**
 * Convite de acesso.
 *
 * Com login via Google o gerente nao cria credencial nenhuma -- ele autoriza
 * um e-mail. Quando a pessoa entra com a conta Google correspondente, o
 * trigger `app.handle_new_auth_user` encontra o convite e faz o vinculo.
 *
 * O `restaurant_id` vem da SESSAO, nunca do formulario: sem isso a action
 * viraria um meio de inserir funcionario em qualquer restaurante da
 * plataforma.
 */
export async function inviteStaff(_prev: unknown, formData: FormData): Promise<ActionResult<null>> {
  try {
    const session = await assertRestaurantPermission("staff.manage");

    const parsed = invitationSchema.safeParse({
      email: formData.get("email"),
      role: formData.get("role"),
    });

    if (!parsed.success) {
      return {
        ok: false,
        error: "Confira os dados do convite.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    // Somente o dono cria outro administrador.
    if (parsed.data.role === "admin" && session.profile.role !== "admin") {
      return {
        ok: false,
        error: "Apenas o administrador do restaurante pode convidar outro admin.",
      };
    }

    const supabase = await createClient();

    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", parsed.data.email)
      .maybeSingle();

    if (existing) {
      return { ok: false, error: "Esse e-mail ja faz parte da equipe." };
    }

    const { error } = await supabase.from("staff_invitations").insert({
      restaurant_id: session.restaurantId,
      email: parsed.data.email,
      role: parsed.data.role,
      invited_by: session.userId,
    });

    if (error) {
      if (error.code === "23505") {
        return {
          ok: false,
          error: "Ja existe um convite pendente para esse e-mail.",
        };
      }
      return fail(error);
    }

    revalidatePath("/gerente/funcionarios");
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

export async function revokeInvitation(id: string): Promise<ActionResult<null>> {
  try {
    await assertRestaurantPermission("staff.manage");

    const supabase = await createClient();
    const { error } = await supabase
      .from("staff_invitations")
      .delete()
      .eq("id", id)
      .is("accepted_at", null);

    if (error) return fail(error);

    revalidatePath("/gerente/funcionarios");
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
        error: "Confira os dados do funcionario.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    if (parsed.data.role === "admin" && session.profile.role !== "admin") {
      return { ok: false, error: "Apenas o administrador do restaurante pode promover a admin." };
    }

    // Um gerente rebaixando a si mesmo ficaria sem ninguem para gerenciar a
    // equipe; a saida e outro admin fazer isso.
    if (id === session.userId && parsed.data.role !== session.profile.role) {
      return { ok: false, error: "Voce nao pode alterar o proprio papel." };
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
 * O funcionario aparece em pedidos e logs de meses atras; apaga-lo deixaria
 * buracos no historico que o restaurante precisa manter.
 */
export async function deactivateStaff(id: string): Promise<ActionResult<null>> {
  try {
    const session = await assertRestaurantPermission("staff.manage");

    if (id === session.userId) {
      return { ok: false, error: "Voce nao pode desativar o proprio acesso." };
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
