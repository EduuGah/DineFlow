"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, MoreHorizontal, UserRound } from "lucide-react";
import { signOut } from "@/server/actions/auth";
import { ROLE_LABELS } from "@/domain/labels";
import type { UserRole } from "@/domain/permissions";
import { isActive, navigationFor, primaryNavigationFor } from "./navigation";
import { NotificationBell } from "./notification-bell";
import { SyncIndicator } from "./sync-indicator";
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from "@/components/ui/dropdown";
import { cn } from "@/lib/utils/cn";
import { Logo } from "@/components/shared/logo";

export type ShellUser = {
  id: string;
  name: string;
  role: UserRole;
  restaurantName: string;
};

export function AppShell({ user, children }: { user: ShellUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const items = navigationFor(user.role);
  const primary = primaryNavigationFor(user.role);
  const overflow = items.filter((item) => !primary.includes(item));

  return (
    <div className="bg-background flex min-h-dvh flex-col lg:flex-row">
      {/* Desktop: navegação lateral fixa */}
      <aside className="border-border bg-surface hidden w-60 shrink-0 flex-col border-r lg:flex">
        {/* O logo leva ao hub: e a saida para trocar de área sem decorar URL. */}
        <Link href="/inicio" className="hover:bg-surface-muted flex items-center gap-2 px-5 py-5">
          <Logo className="size-9" />
          <span className="min-w-0">
            <span className="text-foreground block truncate text-sm font-bold">
              {user.restaurantName}
            </span>
            <span className="text-foreground-subtle block text-xs">Ver todas as áreas</span>
          </span>
        </Link>

        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-2">
          {items.map((item) => {
            const active = isActive(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm font-medium",
                  active
                    ? "bg-brand-soft text-brand"
                    : "text-foreground-muted hover:bg-surface-muted hover:text-foreground",
                )}
              >
                <item.icon className="size-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-border border-t px-3 py-3">
          <UserMenu user={user} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-surface/95 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-4 backdrop-blur">
          <Link href="/inicio" className="flex min-w-0 flex-1 items-center gap-2 lg:hidden">
            <Logo className="size-8" />
            <span className="text-foreground truncate text-sm font-semibold">
              {user.restaurantName}
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-1">
            <SyncIndicator />
            <NotificationBell userId={user.id} />
            {/* No desktop o menu do usuário vive na barra lateral. */}
            <span className="lg:hidden">
              <UserMenu user={user} compact overflow={overflow} />
            </span>
          </div>
        </header>

        <main className="min-w-0 flex-1 pb-20 lg:pb-0">{children}</main>

        {/* Celular: barra inferior, alvos grandes ao alcance do polegar */}
        <nav className="pb-safe border-border bg-surface fixed inset-x-0 bottom-0 z-30 flex border-t lg:hidden">
          {primary.map((item) => {
            const active = isActive(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2",
                  active ? "text-brand" : "text-foreground-subtle",
                )}
              >
                <item.icon className="size-5" />
                <span className="text-[0.6875rem] font-semibold">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function UserMenu({
  user,
  compact = false,
  overflow = [],
}: {
  user: ShellUser;
  compact?: boolean;
  overflow?: ReturnType<typeof navigationFor>;
}) {
  return (
    <Dropdown
      trigger={
        compact ? (
          <button
            type="button"
            className="text-foreground-muted hover:bg-surface-muted flex size-11 items-center justify-center rounded-full"
            aria-label="Menu do usuário"
          >
            <MoreHorizontal className="size-5" />
          </button>
        ) : (
          <button
            type="button"
            className="hover:bg-surface-muted flex w-full items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-left"
          >
            <span className="bg-surface-muted text-foreground-muted flex size-8 shrink-0 items-center justify-center rounded-full">
              <UserRound className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-foreground block truncate text-sm font-medium">
                {user.name}
              </span>
              <span className="text-foreground-subtle block text-xs">{ROLE_LABELS[user.role]}</span>
            </span>
          </button>
        )
      }
    >
      <DropdownLabel>
        {user.name} - {ROLE_LABELS[user.role]}
      </DropdownLabel>

      {overflow.length > 0 ? (
        <>
          <DropdownSeparator />
          {overflow.map((item) => (
            <DropdownItem key={item.href} icon={<item.icon className="size-4" />}>
              <Link href={item.href} className="flex-1">
                {item.label}
              </Link>
            </DropdownItem>
          ))}
        </>
      ) : null}

      <DropdownSeparator />
      <DropdownItem icon={<LogOut className="size-4" />} onSelect={() => void signOut()}>
        Sair
      </DropdownItem>
    </Dropdown>
  );
}
