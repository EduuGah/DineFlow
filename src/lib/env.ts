/**
 * Variaveis de ambiente validadas no boot.
 *
 * Falhar aqui, alto e cedo, e melhor do que descobrir um NEXT_PUBLIC_ vazio
 * quando o restaurante ja esta cheio.
 */

/*
 * As variaveis NEXT_PUBLIC_ sao lidas por nome literal de proposito.
 * O Next substitui `process.env.NEXT_PUBLIC_X` pelo valor em tempo de build; um
 * acesso dinamico (`process.env[nome]`) nao e substituido e chegaria vazio no
 * browser, mesmo com o .env.local correto.
 */
const PUBLIC_VARS = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
} as const;

function missingEnvError(names: string[]): Error {
  const lista = names.map((name) => `  - ${name}`).join("\n");

  return new Error(
    [
      "",
      names.length === 1
        ? "Falta uma variavel de ambiente:"
        : `Faltam ${names.length} variaveis de ambiente:`,
      lista,
      "",
      "Como resolver:",
      "  1. Crie o arquivo .env.local na RAIZ do projeto (ao lado do package.json).",
      "  2. Copie o conteudo de .env.example e preencha os valores.",
      "  3. Pegue os valores no painel do Supabase, em Project Settings > API.",
      "  4. Reinicie o servidor: o Next so le o .env.local na inicializacao.",
      "",
    ].join("\n"),
  );
}

export function missingPublicEnv(): string[] {
  return Object.entries(PUBLIC_VARS)
    .filter(([, value]) => !value || value.trim() === "")
    .map(([name]) => name);
}

function readPublicEnv(): { supabaseUrl: string; supabaseAnonKey: string } {
  // Reporta tudo que falta de uma vez: descobrir uma variavel por reinicio do
  // servidor e a forma mais lenta possivel de configurar um projeto.
  const missing = missingPublicEnv();
  if (missing.length > 0) throw missingEnvError(missing);

  return {
    supabaseUrl: PUBLIC_VARS.NEXT_PUBLIC_SUPABASE_URL as string,
    supabaseAnonKey: PUBLIC_VARS.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  };
}

/*
 * Getters, e nao um objeto pronto.
 *
 * `next build` importa todo modulo de pagina para coletar rotas. Se a
 * validacao rodasse na avaliacao do modulo, um deploy sem as variaveis
 * configuradas quebraria no meio do "Collecting page data" -- longe do ponto
 * onde a variavel e de fato usada, e com um rastro de pilha que nao ajuda
 * ninguem. Adiando para o primeiro uso, o build termina e o erro aparece na
 * requisicao, com a mensagem inteira.
 */
export const env = {
  get supabaseUrl() {
    return readPublicEnv().supabaseUrl;
  },
  get supabaseAnonKey() {
    return readPublicEnv().supabaseAnonKey;
  },
};

/**
 * Endereco publico desta instalacao, usado para montar o retorno do OAuth.
 *
 * A ordem importa. `NEXT_PUBLIC_APP_URL` vem primeiro porque e a unica que o
 * dono do projeto controla; `VERCEL_URL` cobre os deploys de preview, cuja URL
 * muda a cada commit e nao caberia numa variavel fixa.
 *
 * Nao derivamos do cabecalho Host de proposito: seria um valor vindo da
 * requisicao decidindo para onde a sessao volta.
 */
export function appUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}
