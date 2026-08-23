"use client";

import { useSyncExternalStore } from "react";
import {
  isSoundEnabled,
  setSoundEnabled,
  soundPreferenceServerSnapshot,
  subscribeSoundPreference,
} from "@/lib/sound";

/** Preferencia de som persistida, compartilhada entre abas. */
export function useSoundPreference(): [boolean, (enabled: boolean) => void] {
  const enabled = useSyncExternalStore(
    subscribeSoundPreference,
    isSoundEnabled,
    soundPreferenceServerSnapshot,
  );

  return [enabled, setSoundEnabled];
}
