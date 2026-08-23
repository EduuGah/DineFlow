import { describe, expect, it } from "vitest";
import {
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  allowedTransitions,
  canRoleTransition,
  canTransition,
  isFinal,
  isOpen,
  primaryAction,
  transitionRoles,
  type OrderStatus,
} from "@/domain/orders/state-machine";

describe("maquina de estados do pedido", () => {
  it("segue o fluxo principal do roadmap", () => {
    const happyPath: OrderStatus[] = [
      "draft",
      "sent",
      "received",
      "preparing",
      "ready",
      "delivered",
      "completed",
    ];

    for (let i = 0; i < happyPath.length - 1; i += 1) {
      expect(
        canTransition(happyPath[i], happyPath[i + 1]),
        `${happyPath[i]} -> ${happyPath[i + 1]} deveria ser permitido`,
      ).toBe(true);
    }
  });

  it("nunca deixa um pedido finalizado voltar ao fluxo", () => {
    for (const status of ORDER_STATUSES) {
      expect(canTransition("completed", status)).toBe(false);
      expect(canTransition("cancelled", status)).toBe(false);
    }
  });

  it("trata completed e cancelled como estados terminais", () => {
    expect(isFinal("completed")).toBe(true);
    expect(isFinal("cancelled")).toBe(true);
    expect(isOpen("completed")).toBe(false);
    expect(isOpen("preparing")).toBe(true);
  });

  it("recusa pular etapas", () => {
    expect(canTransition("draft", "ready")).toBe(false);
    expect(canTransition("sent", "delivered")).toBe(false);
    expect(canTransition("preparing", "completed")).toBe(false);
  });

  it("permite cancelar de qualquer estado aberto", () => {
    for (const status of ["draft", "sent", "received", "preparing", "ready"] as OrderStatus[]) {
      expect(canTransition(status, "cancelled")).toBe(true);
    }
    // Depois de entregue nao se cancela: estorna-se ou reabre-se.
    expect(canTransition("delivered", "cancelled")).toBe(false);
  });

  it("permite a cozinha reabrir um pedido marcado pronto por engano", () => {
    expect(canRoleTransition("ready", "preparing", "kitchen")).toBe(true);
    expect(canRoleTransition("ready", "preparing", "waiter")).toBe(false);
  });

  it("permite a comanda voltar para a fila quando entra um adicional", () => {
    expect(canRoleTransition("ready", "sent", "waiter")).toBe(true);
    expect(canRoleTransition("delivered", "sent", "waiter")).toBe(true);
  });
});

describe("permissoes de transicao", () => {
  it("nao deixa o garcom marcar um pedido como pronto", () => {
    expect(canTransition("preparing", "ready")).toBe(true);
    expect(canRoleTransition("preparing", "ready", "waiter")).toBe(false);
    expect(canRoleTransition("preparing", "ready", "kitchen")).toBe(true);
  });

  it("nao deixa a cozinha entregar na mesa", () => {
    expect(canRoleTransition("ready", "delivered", "kitchen")).toBe(false);
    expect(canRoleTransition("ready", "delivered", "waiter")).toBe(true);
  });

  it("restringe o cancelamento depois que a cozinha comecou", () => {
    expect(canRoleTransition("sent", "cancelled", "waiter")).toBe(true);
    expect(canRoleTransition("preparing", "cancelled", "waiter")).toBe(false);
    expect(canRoleTransition("preparing", "cancelled", "kitchen")).toBe(true);
    expect(canRoleTransition("preparing", "cancelled", "manager")).toBe(true);
  });

  it("da ao gerente acesso a toda transicao valida", () => {
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_TRANSITIONS[from]) {
        expect(
          transitionRoles(from, to).includes("manager"),
          `gerente deveria poder ${from} -> ${to}`,
        ).toBe(true);
      }
    }
  });

  it("nunca da poder operacional ao admin da plataforma", () => {
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_TRANSITIONS[from]) {
        expect(transitionRoles(from, to)).not.toContain("platform_admin");
      }
    }
  });

  it("lista apenas as acoes que o papel pode disparar", () => {
    expect(allowedTransitions("preparing", "kitchen").sort()).toEqual(["cancelled", "ready"]);
    expect(allowedTransitions("preparing", "waiter")).toEqual([]);
    expect(allowedTransitions("draft", "waiter").sort()).toEqual(["cancelled", "sent"]);
  });
});

describe("acao primaria da tela", () => {
  it("da a cozinha o proximo passo obvio", () => {
    expect(primaryAction("sent", "kitchen")).toEqual({ to: "preparing", label: "Iniciar preparo" });
    expect(primaryAction("preparing", "kitchen")).toEqual({ to: "ready", label: "Marcar pronto" });
    expect(primaryAction("ready", "kitchen")).toBeNull();
  });

  it("da ao garcom o proximo passo obvio", () => {
    expect(primaryAction("draft", "waiter")).toEqual({
      to: "sent",
      label: "Enviar para a cozinha",
    });
    expect(primaryAction("ready", "waiter")).toEqual({
      to: "delivered",
      label: "Entregar na mesa",
    });
    expect(primaryAction("preparing", "waiter")).toBeNull();
  });
});
