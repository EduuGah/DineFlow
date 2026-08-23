import type { NextConfig } from "next";
import { missingPublicEnv } from "./src/lib/env";

/*
 * Aviso alto no log de build.
 *
 * As variaveis NEXT_PUBLIC_ sao embutidas no bundle em tempo de build: um
 * deploy feito sem elas gera um app que compila e nao funciona. Como quebrar o
 * build inteiro por isso atrapalha mais do que ajuda (o log fica ilegivel e o
 * deploy anterior continua no ar sem explicacao), avisamos de forma
 * impossivel de ignorar e deixamos o build seguir.
 */
const missing = missingPublicEnv();

if (missing.length > 0) {
  console.warn(
    [
      "",
      "  ┌───────────────────────────────────────────────────────────────┐",
      "  │  DineFlow: variaveis de ambiente ausentes neste build         │",
      "  └───────────────────────────────────────────────────────────────┘",
      ...missing.map((name) => `    - ${name}`),
      "",
      "  Elas sao embutidas no bundle durante o build, entao o app vai",
      "  compilar mas nao vai conseguir falar com o Supabase.",
      "",
      "  Na Vercel: Project Settings > Environment Variables.",
      "  Depois de salvar, REFACA O DEPLOY -- alterar a variavel nao",
      "  reaproveita o build anterior.",
      "",
    ].join("\n"),
  );
}

const nextConfig: NextConfig = {/* config options here */};

export default nextConfig;
