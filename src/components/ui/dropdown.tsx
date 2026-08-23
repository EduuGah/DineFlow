"use client";

import { DropdownMenu, Tooltip as RadixTooltip } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

const CONTENT = cn(
  "z-50 min-w-48 rounded-[var(--radius-control)] border border-border bg-surface p-1",
  "shadow-raised animate-slide-up",
);

const ITEM = cn(
  "flex h-10 cursor-pointer items-center gap-2 rounded-[calc(var(--radius-control)-0.25rem)] px-3",
  "text-sm font-medium text-foreground outline-none select-none",
  "data-[highlighted]:bg-surface-muted data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
);

export function Dropdown({
  trigger,
  children,
  align = "end",
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "center" | "end";
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={CONTENT} align={align} sideOffset={6}>
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function DropdownItem({
  onSelect,
  destructive = false,
  disabled = false,
  icon,
  children,
}: {
  onSelect?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <DropdownMenu.Item
      className={cn(ITEM, destructive && "text-danger data-[highlighted]:bg-danger-soft")}
      onSelect={onSelect}
      disabled={disabled}
    >
      {icon}
      {children}
    </DropdownMenu.Item>
  );
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu.Label className="text-foreground-subtle px-3 py-2 text-xs font-semibold tracking-wide uppercase">
      {children}
    </DropdownMenu.Label>
  );
}

export function DropdownSeparator() {
  return <DropdownMenu.Separator className="bg-border my-1 h-px" />;
}

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <RadixTooltip.Provider delayDuration={300}>{children}</RadixTooltip.Provider>;
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          sideOffset={6}
          className="bg-foreground text-background shadow-raised z-50 rounded-md px-2.5 py-1.5 text-xs font-medium"
        >
          {label}
          <RadixTooltip.Arrow className="fill-[var(--foreground)]" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
