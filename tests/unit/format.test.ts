import { describe, expect, it, vi, afterEach } from "vitest";
import {
  formatCurrency,
  formatDuration,
  minutesSince,
  pluralize,
  relativeTime,
  secondsSince,
} from "@/lib/utils/format";

afterEach(() => {
  vi.useRealTimers();
});

describe("formatacao de valores", () => {
  it("formata em real brasileiro", () => {
    //   = espaco nao separavel, que o Intl usa entre simbolo e numero.
    expect(formatCurrency(32.5).replace(/ /g, " ")).toBe("R$ 32,50");
    expect(formatCurrency("0").replace(/ /g, " ")).toBe("R$ 0,00");
  });

  it("trata valor ausente como zero em vez de quebrar a tela", () => {
    expect(formatCurrency(null).replace(/ /g, " ")).toBe("R$ 0,00");
    expect(formatCurrency(undefined).replace(/ /g, " ")).toBe("R$ 0,00");
  });
});

describe("cronometro da cozinha", () => {
  it("mostra segundos apenas no primeiro minuto", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(45)).toBe("45s");
    expect(formatDuration(60)).toBe("1min");
    expect(formatDuration(599)).toBe("9min");
  });

  it("passa para horas quando o pedido esta parado ha muito tempo", () => {
    expect(formatDuration(3600)).toBe("1h00");
    expect(formatDuration(4320)).toBe("1h12");
  });

  it("nao exibe tempo negativo se o relogio do aparelho estiver adiantado", () => {
    expect(formatDuration(-30)).toBe("0s");
    expect(secondsSince(new Date(Date.now() + 60_000))).toBe(0);
    expect(minutesSince(new Date(Date.now() + 60_000))).toBe(0);
  });

  it("devolve marcador quando nao ha horario", () => {
    expect(formatDuration(null)).toBe("--");
    expect(formatDuration(Number.NaN)).toBe("--");
  });
});

describe("tempo relativo", () => {
  it("descreve o tempo em linguagem de salao", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-22T20:00:00Z"));

    expect(relativeTime("2026-08-22T19:59:40Z")).toBe("agora");
    expect(relativeTime("2026-08-22T19:45:00Z")).toBe("ha 15 min");
    expect(relativeTime("2026-08-22T17:00:00Z")).toBe("ha 3 h");
    expect(relativeTime("2026-08-21T18:00:00Z")).toBe("ontem");
    expect(relativeTime("2026-08-19T18:00:00Z")).toBe("ha 3 dias");
  });

  it("devolve vazio sem data, para nao imprimir 'Invalid Date' na tela", () => {
    expect(relativeTime(null)).toBe("");
    expect(relativeTime(undefined)).toBe("");
  });
});

describe("pluralizacao", () => {
  it("concorda com a quantidade", () => {
    expect(pluralize(1, "pedido aberto", "pedidos abertos")).toBe("1 pedido aberto");
    expect(pluralize(3, "pedido aberto", "pedidos abertos")).toBe("3 pedidos abertos");
    expect(pluralize(0, "pedido aberto", "pedidos abertos")).toBe("0 pedidos abertos");
  });
});
