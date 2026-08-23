/**
 * Variaveis de ambiente validadas no boot.
 *
 * Falhar aqui, alto e cedo, e melhor do que descobrir um NEXT_PUBLIC_ vazio
 * quando o restaurante já está cheio.
 */

/*
 * As variaveis NEXT_PUBLIC_ são lidas por nome literal de proposito.
 * O Next substitui `process.env.NEXT_PUBLIC_X` pelo valor em tempo de build; um
 * acesso dinamico (`process.env[nome]`) não e substituido e chegaria vazio no
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
      "  4. Reinicie o servidor: o Next só le o .env.local na inicializacao.",
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
  // servidor e a forma mais lenta possível de configurar um projeto.
  const missing = missingPublicEnv();
  if (missing.length > 0) throw missingEnvError(missing);

  return {
    supabaseUrl: PUBLIC_VARS.NEXT_PUBLIC_SUPABASE_URL as string,
    supabaseAnonKey: PUBLIC_VARS.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  };
}

/*
 * Getters, e não um objeto pronto.
 *
 * `next build` importa todo modulo de página para coletar rotas. Se a
 * validação rodasse na avaliacao do modulo, um deploy sem as variaveis
 * configuradas quebraria no meio do "Collecting page data" -- longe do ponto
 * onde a variavel e de fato usada, e com um rastro de pilha que não ajuda
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
 * Endereço público desta instalação, usado para montar o retorno do OAuth.
 *
 * Precisa ser EXATAMENTE o dominio que a pessoa tem na barra do navegador. O
 * cookie do verificador PKCE e gravado no host da ida e lido no host da volta;
 * se os dois diferirem, o login falha sem erro aparente.
 *
 * Por isso `VERCEL_URL` não serve para producao: ela e o host daquele deploy
 * (`app-a1b2c3.vercel.app`), não o alias estavel que o usuário acessa. Em
 * producao vale `VERCEL_PROJECT_PRODUCTION_URL`; `VERCEL_URL` fica só para os
 * previews, onde o host do deploy e de fato o endereço visitado.
 *
 * Não derivamos do cabecalho Host de proposito: seria um valor vindo da
 * requisicao decidindo para onde a sessão volta.
 */
export function appUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");

  const isProduction = process.env.VERCEL_ENV === "production";
  const vercel = isProduction
    ? (process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim() ?? process.env.VERCEL_URL?.trim())
    : process.env.VERCEL_URL?.trim();

  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}

/**
 * Chave service_role: ignora o RLS por completo.
 *
 * Necessária apenas para criar credenciais de funcionário no Supabase Auth.
 * Resolvida sob demanda, e não no boot: um projeto sem ela configurada continua
 * rodando o resto do sistema -- só o cadastro de equipe falha, com mensagem
 * dizendo o que falta.
 *
 * Nunca importe este módulo de um componente cliente.
 */
export function serviceRoleKey(): string {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!value || value.trim() === "") {
    throw missingEnvError(["SUPABASE_SERVICE_ROLE_KEY"]);
  }

  return value;
}
