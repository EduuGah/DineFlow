/**
 * Cookie que guarda o destino da navegacao enquanto a pessoa esta no Google.
 *
 * Mora fora de `server/actions/auth.ts` porque um arquivo `"use server"` so
 * pode exportar funcoes async -- toda constante exportada de la vira erro de
 * build.
 */
export const RETURN_TO_COOKIE = "dineflow-proximo";

/** Validade curta: e um ida-e-volta ao Google, nao uma preferencia. */
export const RETURN_TO_MAX_AGE = 600;
