import Link from "next/link";
import { ChefHat } from "lucide-react";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="px-6 py-6">
        <Link href="/" className="inline-flex items-center gap-2">
          <span className="bg-brand text-brand-foreground flex size-9 items-center justify-center rounded-xl">
            <ChefHat className="size-5" />
          </span>
          <span className="text-foreground text-lg font-bold tracking-tight">DineFlow</span>
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-16">{children}</main>
    </div>
  );
}
