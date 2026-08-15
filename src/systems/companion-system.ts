import type { Point } from "./zombie-ai-system";

export interface FormationState {
  stableDirection: Point;
  candidateDirection: Point;
  candidateHeldMs: number;
}

export function createFormationState(): FormationState {
  return { stableDirection: { x: 0, y: 1 }, candidateDirection: { x: 0, y: 1 }, candidateHeldMs: 0 };
}

export function updateFormationDirection(state: FormationState, movement: Point, deltaMs: number, holdMs = 260): FormationState {
  const length = Math.hypot(movement.x, movement.y);
  if (length < 0.1) return state;
  const direction = { x: movement.x / length, y: movement.y / length };
  const candidateDot = direction.x * state.candidateDirection.x + direction.y * state.candidateDirection.y;
  const sameCandidate = candidateDot > 0.78;
  const candidateDirection = sameCandidate ? state.candidateDirection : direction;
  const candidateHeldMs = sameCandidate ? state.candidateHeldMs + deltaMs : 0;
  if (candidateHeldMs < holdMs) return { ...state, candidateDirection, candidateHeldMs };
  return { stableDirection: candidateDirection, candidateDirection, candidateHeldMs: 0 };
}

export function getFormationSlot(player: Point, state: FormationState, distance = 28): Point {
  return {
    x: player.x - state.stableDirection.x * distance,
    y: player.y - state.stableDirection.y * distance,
  };
}

