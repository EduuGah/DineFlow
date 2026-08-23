import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "DineFlow",
    template: "%s | DineFlow",
  },
  description:
    "Sistema de pedidos para restaurantes: do garçom a cozinha, em tempo real, sem perder pedido.",
  applicationName: "DineFlow",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fdfcfb" },
    { media: "(prefers-color-scheme: dark)", color: "#221f1d" },
  ],
  width: "device-width",
  initialScale: 1,
  // A equipe usa a tela com a mao molhada e apressada; o zoom por toque duplo
  // atrapalha mais do que ajuda, mas o pinch continua liberado por
  // acessibilidade (maximumScale não e travado).
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        {children}
        <Toaster position="top-center" richColors closeButton toastOptions={{ duration: 5000 }} />
      </body>
    </html>
  );
}
