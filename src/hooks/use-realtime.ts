"use client";

import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export type RealtimeStatus = "connecting" | "connected" | "reconnecting" | "offline";

type WatchedTable = "orders" | "order_items" | "tables" | "notifications";

type Options = {
  /** Canal por restaurante: garante que um tenant nunca escute o outro. */
  restaurantId: string;
  tables: WatchedTable[];
  /** Chamado a cada evento novo (já deduplicado). */
  onEvent?: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
  /**
   * Chamado quando o canal (re)conecta. E o gancho de sincronização: depois de
   * uma queda, eventos perdidos não voltam -- a tela precisa recarregar o
   * estado inteiro do servidor.
   */
  onSync?: () => void;
  enabled?: boolean;
};

/** Quantas chaves de evento guardamos para descartar entregas repetidas. */
const DEDUPE_WINDOW = 200;

/**
 * Assinatura de realtime com reconexão e resync (secao 13 do roadmap).
 *
 * O Supabase reaplica o RLS por assinante, então mesmo um canal sem filtro
 * só entregaria linhas do próprio restaurante. O filtro por restaurant_id
 * existe para economizar tráfego, não para isolar.
 */
export function useRealtime({
  restaurantId,
  tables,
  onEvent,
  onSync,
  enabled = true,
}: Options): RealtimeStatus {
  const [status, setStatus] = useState<RealtimeStatus>("connecting");

  // Refs para os callbacks: sem isso, cada render recriaria o canal e a
  // cozinha perderia eventos no meio do movimento. A atualização acontece num
  // efeito (não no corpo do render) porque escrever em ref durante o render
  // quebra com renderizacao concorrente.
  const onEventRef = useRef(onEvent);
  const onSyncRef = useRef(onSync);

  useEffect(() => {
    onEventRef.current = onEvent;
    onSyncRef.current = onSync;
  });

  const tablesKey = tables.join(",");

  useEffect(() => {
    if (!enabled || !restaurantId) return;

    const supabase = createClient();
    const seen = new Set<string>();
    const order: string[] = [];
    let channel: RealtimeChannel | null = null;
    let cancelled = false;

    /**
     * O servidor pode reentregar o mesmo evento após uma reconexão. A chave
     * junta tabela + id + versão da linha, então um UPDATE legitimo depois de
     * outro não e confundido com repeticao.
     */
    function isDuplicate(payload: RealtimePostgresChangesPayload<Record<string, unknown>>) {
      const record = (payload.new ?? payload.old ?? {}) as Record<string, unknown>;
      const key = [
        payload.table,
        payload.eventType,
        record.id ?? "",
        record.updated_at ?? payload.commit_timestamp,
      ].join(":");

      if (seen.has(key)) return true;

      seen.add(key);
      order.push(key);
      if (order.length > DEDUPE_WINDOW) {
        const oldest = order.shift();
        if (oldest) seen.delete(oldest);
      }
      return false;
    }

    channel = supabase.channel(`dineflow:${restaurantId}:${tablesKey}`);

    for (const table of tablesKey.split(",") as WatchedTable[]) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          if (cancelled || isDuplicate(payload)) return;
          onEventRef.current?.(payload);
        },
      );
    }

    channel.subscribe((state) => {
      if (cancelled) return;

      if (state === "SUBSCRIBED") {
        setStatus("connected");
        // Sincroniza sempre que conecta, inclusive na primeira vez: e barato
        // e cobre o intervalo entre o carregamento da página e o canal ficar
        // pronto.
        onSyncRef.current?.();
        return;
      }

      if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
        // O cliente do Supabase reconecta sozinho com backoff; aqui apenas
        // refletimos isso na interface.
        setStatus("reconnecting");
        return;
      }

      if (state === "CLOSED") {
        setStatus("offline");
      }
    });

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [restaurantId, tablesKey, enabled]);

  return status;
}
