import type { AudioCue } from "../data/audio-definitions";
import type { NoiseCategory } from "./noise-system";

export const FOOTSTEP_CADENCE_MS = { walk: 540, run: 285 } as const;

export interface FootstepEvent {
  cue: Extract<AudioCue, "footstep-walk" | "footstep-run">;
  category: Extract<NoiseCategory, "walk" | "run">;
  nextAt: number;
}

export function getFootstepEvent(actualMoved: boolean, actualRunning: boolean, now: number, nextAt: number, simulationPaused = false): FootstepEvent | undefined {
  if (simulationPaused || !actualMoved || now < nextAt) return undefined;
  const category = actualRunning ? "run" : "walk";
  return {
    cue: actualRunning ? "footstep-run" : "footstep-walk",
    category,
    nextAt: now + FOOTSTEP_CADENCE_MS[category],
  };
}
