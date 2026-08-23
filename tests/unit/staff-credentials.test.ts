import { describe, expect, it } from "vitest";
import {
  STAFF_EMAIL_DOMAIN,
  displayCredential,
  emailForUsername,
  resolveLoginIdentifier,
  usernameFromEmail,
} from "@/domain/staff-credentials";

/**
 * O Supabase Auth exige e-mail para senha, mas um garçom não tem e-mail de
 * trabalho. A conversão para um endereço interno é o que permite a pessoa
 * digitar só o usuário -- e precisa ser reversível, senão a tela mostraria um
 * endereço sintético que ninguém reconhece.
 */
describe("credencial da equipe", () => {
  it("converte usuário em endereço interno", () => {
    expect(emailForUsername("joao")).toBe(`joao@${STAFF_EMAIL_DOMAIN}`);
    expect(emailForUsername("  JOAO  ")).toBe(`joao@${STAFF_EMAIL_DOMAIN}`);
  });

  it("volta do endereço interno para o usuário", () => {
    expect(usernameFromEmail(`joao@${STAFF_EMAIL_DOMAIN}`)).toBe("joao");
  });

  it("não confunde e-mail de verdade com endereço interno", () => {
    expect(usernameFromEmail("dono@restaurante.com.br")).toBeNull();
    expect(usernameFromEmail(null)).toBeNull();
  });

  it("mostra o usuário para a equipe e o e-mail para quem tem um", () => {
    expect(displayCredential(`maria@${STAFF_EMAIL_DOMAIN}`)).toBe("maria");
    expect(displayCredential("dona@gmail.com")).toBe("dona@gmail.com");
    expect(displayCredential(null)).toBe("-");
  });

  it("aceita as duas formas na entrada", () => {
    expect(resolveLoginIdentifier("joao")).toBe(`joao@${STAFF_EMAIL_DOMAIN}`);
    expect(resolveLoginIdentifier(" Dona@Gmail.com ")).toBe("dona@gmail.com");
  });
});
