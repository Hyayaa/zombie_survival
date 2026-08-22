export interface ActorMotionSmoothingState {
  currentSpeed: number;
  desiredSpeed: number;
  currentMoveAngle: number;
  desiredMoveAngle: number;
  bodyAngle: number;
  desiredBodyAngle: number;
  headAngle: number;
  desiredHeadAngle: number;
}

export interface ActorMotionSmoothingProfile {
  acceleration: number;
  deceleration: number;
  moveTurnRate: number;
  bodyTurnRate: number;
  headTurnRate: number;
  maximumHeadLead: number;
}

export const WALKER_MOTION_PROFILE: Readonly<ActorMotionSmoothingProfile> = Object.freeze({
  acceleration: 320, deceleration: 440, moveTurnRate: 4.2, bodyTurnRate: 3.4, headTurnRate: 5.4, maximumHeadLead: Math.PI / 5,
});
export const RUNNER_MOTION_PROFILE: Readonly<ActorMotionSmoothingProfile> = Object.freeze({
  acceleration: 370, deceleration: 500, moveTurnRate: 5.6, bodyTurnRate: 4.8, headTurnRate: 7, maximumHeadLead: Math.PI / 5,
});
export const COMPANION_MOTION_PROFILE: Readonly<ActorMotionSmoothingProfile> = Object.freeze({
  acceleration: 400, deceleration: 540, moveTurnRate: 6.3, bodyTurnRate: 5.5, headTurnRate: 8.5, maximumHeadLead: Math.PI / 5,
});

export function createActorMotionSmoothingState(angle = 0): ActorMotionSmoothingState {
  const normalized = normalizeAngle(angle);
  return {
    currentSpeed: 0,
    desiredSpeed: 0,
    currentMoveAngle: normalized,
    desiredMoveAngle: normalized,
    bodyAngle: normalized,
    desiredBodyAngle: normalized,
    headAngle: normalized,
    desiredHeadAngle: normalized,
  };
}

export function updateActorMotionSmoothing(
  state: ActorMotionSmoothingState,
  profile: ActorMotionSmoothingProfile,
  deltaSeconds: number,
  turnRateMultiplier = 1,
): void {
  const delta = Math.max(0, Number.isFinite(deltaSeconds) ? deltaSeconds : 0);
  const rate = Math.max(1, Number.isFinite(turnRateMultiplier) ? turnRateMultiplier : 1);
  if (!Number.isFinite(state.desiredSpeed)) state.desiredSpeed = 0;
  if (!Number.isFinite(state.desiredMoveAngle)) state.desiredMoveAngle = state.currentMoveAngle;
  if (!Number.isFinite(state.desiredBodyAngle)) state.desiredBodyAngle = state.bodyAngle;
  if (!Number.isFinite(state.desiredHeadAngle)) state.desiredHeadAngle = state.headAngle;
  const speedRate = state.desiredSpeed >= state.currentSpeed ? profile.acceleration : profile.deceleration;
  state.currentSpeed = moveTowards(state.currentSpeed, Math.max(0, state.desiredSpeed), speedRate * delta);
  state.currentMoveAngle = approachAngle(state.currentMoveAngle, state.desiredMoveAngle, profile.moveTurnRate * rate * delta);
  state.desiredBodyAngle = state.currentSpeed > 0.5 ? state.currentMoveAngle : state.desiredHeadAngle;
  state.bodyAngle = approachAngle(state.bodyAngle, state.desiredBodyAngle, profile.bodyTurnRate * rate * delta);
  const limitedHeadTarget = state.bodyAngle + clamp(angleDifference(state.desiredHeadAngle, state.bodyAngle), -profile.maximumHeadLead, profile.maximumHeadLead);
  state.headAngle = approachAngle(state.headAngle, limitedHeadTarget, profile.headTurnRate * rate * delta);
  state.desiredMoveAngle = normalizeAngle(state.desiredMoveAngle);
  state.desiredBodyAngle = normalizeAngle(state.desiredBodyAngle);
  state.desiredHeadAngle = normalizeAngle(state.desiredHeadAngle);
}

export function moveTowards(current: number, target: number, maximumDelta: number): number {
  if (!Number.isFinite(current) || !Number.isFinite(target)) return Number.isFinite(target) ? target : 0;
  const delta = target - current;
  const limit = Math.max(0, Number.isFinite(maximumDelta) ? maximumDelta : 0);
  if (Math.abs(delta) <= limit) return target;
  return current + Math.sign(delta) * limit;
}

export function approachAngle(current: number, target: number, maximumDelta: number): number {
  const delta = angleDifference(target, current);
  const limit = Math.max(0, Number.isFinite(maximumDelta) ? maximumDelta : 0);
  if (Math.abs(delta) <= limit) return normalizeAngle(target);
  return normalizeAngle(current + Math.sign(delta) * limit);
}

export function angleDifference(target: number, current: number): number {
  return normalizeAngle(target - current);
}

export function normalizeAngle(angle: number): number {
  if (!Number.isFinite(angle)) return 0;
  let normalized = (angle + Math.PI) % (Math.PI * 2);
  if (normalized < 0) normalized += Math.PI * 2;
  return normalized - Math.PI;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
