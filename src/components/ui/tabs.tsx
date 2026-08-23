"use client";

import { Tabs as RadixTabs } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function Tabs({
  value,
  onValueChange,
  defaultValue,
  items,
  children,
  className,
}: {
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  items: { value: string; label: string; badge?: ReactNode }[];
  children: ReactNode;
  className?: string;
}) {
  return (
    <RadixTabs.Root
      value={value}
      defaultValue={defaultValue ?? items[0]?.value}
      onValueChange={onValueChange}
      className={cn("flex flex-col gap-4", className)}
    >
      <RadixTabs.List className="-mx-1 flex scrollbar-none gap-1 overflow-x-auto px-1">
        {items.map((item) => (
          <RadixTabs.Trigger
            key={item.value}
            value={item.value}
            className={cn(
              "flex h-10 shrink-0 items-center gap-2 rounded-[var(--radius-control)] px-4",
              "text-foreground-muted text-sm font-semibold whitespace-nowrap",
              "hover:bg-surface-muted transition-colors",
              "data-[state=active]:bg-brand data-[state=active]:text-brand-foreground",
            )}
          >
            {item.label}
            {item.badge}
          </RadixTabs.Trigger>
        ))}
      </RadixTabs.List>
      {children}
    </RadixTabs.Root>
  );
}

export const TabPanel = RadixTabs.Content;
