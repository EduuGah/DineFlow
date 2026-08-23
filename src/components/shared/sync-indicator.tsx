"use client";

import { useEffect, useState } from "react";
import { CloudOff, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/use-online";
import { flushOutbox, subscribeOutbox } from "@/lib/offline/outbox";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils/cn";
import { toast } from "sonner";

/**
 * Estado de sincronização no cabecalho.
 *
 * Some quando esta tudo certo. Um indicador verde permanente vira ruido; o que
 * a equipe precisa saber e exatamente quando NAO esta sincronizado.
 */
export function SyncIndicator() {
  const online = useOnline();
  const [pending, setPending] = useState(0);
  const [flushing, setFlushing] = useState(false);

  useEffect(
    () =>
      subscribeOutbox((state) => {
        setPending(state.pending);
        setFlushing(state.flushing);
      }),
    [],
  );

  useEffect(() => {
    if (!online) return;

    void flushOutbox().then((result) => {
      if (result.applied > 0) {
        toast.success(
          result.applied === 1
            ? "1 operação pendente foi enviada."
            : `${result.applied} operações pendentes foram enviadas.`,
        );
      }

      for (const failure of result.failed) {
        toast.error("Uma operação pendente não pode ser aplicada", {
          description: friendlyError(failure.error),
          duration: 10000,
        });
      }
    });
  }, [online]);

  if (online && pending === 0) return null;

  const offline = !online;

  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
        offline ? "bg-danger-soft text-danger" : "bg-warning-soft text-warning",
      )}
    >
      {offline ? (
        <WifiOff className="size-3.5" />
      ) : flushing ? (
        <RefreshCw className="size-3.5 animate-spin" />
      ) : (
        <CloudOff className="size-3.5" />
      )}
      <span className="hidden sm:inline">
        {offline
          ? pending > 0
            ? `Sem conexão - ${pending} para enviar`
            : "Sem conexão"
          : `Enviando ${pending}...`}
      </span>
      <span className="sm:hidden">{pending > 0 ? pending : <WifiOff className="size-3.5" />}</span>
    </span>
  );
}

/** Indicador do canal de realtime, usado no KDS da cozinha. */
export function RealtimeIndicator({ status }: { status: string }) {
  const connected = status === "connected";

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
        connected ? "bg-success-soft text-success" : "bg-warning-soft text-warning",
      )}
    >
      {connected ? <Wifi className="size-3.5" /> : <RefreshCw className="size-3.5 animate-spin" />}
      {connected ? "Ao vivo" : "Reconectando..."}
    </span>
  );
}
