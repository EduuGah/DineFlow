"use client";

import Link from "next/link";
import { ChefHat, LogOut } from "lucide-react";
import { signOut } from "@/server/actions/auth";
import type { UserRole } from "@/domain/permissions";
import { ROLE_LABELS } from "@/domain/labels";
import { Button } from "@/components/ui/button";

/**
 * Casca minima das telas de conta. Sem navegacao operacional de proposito:
 * quem cai aqui esta bloqueado, sem restaurante ou fora da operacao, e mostrar
 * atalhos para telas que vao recusa-lo so gera frustracao.
 */
export function AccountShell({
  user,
  children,
}: {
  user: { name: string; role: UserRole | null; restaurantName: string | null };
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="border-border bg-surface flex h-14 items-center justify-between gap-3 border-b px-4 sm:px-6">
        <Link href="/inicio" className="flex min-w-0 items-center gap-2">
          <span className="bg-brand text-brand-foreground flex size-8 items-center justify-center rounded-lg">
            <ChefHat className="size-4" />
          </span>
          <span className="text-foreground truncate text-sm font-semibold">
            {user.restaurantName ?? "DineFlow"}
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <span className="text-foreground-muted hidden truncate text-sm sm:inline">
            {user.name}
            {user.role ? ` - ${ROLE_LABELS[user.role]}` : ""}
          </span>
          <Button
            variant="ghost"
            size="sm"
            icon={<LogOut className="size-4" />}
            onClick={() => void signOut()}
          >
            Sair
          </Button>
        </div>
      </header>

      <main className="flex-1">{children}</main>
    </div>
  );
}
