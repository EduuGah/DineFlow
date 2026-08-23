import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ proximo?: string; erro?: string }>;
}) {
  const { proximo, erro } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-foreground text-2xl font-bold tracking-tight">Entrar no DineFlow</h1>
        <p className="text-foreground-muted mt-1 text-sm">
          Use a conta Google do seu e-mail de trabalho.
        </p>
      </div>

      <LoginForm next={proximo} loginError={erro} />

      <div className="bg-surface-muted text-foreground-muted rounded-[var(--radius-control)] px-4 py-3 text-sm">
        <p className="text-foreground font-medium">Primeira vez aqui?</p>
        <p className="mt-1">
          Se voce e dono do restaurante, entre com o Google e cadastre o restaurante na tela
          seguinte. Se voce faz parte da equipe, o gerente precisa convidar o seu e-mail antes do
          primeiro acesso.
        </p>
      </div>
    </div>
  );
}
