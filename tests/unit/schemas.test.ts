import { describe, expect, it } from "vitest";
import {
  cancelOrderSchema,
  createOrderSchema,
  invitationSchema,
  orderItemSchema,
  productSchema,
  restaurantNameSchema,
  signInSchema,
  staffAccountSchema,
  tableSchema,
} from "@/domain/schemas";

describe("convite de acesso", () => {
  it("normaliza e-mail para minusculas e sem espacos", () => {
    // O autocompletar do celular cola espaco no fim e maiuscula no comeco.
    // Se isso chegasse ao banco, o convite nunca casaria com a conta Google.
    const parsed = invitationSchema.parse({
      email: "  Joao@Restaurante.COM  ",
      role: "waiter",
    });

    expect(parsed.email).toBe("joao@restaurante.com");
  });

  it("recusa e-mail invalido", () => {
    expect(invitationSchema.safeParse({ email: "nao-e-email", role: "waiter" }).success).toBe(
      false,
    );
  });

  it("nao permite convidar como admin da plataforma", () => {
    expect(invitationSchema.safeParse({ email: "a@b.com", role: "platform_admin" }).success).toBe(
      false,
    );
    expect(invitationSchema.safeParse({ email: "a@b.com", role: "kitchen" }).success).toBe(true);
  });
});

describe("acesso da equipe", () => {
  const base = {
    name: "João Pereira",
    username: "joao",
    phone: undefined,
    role: "waiter" as const,
  };

  it("exige senha de pelo menos 8 caracteres", () => {
    // Comprimento acima de complexidade: senha complexa demais num restaurante
    // termina anotada num papel no balcão.
    expect(staffAccountSchema.safeParse({ ...base, password: "1234567" }).success).toBe(false);
    expect(staffAccountSchema.safeParse({ ...base, password: "12345678" }).success).toBe(true);
  });

  it("não permite criar acesso de admin da plataforma", () => {
    expect(
      staffAccountSchema.safeParse({ ...base, role: "platform_admin", password: "12345678" })
        .success,
    ).toBe(false);
  });

  it("normaliza o usuário e recusa formato inutilizável", () => {
    expect(
      staffAccountSchema.parse({ ...base, username: "  JOAO  ", password: "12345678" }).username,
    ).toBe("joao");

    // Espaço e arroba quebrariam a conversão para o endereço interno.
    for (const invalido of ["jo", "joao silva", "joao@casa", "-joao", "joao-"]) {
      expect(
        staffAccountSchema.safeParse({ ...base, username: invalido, password: "12345678" }).success,
        `"${invalido}" deveria ser recusado`,
      ).toBe(false);
    }
  });

  it("aceita qualquer senha não vazia na entrada", () => {
    // Validar comprimento no login vazaria a política de senha para quem
    // ainda não tem conta.
    expect(signInSchema.safeParse({ identifier: "joao", password: "x" }).success).toBe(true);
    expect(signInSchema.safeParse({ identifier: "joao", password: "" }).success).toBe(false);
  });
});

describe("cadastro do restaurante", () => {
  it("exige um nome utilizavel", () => {
    expect(restaurantNameSchema.safeParse({ name: "" }).success).toBe(false);
    expect(restaurantNameSchema.safeParse({ name: " C " }).success).toBe(false);
    expect(restaurantNameSchema.safeParse({ name: "Cantina da Esquina" }).success).toBe(true);
  });

  it("remove espacos das pontas", () => {
    expect(restaurantNameSchema.parse({ name: "  Bar do Ze  " }).name).toBe("Bar do Ze");
  });
});

describe("validacao de cadastro", () => {
  it("recusa mesa com numero zero ou negativo", () => {
    const base = { name: undefined, capacity: 4, area: undefined, active: true };
    expect(tableSchema.safeParse({ ...base, number: 0 }).success).toBe(false);
    expect(tableSchema.safeParse({ ...base, number: -3 }).success).toBe(false);
    expect(tableSchema.safeParse({ ...base, number: 12 }).success).toBe(true);
  });

  it("recusa capacidade fora do intervalo utilizavel", () => {
    const base = { number: 1, name: undefined, area: undefined, active: true };
    expect(tableSchema.safeParse({ ...base, capacity: 0 }).success).toBe(false);
    expect(tableSchema.safeParse({ ...base, capacity: 80 }).success).toBe(false);
  });

  it("converte campos vazios em null em vez de string vazia", () => {
    const parsed = tableSchema.parse({
      number: 5,
      name: "   ",
      capacity: 4,
      area: "",
      active: true,
    });

    expect(parsed.name).toBeNull();
    expect(parsed.area).toBeNull();
  });

  it("recusa preco negativo", () => {
    const base = {
      name: "Hamburguer",
      description: undefined,
      categoryId: "00000000-0000-4000-8000-000000000000",
      position: 0,
      active: true,
      available: true,
    };

    expect(productSchema.safeParse({ ...base, price: -1 }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, price: 0 }).success).toBe(true);
  });

  it("aceita preco vindo como texto do formulario", () => {
    const parsed = productSchema.parse({
      name: "Hamburguer",
      description: undefined,
      categoryId: "00000000-0000-4000-8000-000000000000",
      price: "42.90",
      position: 0,
      active: true,
      available: true,
    });

    expect(parsed.price).toBe(42.9);
  });
});

describe("validacao de pedido", () => {
  it("recusa quantidade zero, negativa ou fracionada", () => {
    const base = { productId: "00000000-0000-4000-8000-000000000000", notes: undefined };

    expect(orderItemSchema.safeParse({ ...base, quantity: 0 }).success).toBe(false);
    expect(orderItemSchema.safeParse({ ...base, quantity: -2 }).success).toBe(false);
    expect(orderItemSchema.safeParse({ ...base, quantity: 1.5 }).success).toBe(false);
    expect(orderItemSchema.safeParse({ ...base, quantity: 3 }).success).toBe(true);
  });

  it("limita a quantidade por item ao que cabe numa comanda real", () => {
    const base = { productId: "00000000-0000-4000-8000-000000000000", notes: undefined };
    expect(orderItemSchema.safeParse({ ...base, quantity: 100 }).success).toBe(false);
  });

  it("exige chave de idempotencia ao abrir o pedido", () => {
    const tableId = "00000000-0000-4000-8000-000000000000";

    expect(createOrderSchema.safeParse({ tableId, clientRequestId: "nao-e-uuid" }).success).toBe(
      false,
    );
    expect(
      createOrderSchema.safeParse({ tableId, clientRequestId: crypto.randomUUID() }).success,
    ).toBe(true);
  });

  it("exige motivo valido no cancelamento", () => {
    const orderId = crypto.randomUUID();

    expect(cancelOrderSchema.safeParse({ orderId, reason: "porque sim" }).success).toBe(false);
    expect(cancelOrderSchema.safeParse({ orderId, reason: "product_unavailable" }).success).toBe(
      true,
    );
  });
});
