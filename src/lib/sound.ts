"use client";

/**
 * Alerta sonoro da operacao.
 *
 * O som e sintetizado no Web Audio em vez de carregado de um arquivo: toca
 * mesmo com a internet caida, nao atrasa o primeiro carregamento e nao vira
 * mais um asset para servir numa cozinha com Wi-Fi ruim.
 *
 * Navegador so libera audio depois de um gesto do usuario -- por isso
 * `unlockAudio()` e chamado no primeiro toque da tela.
 */

const STORAGE_KEY = "dineflow:sound";

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  const AudioContextClass =
    window.AudioContext ??
    (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) return null;

  context ??= new AudioContextClass();
  return context;
}

export function unlockAudio() {
  const ctx = getContext();
  if (ctx?.state === "suspended") void ctx.resume();
}

const preferenceListeners = new Set<() => void>();

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) !== "off";
}

export function setSoundEnabled(enabled: boolean) {
  window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  for (const listener of preferenceListeners) listener();
}

/**
 * Store externa da preferencia de som, para consumo via useSyncExternalStore.
 * O evento `storage` mantem as abas em sincronia -- a cozinha costuma deixar o
 * KDS aberto em mais de uma tela.
 */
export function subscribeSoundPreference(listener: () => void) {
  preferenceListeners.add(listener);
  window.addEventListener("storage", listener);

  return () => {
    preferenceListeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** No servidor nao ha localStorage; assumimos ligado, que e o padrao. */
export function soundPreferenceServerSnapshot(): boolean {
  return true;
}

type Tone = { frequency: number; duration: number; delay: number };

const PATTERNS: Record<"newOrder" | "ready" | "alert", Tone[]> = {
  // Dois tons subindo: "chegou coisa nova".
  newOrder: [
    { frequency: 660, duration: 0.12, delay: 0 },
    { frequency: 880, duration: 0.16, delay: 0.13 },
  ],
  // Tres tons curtos, mais agudos: corta o barulho do salao.
  ready: [
    { frequency: 880, duration: 0.1, delay: 0 },
    { frequency: 1046, duration: 0.1, delay: 0.11 },
    { frequency: 1318, duration: 0.18, delay: 0.22 },
  ],
  // Um tom grave: algo deu errado.
  alert: [{ frequency: 320, duration: 0.3, delay: 0 }],
};

export function playAlert(kind: keyof typeof PATTERNS = "newOrder") {
  if (!isSoundEnabled()) return;

  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();

  const now = ctx.currentTime;

  for (const tone of PATTERNS[kind]) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = tone.frequency;

    // Envelope curto evita o "clique" de ligar/desligar o oscilador seco.
    const start = now + tone.delay;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.22, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);

    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + tone.duration + 0.02);
  }
}
