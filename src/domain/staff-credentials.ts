import { z } from "zod";

/**
 * Credencial da equipe: usuário, não e-mail.
 *
 * Um garçom não tem e-mail de trabalho, e exigir um só para ele entrar no
 * sistema empurra para o restaurante um cadastro que não serve a ninguém --
 * quando não vira um endereço inventado que ninguém lê.
 *
 * O Supabase Auth exige e-mail para senha, então o usuário é convertido num
 * endereço interno num domínio que existe só para isso: ele nunca recebe
 * mensagem, e a pessoa nunca o digita nem o vê.
 */
export const STAFF_EMAIL_DOMAIN = "staff.dineflow.app";

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "O usuário precisa ter pelo menos 3 caracteres.")
  .max(30, "O usuário pode ter no máximo 30 caracteres.")
  .regex(
    /^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/,
    "Use apenas letras, números, ponto, hífen e sublinhado.",
  );

/** Endereço interno correspondente ao usuário. */
export function emailForUsername(username: string): string {
  return `${username.trim().toLowerCase()}@${STAFF_EMAIL_DOMAIN}`;
}

/**
 * Usuário por trás de um endereço interno, ou null se for e-mail de verdade.
 *
 * É o que permite a tela mostrar "joao" em vez do endereço sintético, sem
 * precisar de uma coluna a mais no banco: o domínio é constante e nosso, então
 * a conversão é reversível sem ambiguidade.
 */
export function usernameFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;

  const [local, domain] = email.toLowerCase().split("@");
  return domain === STAFF_EMAIL_DOMAIN ? local : null;
}

/** Como a pessoa aparece na lista da equipe e no próprio perfil. */
export function displayCredential(email: string | null | undefined): string {
  return usernameFromEmail(email) ?? email ?? "-";
}

/**
 * Converte o que foi digitado na entrada em endereço para o Supabase.
 *
 * Aceita as duas formas: quem tem e-mail de verdade (dono, gerência) digita o
 * e-mail; a equipe digita só o usuário.
 */
export function resolveLoginIdentifier(input: string): string {
  const valor = input.trim().toLowerCase();
  return valor.includes("@") ? valor : emailForUsername(valor);
}
