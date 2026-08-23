/*
 * Fuso fixado, e não o do ambiente.
 *
 * Estas funcoes rodam nos dois lados: no Server Component (servidor em UTC na
 * Vercel) e no browser (fuso do aparelho). Sem fixar, "pedido enviado as 20:32"
 * virava 23:32 na tela renderizada no servidor -- e o mesmo pedido mostrava
 * horários diferentes conforme a tela.
 *
 * O horário que importa num restaurante e o do salão. Enquanto o DineFlow
 * atende um pais só, a constante resolve; para operar fora do Brasil, o valor
 * precisa vir de `restaurants.timezone`, que já existe no banco.
 */
const TIMEZONE = "America/Sao_Paulo";

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const TIME = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIMEZONE,
});
const DATE_TIME = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: TIMEZONE,
});

export function formatCurrency(value: number | string | null | undefined): string {
  return BRL.format(Number(value ?? 0));
}

export function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "--:--";
  return TIME.format(new Date(value));
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "--";
  return DATE_TIME.format(new Date(value));
}

/**
 * Duracao curta para o timer da cozinha: "3min", "1h12". Segundos aparecem
 * só no primeiro minuto, quando ainda dizem algo.
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "--";

  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total}s`;

  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes}min`;

  const hours = Math.floor(minutes / 60);
  return `${hours}h${String(minutes % 60).padStart(2, "0")}`;
}

export function minutesSince(value: string | Date | null | undefined): number {
  if (!value) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
}

export function secondsSince(value: string | Date | null | undefined): number {
  if (!value) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
}

/** "agora", "há 5 min", "há 2 h" -- para listas de notificação e histórico. */
export function relativeTime(value: string | Date | null | undefined): string {
  if (!value) return "";

  const minutes = minutesSince(value);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;

  const days = Math.floor(hours / 24);
  return days === 1 ? "ontem" : `há ${days} dias`;
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
