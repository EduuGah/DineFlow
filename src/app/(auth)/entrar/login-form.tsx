"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Mensagens dos erros que o fluxo de OAuth devolve na URL. */
const LOGIN_ERRORS: Record<string, string> = {
  "acesso-negado": "O acesso pela conta Google foi negado. Tente de novo.",
  "link-invalido": "O link de retorno era invalido. Comece o login novamente.",
  "sem-verificador":
    "A sessao do login se perdeu no caminho. Comece de novo por esta tela, no mesmo navegador.",
  "sessao-invalida": "Nao foi possivel concluir o login. Tente de novo.",
  "provedor-indisponivel":
    "O login com Google esta indisponivel no momento. Fale com o administrador.",
};

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden focusable="false">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.8Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.08 7.94-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.28a12 12 0 0 0 0 10.77l4.01-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.23 0 12 0A12 12 0 0 0 1.28 6.62l4.01 3.1C6.23 6.88 8.88 4.77 12 4.77Z"
      />
    </svg>
  );
}

export function LoginForm({ next, loginError }: { next?: string; loginError?: string }) {
  const [redirecting, setRedirecting] = useState(false);

  const error = loginError ? (LOGIN_ERRORS[loginError] ?? LOGIN_ERRORS["sessao-invalida"]) : null;

  return (
    /*
     * Formulario GET para um Route Handler, e nao Server Action.
     *
     * O handler precisa gravar o cookie do verificador PKCE na mesma resposta
     * que redireciona para o Google. Como bonus, funciona sem JavaScript.
     */
    <form
      action="/auth/login"
      method="get"
      onSubmit={() => setRedirecting(true)}
      className="flex flex-col gap-4"
    >
      <input type="hidden" name="proximo" value={next ?? ""} />

      {error ? (
        <p
          role="alert"
          className="bg-danger-soft text-danger flex items-start gap-2 rounded-[var(--radius-control)] px-3.5 py-3 text-sm font-medium"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        variant="outline"
        fullWidth
        icon={<GoogleMark />}
        loading={redirecting}
        loadingText="Abrindo o Google..."
      >
        Continuar com Google
      </Button>
    </form>
  );
}
