import type { ZombieKind, ZombieStateName } from "../data/zombie-definitions";
import type { HeardNoise, NoiseCategory } from "./noise-system";

export type ZombieReactionKind = "visual" | "noise";

export interface ZombieReactionState {
  kind: ZombieReactionKind;
  readyAt: number;
  startedAt: number;
  targetId?: string;
  stimulusX: number;
  stimulusY: number;
  stimulusStrength: number;
  stimulusDistance: number;
  stimulusSequence: number;
  noiseCategory?: NoiseCategory;
}

export interface ZombieGaitState {
  currentMultiplier: number;
  startMultiplier: number;
  targetMultiplier: number;
  transitionStartedAt: number;
  transitionEndsAt: number;
  nextTargetAt: number;
  gaitSequence: number;
}

export interface ZombieOrganicBehaviorState {
  reaction?: ZombieReactionState;
  reactionSequence: number;
  gait: ZombieGaitState;
  blockedSince: number;
  lastAcceptedNoiseAt: number;
}

export const ZOMBIE_VISUAL_REACTION_RANGE_MS = {
  walker: { minimum: 140, maximum: 420 },
  runner: { minimum: 80, maximum: 250 },
} as const;

export const ZOMBIE_NOISE_REACTION_RANGE_MS: Record<NoiseCategory, { minimum: number; maximum: number }> = {
  gunshot: { minimum: 90, maximum: 260 },
  explosion: { minimum: 60, maximum: 190 },
  walk: { minimum: 360, maximum: 680 },
  run: { minimum: 260, maximum: 560 },
  melee: { minimum: 180, maximum: 440 },
  glass: { minimum: 120, maximum: 360 },
  door: { minimum: 220, maximum: 520 },
  craft: { minimum: 210, maximum: 500 },
};

export const ZOMBIE_GAIT_RANGES: Record<"Chase" | "InvestigateNoise" | "SearchLastKnownPosition" | "Wander", Record<ZombieKind, readonly [number, number]>> = {
  Chase: { walker: [0.8, 1.2], runner: [0.88, 1.13] },
  InvestigateNoise: { walker: [0.84, 1.1], runner: [0.88, 1.08] },
  SearchLastKnownPosition: { walker: [0.75, 1.05], runner: [0.82, 1.05] },
  Wander: { walker: [0.82, 1.08], runner: [0.86, 1.06] },
};

export function createZombieOrganicBehaviorState(id: string): ZombieOrganicBehaviorState {
  return {
    reactionSequence: 0,
    gait: {
      currentMultiplier: 1,
      startMultiplier: 1,
      targetMultiplier: 1,
      transitionStartedAt: 0,
      transitionEndsAt: 0,
      nextTargetAt: 700 + Math.floor(deterministicUnit(id, 0, "gait-offset") * 900),
      gaitSequence: 0,
    },
    blockedSince: 0,
    lastAcceptedNoiseAt: -Infinity,
  };
}

export function beginVisualReaction(
  state: ZombieOrganicBehaviorState,
  id: string,
  kind: ZombieKind,
  now: number,
  targetId: string,
  targetX: number,
  targetY: number,
  distance: number,
  attackRange: number,
): ZombieReactionState {
  if (state.reaction?.kind === "visual" && state.reaction.targetId === targetId) return state.reaction;
  const sequence = ++state.reactionSequence;
  const range = ZOMBIE_VISUAL_REACTION_RANGE_MS[kind];
  const distanceUrgency = clamp01(1 - distance / 220);
  const variation = deterministicUnit(id, sequence, `visual:${targetId}`);
  let delay = lerp(range.maximum, range.minimum, clamp01(distanceUrgency * 0.72 + variation * 0.28));
  if (distance <= attackRange * 1.5) delay = Math.min(delay, kind === "runner" ? 40 : 90);
  state.reaction = {
    kind: "visual",
    readyAt: now + delay,
    startedAt: now,
    targetId,
    stimulusX: targetX,
    stimulusY: targetY,
    stimulusStrength: 1,
    stimulusDistance: distance,
    stimulusSequence: sequence,
  };
  return state.reaction;
}

