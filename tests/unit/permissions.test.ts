import { describe, expect, it } from "vitest";
import { ROLE_PERMISSIONS, can, canAny, isManagerRole, type UserRole } from "@/domain/permissions";

const ROLES: UserRole[] = ["waiter", "kitchen", "manager", "admin", "platform_admin"];

describe("permissoes por papel", () => {
  it("da ao garcom o necessario para atender, e nada de gestao", () => {
    expect(can("waiter", "orders.create")).toBe(true);
    expect(can("waiter", "orders.deliver")).toBe(true);
    expect(can("waiter", "menu.manage")).toBe(false);
    expect(can("waiter", "staff.manage")).toBe(false);
    expect(can("waiter", "reports.view")).toBe(false);
  });

  it("da a cozinha o controle do preparo, e nao o de lancar pedido", () => {
    expect(can("kitchen", "kitchen.start")).toBe(true);
    expect(can("kitchen", "kitchen.finish")).toBe(true);
    expect(can("kitchen", "orders.create")).toBe(false);
    expect(can("kitchen", "orders.deliver")).toBe(false);
  });

  it("da ao gerente o conjunto do garcom e da cozinha, mais gestao", () => {
    for (const permission of [...ROLE_PERMISSIONS.waiter, ...ROLE_PERMISSIONS.kitchen]) {
      expect(can("manager", permission), `gerente deveria ter ${permission}`).toBe(true);
    }
    expect(can("manager", "menu.manage")).toBe(true);
    expect(can("manager", "audit.view")).toBe(true);
  });

  it("reserva a configuracao do restaurante ao admin", () => {
    expect(can("admin", "restaurant.configure")).toBe(true);
    expect(can("manager", "restaurant.configure")).toBe(false);
  });

  it("nao da nenhum poder operacional ao admin da plataforma", () => {
    const operational = ROLE_PERMISSIONS.manager;
    for (const permission of operational) {
      expect(can("platform_admin", permission)).toBe(false);
    }
    expect(can("platform_admin", "platform.manage")).toBe(true);
  });

  it("nao da nenhuma permissao a quem nao esta autenticado", () => {
    expect(can(null, "orders.create")).toBe(false);
    expect(can(undefined, "tables.view")).toBe(false);
    expect(canAny(null, ["orders.create", "menu.manage"])).toBe(false);
  });

  it("mantem platform.manage exclusivo do admin da plataforma", () => {
    for (const role of ROLES) {
      expect(can(role, "platform.manage")).toBe(role === "platform_admin");
    }
  });

  it("identifica os papeis de gestao", () => {
    expect(isManagerRole("manager")).toBe(true);
    expect(isManagerRole("admin")).toBe(true);
    expect(isManagerRole("waiter")).toBe(false);
    expect(isManagerRole(null)).toBe(false);
  });
});
