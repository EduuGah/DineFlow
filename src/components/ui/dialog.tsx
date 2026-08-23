"use client";

import { useState, type ReactNode } from "react";
import { Dialog as RadixDialog } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Button } from "./button";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  footer?: ReactNode;
  children?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" />
        <RadixDialog.Content
          className={cn(
            "bg-surface shadow-raised fixed z-50 flex flex-col",
            // Celular: folha que sobe de baixo, alcancavel com o polegar.
            // Desktop: dialogo centralizado.
            "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-2xl",
            "sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2",
            "sm:max-h-[85dvh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[var(--radius-card)]",
            size === "sm" && "sm:w-[min(28rem,92vw)]",
            size === "md" && "sm:w-[min(36rem,92vw)]",
            size === "lg" && "sm:w-[min(52rem,92vw)]",
          )}
        >
          <div className="border-border flex items-start justify-between gap-4 border-b px-5 py-4">
            <div className="min-w-0">
              <RadixDialog.Title className="text-foreground text-lg font-semibold">
                {title}
              </RadixDialog.Title>
              {description ? (
                <RadixDialog.Description className="text-foreground-muted mt-0.5 text-sm">
                  {description}
                </RadixDialog.Description>
              ) : null}
            </div>
            <RadixDialog.Close
              className="text-foreground-muted hover:bg-surface-muted -m-2 rounded-full p-2"
              aria-label="Fechar"
            >
              <X className="size-5" />
            </RadixDialog.Close>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

          {footer ? (
            <div className="pb-safe border-border flex flex-wrap items-center justify-end gap-2 border-t px-5 py-4 sm:pb-4">
              {footer}
            </div>
          ) : null}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/**
 * Confirmacao de ação critica (secao 11 do roadmap).
 *
 * Usada apenas onde a ação e irreversivel -- cancelar pedido, excluir produto.
 * Confirmar tudo treina a equipe a clicar "sim" sem ler.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Voltar",
  destructive = false,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
  children?: ReactNode;
}) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            onClick={handleConfirm}
            loading={loading}
            loadingText="Aguarde..."
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
