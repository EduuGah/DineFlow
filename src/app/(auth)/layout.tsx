import Link from "next/link";
import { Logo } from "@/components/shared/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <header className="px-6 py-6">
        <Link href="/" className="inline-flex items-center gap-2">
          <Logo className="size-9" />
          <span className="text-foreground text-lg font-bold tracking-tight">DineFlow</span>
        </Link>
      </header>

      <main className="flex flex-1 items-start justify-center px-6 pb-16 sm:items-center">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="text-foreground-subtle px-6 pb-6 text-center text-xs">
        <Link href="/termos" className="hover:text-foreground-muted">
          Termos de uso
        </Link>
        <span className="mx-2">-</span>
        <Link href="/privacidade" className="hover:text-foreground-muted">
          Politica de privacidade
        </Link>
      </footer>
    </div>
  );
}