export function beginNoiseReaction(
  state: ZombieOrganicBehaviorState,
  id: string,
  now: number,
  noise: HeardNoise,
): ZombieReactionState | undefined {
  if (state.reaction?.kind === "visual") return state.reaction;
  if (noise.createdAt <= state.lastAcceptedNoiseAt && !state.reaction) return undefined;
  const sequence = state.reactionSequence + 1;
  const range = ZOMBIE_NOISE_REACTION_RANGE_MS[noise.category];
  const intensityFactor = clamp01(noise.perceivedIntensity / Math.max(1, noise.intensity));
  const distanceFactor = clamp01(1 - noise.distance / Math.max(1, noise.radius));
  const urgency = clamp01(intensityFactor * 0.65 + distanceFactor * 0.35);
  const variation = deterministicUnit(id, sequence, `noise:${noise.category}:${Math.round(noise.createdAt)}`);
  const delay = lerp(range.maximum, range.minimum, clamp01(urgency * 0.82 + variation * 0.18));
  const candidateReadyAt = now + delay;
  const pending = state.reaction;
  const meaningfullyStronger = !pending || noise.perceivedIntensity >= pending.stimulusStrength * 1.2;
  const meaningfullyCloser = !pending || noise.distance + 24 < pending.stimulusDistance;
  if (pending && !meaningfullyStronger && !meaningfullyCloser && candidateReadyAt >= pending.readyAt) return pending;
  state.reactionSequence = sequence;
  state.lastAcceptedNoiseAt = Math.max(state.lastAcceptedNoiseAt, noise.createdAt);
  state.reaction = {
    kind: "noise",
    readyAt: pending ? Math.min(pending.readyAt, candidateReadyAt) : candidateReadyAt,
    startedAt: now,
    stimulusX: noise.x,
    stimulusY: noise.y,
    stimulusStrength: noise.perceivedIntensity,
    stimulusDistance: noise.distance,
    stimulusSequence: sequence,
    noiseCategory: noise.category,
  };
  return state.reaction;
}

export function consumeReadyZombieReaction(state: ZombieOrganicBehaviorState, now: number): ZombieReactionState | undefined {
  if (!state.reaction || now < state.reaction.readyAt) return undefined;
  const reaction = state.reaction;
  state.reaction = undefined;
  return reaction;
}

export function updateZombieGait(
  state: ZombieOrganicBehaviorState,
  id: string,
  kind: ZombieKind,
  mindState: ZombieStateName,
  now: number,
): number {
  const gait = state.gait;
  if (mindState === "Stagger" || mindState === "Dead" || mindState === "Attack") return gait.currentMultiplier;
  const gaitState = gaitStateFor(mindState);
  if (now >= gait.nextTargetAt) {
    gait.gaitSequence += 1;
    const range = ZOMBIE_GAIT_RANGES[gaitState][kind];
    gait.startMultiplier = gait.currentMultiplier;
    gait.targetMultiplier = lerp(range[0], range[1], deterministicUnit(id, gait.gaitSequence, `gait:${kind}:${gaitState}`));
    gait.transitionStartedAt = now;
    gait.transitionEndsAt = now + lerp(250, 520, deterministicUnit(id, gait.gaitSequence, "gait-transition"));
    gait.nextTargetAt = now + lerp(700, 1_600, deterministicUnit(id, gait.gaitSequence, "gait-period"));
  }
  const duration = Math.max(1, gait.transitionEndsAt - gait.transitionStartedAt);
  const progress = clamp01((now - gait.transitionStartedAt) / duration);
  gait.currentMultiplier = lerp(gait.startMultiplier, gait.targetMultiplier, smoothstep(progress));
  return gait.currentMultiplier;
}

export function deterministicUnit(id: string, sequence: number, eventKind: string): number {
  let hash = 0x811c9dc5;
  const input = `${id}|${sequence}|${eventKind}`;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0x1_0000_0000;
}

function gaitStateFor(state: ZombieStateName): keyof typeof ZOMBIE_GAIT_RANGES {
  if (state === "Chase") return "Chase";
  if (state === "InvestigateNoise") return "InvestigateNoise";
  if (state === "SearchLastKnownPosition") return "SearchLastKnownPosition";
  return "Wander";
}

function clamp01(value: number): number { return Math.max(0, Math.min(1, value)); }
function lerp(start: number, end: number, progress: number): number { return start + (end - start) * progress; }
function smoothstep(progress: number): number { return progress * progress * (3 - 2 * progress); }
