"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, CheckCheck, Volume2, VolumeX } from "lucide-react";
import { useNotifications } from "@/hooks/use-notifications";
import { useSoundPreference } from "@/hooks/use-sound-preference";
import { playAlert, unlockAudio } from "@/lib/sound";
import { relativeTime } from "@/lib/utils/format";
import { CountBadge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmptyState, SkeletonList } from "@/components/ui/feedback";
import { cn } from "@/lib/utils/cn";

export function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [sound, setSound] = useSoundPreference();
  const { items, loading, unreadCount, markAsRead, markAllAsRead } = useNotifications(userId);

  useEffect(() => {
    // O navegador só libera audio após um gesto. Prendemos o desbloqueio ao
    // primeiro toque em qualquer lugar da tela para que o primeiro pedido
    // pronto já apite.
    const unlock = () => unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  function toggleSound() {
    const next = !sound;
    setSound(next);
    if (next) playAlert("newOrder");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-foreground-muted hover:bg-surface-muted hover:text-foreground relative flex size-11 items-center justify-center rounded-full"
        aria-label={unreadCount > 0 ? `Notificações, ${unreadCount} não lidas` : "Notificações"}
      >
        <Bell className="size-5" />
        {unreadCount > 0 ? (
          <span className="absolute top-1 right-1">
            <CountBadge count={unreadCount} />
          </span>
        ) : null}
      </button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Notificações"
        description={unreadCount > 0 ? `${unreadCount} não lidas` : "Tudo em dia"}
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              icon={sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
              onClick={toggleSound}
            >
              {sound ? "Som ligado" : "Som desligado"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<CheckCheck className="size-4" />}
              onClick={() => void markAllAsRead()}
              disabled={unreadCount === 0}
            >
              Marcar todas como lidas
            </Button>
          </>
        }
      >
        {loading ? (
          <SkeletonList rows={3} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<BellOff className="size-8" />}
            title="Nenhuma notificação ainda"
            description="Você sera avisado aqui quando um pedido ficar pronto ou for cancelado."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {items.map((notification) => {
              const unread = !notification.read_at;
              const body = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <p
                      className={cn(
                        "text-sm",
                        unread ? "text-foreground font-semibold" : "text-foreground-muted",
                      )}
                    >
                      {notification.title}
                    </p>
                    <span className="text-foreground-subtle shrink-0 text-xs">
                      {relativeTime(notification.created_at)}
                    </span>
                  </div>
                  <p className="text-foreground-muted mt-0.5 text-sm">{notification.message}</p>
                </>
              );

              return (
                <li key={notification.id}>
                  {notification.order_id ? (
                    <Link
                      href={`/garcom/pedidos?pedido=${notification.order_id}`}
                      onClick={() => {
                        void markAsRead(notification.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "block rounded-[var(--radius-control)] border px-3.5 py-3 transition-colors",
                        unread
                          ? "border-brand/30 bg-brand-soft/40"
                          : "border-border hover:bg-surface-muted",
                      )}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div
                      className={cn(
                        "rounded-[var(--radius-control)] border px-3.5 py-3",
                        unread ? "border-brand/30 bg-brand-soft/40" : "border-border",
                      )}
                    >
                      {body}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Dialog>
    </>
  );
}
