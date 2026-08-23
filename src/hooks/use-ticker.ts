"use client";

import { useEffect, useState } from "react";

/**
 * Re-renderiza em intervalo fixo para manter cronometros vivos.
 *
 * O KDS mostra "há quanto tempo esse pedido esta esperando" -- sem um tick
 * próprio, o número congelaria até chegar o proximo evento de realtime, que
 * pode nunca vir num pedido parado.
 */
export function useTicker(intervalMs = 10_000): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return tick;
}
