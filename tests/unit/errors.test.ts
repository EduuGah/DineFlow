import { describe, expect, it } from "vitest";
import { DomainError, friendlyError, isDuplicateRequest } from "@/lib/errors";

/**
 * A tradução de erro é a última coisa entre uma falha do banco e alguém no
 * meio do movimento. Errar aqui não quebra o sistema -- só faz a pessoa
 * parar de confiar nele.
 */
describe("traducao de erro", () => {
  it("traduz os codigos dos triggers do dominio", () => {
    expect(friendlyError({ code: "DF003", message: "produto indisponivel" })).toContain(
      "indisponível",
    );
    expect(friendlyError({ code: "DF002", message: "sem permissao" })).toContain("permissão");
    expect(friendlyError({ code: "DF006", message: "ja vinculada" })).toContain(
      "já está vinculada",
    );
  });

  it("aponta migration pendente quando o banco esta atras do codigo", () => {
    // Sintoma real: deploy novo contra banco antigo. A mensagem precisa dizer
    // o que fazer, porque quem ve isso e quem instalou o sistema.
    for (const code of ["PGRST202", "42883", "42P01"]) {
      expect(friendlyError({ code, message: "..." })).toMatch(/migrations pendentes/i);
    }
  });

  it("prefere a mensagem da constraint ao codigo generico", () => {
    const erro = {
      code: "23505",
      message: 'duplicate key value violates unique constraint "tables_restaurant_id_number_key"',
    };

    expect(friendlyError(erro)).toBe("Já existe uma mesa com esse número.");
  });

  it("nao revela detalhe de infraestrutura numa violacao de RLS", () => {
    const mensagem = friendlyError({
      message: "new row violates row-level security policy for table orders",
    });

    expect(mensagem).toBe("Você não tem acesso a esse dado.");
    expect(mensagem).not.toContain("row-level");
  });

  it("reconhece falta de conexao", () => {
    expect(friendlyError({ message: "Failed to fetch" })).toMatch(/sem conexão/i);
  });

  it("repassa a mensagem de um DomainError", () => {
    expect(friendlyError(new DomainError("Mensagem propria.", "X"))).toBe("Mensagem propria.");
  });

  it("cai numa mensagem neutra quando nao reconhece o erro", () => {
    expect(friendlyError(new Error("algo estranho"))).toBe(
      "Não foi possível concluir a operação. Tente de novo.",
    );
  });
});

describe("deteccao de reenvio", () => {
  it("reconhece o pedido reenviado pela chave de idempotencia", () => {
    expect(
      isDuplicateRequest({
        code: "23505",
        message: 'duplicate key ... "orders_restaurant_id_client_request_id_key"',
      }),
    ).toBe(true);
  });

  it("nao confunde com outra violacao de unicidade", () => {
    expect(
      isDuplicateRequest({
        code: "23505",
        message: 'duplicate key ... "tables_restaurant_id_number_key"',
      }),
    ).toBe(false);
  });
});
