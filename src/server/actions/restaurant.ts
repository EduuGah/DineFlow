"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { restaurantNameSchema } from "@/domain/schemas";
import { fail, type ActionResult } from "@/lib/errors";

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

    /*
     * DF006 = a conta ja tem restaurante.
     *
     * Nao e erro do ponto de vista de quem clicou: o estado pedido ja existe.
     * Mostrar "sua conta ja esta vinculada" numa tela que insiste em pedir o
     * cadastro deixa a pessoa presa, sem saida visivel. Seguimos para o hub,
     * que e onde ela queria chegar.
     */
    if (error && error.code !== "DF006") return fail(error);
  } catch (error) {
    return fail(error);
  }

  // O cache de rota ainda enxerga a conta sem restaurante; sem invalidar, a
  // navegacao seguinte serviria a mesma tela de "cadastre seu restaurante".
  revalidatePath("/", "layout");

  /*
   * O redirect fica FORA do try/catch de proposito.
   *
   * `redirect()` sinaliza para o Next lancando uma excecao especial. Dentro do
   * bloco acima ela seria capturada pelo catch e virava "nao foi possivel
   * concluir a operacao" -- com o restaurante ja criado no banco.
   *
   * Redirecionar aqui, e nao no cliente, tambem elimina a corrida entre
   * `router.refresh()` e `router.push()`: a resposta da propria action ja
   * carrega a navegacao.
   *
   * O destino e o hub, e nao /gerente: e a unica tela que sempre renderiza,
   * independentemente de papel e de estado da assinatura.
   */
  redirect("/inicio");
}
