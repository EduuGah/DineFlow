import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { AppShell } from "@/components/shared/app-shell";
import { TooltipProvider } from "@/components/ui/dropdown";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireProfile();

  // Admin da plataforma não pertence a restaurante nenhum e não tem o que
  // fazer nas telas de operação.
  if (session.profile.role === "platform_admin") {
    redirect("/plataforma");
  }

  if (!session.restaurant) {
    redirect("/inicio");
  }

  return (
    <TooltipProvider>
      <AppShell
        user={{
          id: session.userId,
          name: session.profile.name,
          role: session.profile.role,
          restaurantName: session.restaurant.name,
        }}
      >
        {children}
      </AppShell>
    </TooltipProvider>
  );
}
