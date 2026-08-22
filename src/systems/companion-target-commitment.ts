import type { CompanionCommand } from "../entities/companion";
import type { Point } from "./zombie-ai-system";
import { deterministicUnit } from "./zombie-organic-behavior";

export interface CompanionTargetCandidate {
  id: string;
  position: Point;
  alive?: boolean;
}

export interface CompanionTargetCommitmentState {
  currentTargetId?: string;
  lockedUntil: number;
  lastVisibleAt: number;
  nextRetargetAt: number;
  pendingTargetId?: string;
  pendingTargetReadyAt: number;
  targetSequence: number;
}

export const COMPANION_TARGET_LOCK_RANGE_MS = { minimum: 900, maximum: 1_500 } as const;
export const COMPANION_PENDING_RETARGET_RANGE_MS = { minimum: 180, maximum: 380 } as const;
export const COMPANION_TARGET_MEMORY_MS = 1_000;
export const COMPANION_TARGET_SCORE_HYSTERESIS = 1.3;

export function createCompanionTargetCommitmentState(): CompanionTargetCommitmentState {
  return { lockedUntil: 0, lastVisibleAt: 0, nextRetargetAt: 0, pendingTargetReadyAt: 0, targetSequence: 0 };
}

export interface CompanionTargetCommitmentUpdate<T extends CompanionTargetCandidate> {
  actorId: string;
  now: number;
  origin: Point;
  command: CompanionCommand;
  candidates: readonly T[];
  currentTarget?: T;
  focusTarget?: T;
  maximumDistance: number;
  immediateThreatDistance: number;
}

export function updateCompanionTargetCommitment<T extends CompanionTargetCandidate>(
  state: CompanionTargetCommitmentState,
  update: CompanionTargetCommitmentUpdate<T>,
): string | undefined {
  const focusTarget = update.focusTarget;
  if (update.command === "focus" && focusTarget && focusTarget.alive !== false) {
    commit(state, update.actorId, focusTarget.id, update.now, false);
    return state.currentTargetId;
  }

  const maximumDistanceSquared = update.maximumDistance * update.maximumDistance;
  const previousTargetId = state.currentTargetId;
  const current = update.currentTarget?.alive === false ? undefined : update.currentTarget;
  let currentVisible = false;
  let currentScore = 0;
  let best: T | undefined;
  let bestScore = 0;
  let immediate: T | undefined;
  let immediateScore = 0;
  const immediateDistanceSquared = update.immediateThreatDistance * update.immediateThreatDistance;
  for (const candidate of update.candidates) {
    if (candidate.alive === false) continue;
    const distanceSquared = squaredDistance(update.origin, candidate.position);
    if (distanceSquared > maximumDistanceSquared) continue;
    const score = targetScore(distanceSquared);
    if (candidate.id === state.currentTargetId) { currentVisible = true; currentScore = score; }
    if (score > bestScore) { best = candidate; bestScore = score; }
    if (distanceSquared <= immediateDistanceSquared && score > immediateScore) { immediate = candidate; immediateScore = score; }
  }
  if (currentVisible) state.lastVisibleAt = update.now;
  const currentRemembered = Boolean(current
    && squaredDistance(update.origin, current.position) <= maximumDistanceSquared
    && update.now - state.lastVisibleAt <= COMPANION_TARGET_MEMORY_MS);
  if (!currentRemembered) {
    state.currentTargetId = undefined;
  }
  if (immediate && immediate.id !== state.currentTargetId) {
    commit(state, update.actorId, immediate.id, update.now, false);
    return state.currentTargetId;
  }
  if (!state.currentTargetId) {
    if (best && (previousTargetId || state.pendingTargetId)) {
      if (state.pendingTargetId !== best.id) {
        state.targetSequence += 1;
        state.pendingTargetId = best.id;
        state.pendingTargetReadyAt = update.now + lerp(80, 180, deterministicUnit(update.actorId, state.targetSequence, `dead-retarget:${best.id}`));
      } else if (update.now >= state.pendingTargetReadyAt) commit(state, update.actorId, best.id, update.now, true);
    } else if (best) commit(state, update.actorId, best.id, update.now, false);
    return state.currentTargetId;
  }
  if (!best || best.id === state.currentTargetId || update.now < state.lockedUntil) {
    state.pendingTargetId = undefined;
    state.pendingTargetReadyAt = 0;
    return state.currentTargetId;
  }
  const rememberedScore = currentVisible ? currentScore : current ? targetScore(squaredDistance(update.origin, current.position)) * 0.8 : 0;
  if (bestScore < rememberedScore * COMPANION_TARGET_SCORE_HYSTERESIS) {
    state.pendingTargetId = undefined;
    state.pendingTargetReadyAt = 0;
    return state.currentTargetId;
  }
  if (state.pendingTargetId !== best.id) {
    state.targetSequence += 1;
    state.pendingTargetId = best.id;
    state.pendingTargetReadyAt = update.now + lerp(
      COMPANION_PENDING_RETARGET_RANGE_MS.minimum,
      COMPANION_PENDING_RETARGET_RANGE_MS.maximum,
      deterministicUnit(update.actorId, state.targetSequence, `retarget:${best.id}`),
    );
    return state.currentTargetId;
  }
  if (update.now >= state.pendingTargetReadyAt) commit(state, update.actorId, best.id, update.now, false);
  return state.currentTargetId;
}

export function clearCompanionTargetCommitment(state: CompanionTargetCommitmentState): void {
  state.currentTargetId = undefined;
  state.pendingTargetId = undefined;
  state.pendingTargetReadyAt = 0;
  state.lockedUntil = 0;
}

function commit(state: CompanionTargetCommitmentState, actorId: string, targetId: string, now: number, deadTargetReplacement: boolean): void {
  state.targetSequence += 1;
  state.currentTargetId = targetId;
  state.lastVisibleAt = now;
  state.pendingTargetId = undefined;
  state.pendingTargetReadyAt = 0;
  const minimum = deadTargetReplacement ? 80 : COMPANION_TARGET_LOCK_RANGE_MS.minimum;
  const maximum = deadTargetReplacement ? 180 : COMPANION_TARGET_LOCK_RANGE_MS.maximum;
  state.lockedUntil = now + lerp(minimum, maximum, deterministicUnit(actorId, state.targetSequence, `target-lock:${targetId}`));
  state.nextRetargetAt = state.lockedUntil;
}

function targetScore(distanceSquared: number): number { return 1 / Math.max(1, Math.sqrt(distanceSquared)); }
function squaredDistance(first: Point, second: Point): number { const x = first.x - second.x; const y = first.y - second.y; return x * x + y * y; }
function lerp(start: number, end: number, progress: number): number { return start + (end - start) * progress; }
