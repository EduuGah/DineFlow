import { describe, expect, it } from "vitest";
import { safeReturnTo } from "@/lib/auth/return-to";

/**
 * O destino pos-login vem de um cookie e termina num `Location:`. Se aceitasse
 * URL absoluta, viraria redirecionamento aberto -- levando junto a sessao
 * recem-criada.
 */
describe("destino pos-login", () => {
  it("aceita caminho interno", () => {
    expect(safeReturnTo("/garcom")).toBe("/garcom");
    expect(safeReturnTo("/garcom/mesa/abc")).toBe("/garcom/mesa/abc");
  });

  it("recusa URL absoluta", () => {
    expect(safeReturnTo("https://evil.com")).toBe("/inicio");
    expect(safeReturnTo("http://evil.com/x")).toBe("/inicio");
  });

  it("recusa a barra dupla, que o navegador trata como dominio", () => {
    expect(safeReturnTo("//evil.com")).toBe("/inicio");
    expect(safeReturnTo("//evil.com/garcom")).toBe("/inicio");
  });

  it("recusa caminho relativo e esquemas alternativos", () => {
    expect(safeReturnTo("garcom")).toBe("/inicio");
    expect(safeReturnTo("javascript:alert(1)")).toBe("/inicio");
  });

  it("cai no inicio quando nao ha destino", () => {
    expect(safeReturnTo(null)).toBe("/inicio");
    expect(safeReturnTo(undefined)).toBe("/inicio");
    expect(safeReturnTo("   ")).toBe("/inicio");
  });
});
