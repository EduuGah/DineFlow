"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Estado da conexao do navegador.
 *
 * `navigator.onLine` so sabe se existe interface de rede -- num restaurante,
 * o Wi-Fi costuma continuar "conectado" enquanto o link nao entrega nada. Por
 * isso o estado real de sincronizacao vem do canal de realtime; este hook
 * cobre apenas o caso obvio (celular saiu do alcance).
 *
 * useSyncExternalStore em vez de useState + useEffect: navigator nao existe no
 * servidor, e o snapshot de servidor "online" evita divergencia de hidratacao.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
