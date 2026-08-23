const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const TIME = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const DATE_TIME = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
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
 * so no primeiro minuto, quando ainda dizem algo.
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

/** "agora", "ha 5 min", "ha 2 h" -- para listas de notificacao e historico. */
export function relativeTime(value: string | Date | null | undefined): string {
  if (!value) return "";

  const minutes = minutesSince(value);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `ha ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `ha ${hours} h`;

  const days = Math.floor(hours / 24);
  return days === 1 ? "ontem" : `ha ${days} dias`;
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
