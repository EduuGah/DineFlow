"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { playAlert } from "@/lib/sound";
import type { Tables } from "@/types/database";

export type Notification = Tables<"notifications">;

const PAGE_SIZE = 30;

/**
 * Central de notificações do usuário (secao 14 do roadmap).
 *
 * Toast + som + badge + histórico saem daqui. O RLS de `notifications`
 * restringe as linhas ao próprio usuário, então a assinatura não precisa (nem
 * pode) enxergar as dos colegas.
 */
export function useNotifications(userId: string | null) {
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    void createClient()
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE)
      .then(({ data }) => {
        if (cancelled) return;
        setItems(data ?? []);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, reloadToken]);

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        ({ new: record }) => {
          const notification = record as Notification;

          setItems((current) =>
            // O INSERT pode chegar duas vezes após uma reconexão.
            current.some((item) => item.id === notification.id)
              ? current
              : [notification, ...current].slice(0, PAGE_SIZE),
          );

          const isReady = notification.type === "order_ready";
          const isCancelled = notification.type === "order_cancelled";

          playAlert(isReady ? "ready" : isCancelled ? "alert" : "newOrder");

          const show = isReady ? toast.success : isCancelled ? toast.error : toast;
          show(notification.title, {
            description: notification.message,
            // Pedido pronto fica na tela até o garçom ver: e a notificação
            // que não pode passar despercebida.
            duration: isReady ? Number.POSITIVE_INFINITY : 6000,
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const markAsRead = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, read_at: now } : item)),
    );

    await createClient().from("notifications").update({ read_at: now }).eq("id", id);
  }, []);

  const markAllAsRead = useCallback(async () => {
    const now = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? now })));

    await createClient().from("notifications").update({ read_at: now }).is("read_at", null);
  }, []);

  return {
    items,
    loading,
    unreadCount: items.filter((item) => !item.read_at).length,
    markAsRead,
    markAllAsRead,
    reload,
  };
}
