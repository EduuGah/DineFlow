import { cn } from "@/lib/utils/cn";

/**
 * Marca do DineFlow.
 *
 * Símbolo, sem letras: um wordmark não sobrevive ao tamanho em que a marca
 * mais aparece aqui -- 32px no cabeçalho de um celular, e no ícone da tela
 * inicial quando o garçom fixa o app.
 *
 * A forma junta as duas leituras que interessam ao produto: o círculo aberto é
 * um prato visto de cima, e também um ciclo. Os três nós marcam as etapas do
 * fluxo que o sistema existe para proteger -- lançar, preparar, entregar --
 * com opacidade decrescente sugerindo o sentido do movimento.
 */
export function Logo({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("size-9", className)}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <linearGradient id="dineflow-mark" x1="4" y1="2" x2="44" y2="46">
          <stop offset="0" stopColor="#FFC46B" />
          <stop offset="0.5" stopColor="#F2761C" />
          <stop offset="1" stopColor="#D23F16" />
        </linearGradient>
      </defs>

      <rect width="48" height="48" rx="13" fill="url(#dineflow-mark)" />

      {/* O ciclo: aberto no canto superior esquerdo, para o traço ter direção. */}
      <path
        d="M24 10.5A13.5 13.5 0 1 1 12.31 17.25"
        stroke="white"
        strokeOpacity="0.55"
        strokeWidth="2.75"
        strokeLinecap="round"
      />

      {/* Lançar, preparar, entregar. */}
      <circle cx="24" cy="10.5" r="3.4" fill="white" />
      <circle cx="35.7" cy="31.5" r="3.4" fill="white" fillOpacity="0.88" />
      <circle cx="12.3" cy="31.5" r="3.4" fill="white" fillOpacity="0.72" />

      {/* O pedido, no centro de tudo. */}
      <circle cx="24" cy="24" r="4.6" fill="white" fillOpacity="0.22" />
      <circle cx="24" cy="24" r="2" fill="white" fillOpacity="0.9" />
    </svg>
  );
}
