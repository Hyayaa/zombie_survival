import { COMPANION_MOVEMENT, MAP_HEIGHT_TILES, MAP_WIDTH_TILES, TILE_SIZE } from "../config/game-config";
import type { CompanionCommand } from "../entities/companion";
import type { WeaponDefinition } from "../data/weapon-definitions";
import type { Point } from "./zombie-ai-system";

export interface CompanionNavigationState {
  lastProgressX: number;
  lastProgressY: number;
  lastProgressAt: number;
  stuckSince: number;
  blockedMoveCount: number;
  lastGoalTile: number;
  catchUpMode: boolean;
  repathCount: number;
}

const STEERING_OFFSETS = [
  0,
  Math.PI / 8,
  -Math.PI / 8,
  Math.PI / 4,
  -Math.PI / 4,
  Math.PI * 3 / 8,
  -Math.PI * 3 / 8,
  Math.PI / 2,
  -Math.PI / 2,
] as const;

export function createCompanionNavigationState(position: Point, now = 0): CompanionNavigationState {
  return {
    lastProgressX: position.x,
    lastProgressY: position.y,
    lastProgressAt: now,
    stuckSince: 0,
    blockedMoveCount: 0,
    lastGoalTile: -1,
    catchUpMode: false,
    repathCount: 0,
  };
}

export function updateCatchUpMode(current: boolean, distanceToPlayer: number, command: CompanionCommand): boolean {
  if (command !== "follow") return false;
  if (current) return distanceToPlayer > COMPANION_MOVEMENT.catchUpExitDistance;
  return distanceToPlayer >= COMPANION_MOVEMENT.catchUpEnterDistance;
}

export function getCompanionFollowSpeed(distanceToPlayer: number): number {
  if (distanceToPlayer <= COMPANION_MOVEMENT.catchUpExitDistance) return COMPANION_MOVEMENT.baseSpeed;
  if (distanceToPlayer >= COMPANION_MOVEMENT.fullCatchUpDistance) return COMPANION_MOVEMENT.maxCatchUpSpeed;
  const ratio = (distanceToPlayer - COMPANION_MOVEMENT.catchUpExitDistance)
    / (COMPANION_MOVEMENT.fullCatchUpDistance - COMPANION_MOVEMENT.catchUpExitDistance);
  const smooth = ratio * ratio * (3 - 2 * ratio);
  return COMPANION_MOVEMENT.baseSpeed
    + (COMPANION_MOVEMENT.maxCatchUpSpeed - COMPANION_MOVEMENT.baseSpeed) * smooth;
}

export function findNearestWalkableGoal(
  requested: Point,
  canOccupy: (x: number, y: number) => boolean,
  maxRadiusTiles = 2,
  output: Point = { x: 0, y: 0 },
): Point | null {
  if (canOccupy(requested.x, requested.y)) {
    output.x = requested.x;
    output.y = requested.y;
    return output;
  }

  const requestedTileX = clampTile(Math.floor(requested.x / TILE_SIZE));
  const requestedTileY = clampTile(Math.floor(requested.y / TILE_SIZE));
  const centerX = tileCenter(requestedTileX);
  const centerY = tileCenter(requestedTileY);
  if (canOccupy(centerX, centerY)) {
    output.x = centerX;
    output.y = centerY;
    return output;
  }

  for (let radius = 1; radius <= maxRadiusTiles; radius += 1) {
    let found = false;
    let bestDistanceSquared = Number.POSITIVE_INFINITY;
    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
      for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
        if (Math.max(Math.abs(offsetX), Math.abs(offsetY)) !== radius) continue;
        const tileX = requestedTileX + offsetX;
        const tileY = requestedTileY + offsetY;
        if (tileX < 0 || tileY < 0 || tileX >= MAP_WIDTH_TILES || tileY >= MAP_HEIGHT_TILES) continue;
        const x = tileCenter(tileX);
        const y = tileCenter(tileY);
        if (!canOccupy(x, y)) continue;
        const deltaX = x - requested.x;
        const deltaY = y - requested.y;
        const distanceSquared = deltaX * deltaX + deltaY * deltaY;
        if (distanceSquared >= bestDistanceSquared) continue;
        bestDistanceSquared = distanceSquared;
        output.x = x;
        output.y = y;
        found = true;
      }
    }
    if (found) return output;
  }
  return null;
}

export function chooseLocalSteering(
  position: Point,
  target: Point,
  stepDistance: number,
  canOccupy: (x: number, y: number) => boolean,
  output: Point = { x: 0, y: 0 },
): Point | null {
  const baseAngle = Math.atan2(target.y - position.y, target.x - position.x);
  const currentDistanceSquared = squaredDistance(position.x, position.y, target.x, target.y);
  let found = false;
  let bestDistanceSquared = currentDistanceSquared;
  let bestRotation = Number.POSITIVE_INFINITY;
  for (const offset of STEERING_OFFSETS) {
    const angle = baseAngle + offset;
    const directionX = Math.cos(angle);
    const directionY = Math.sin(angle);
    const nextX = position.x + directionX * stepDistance;
    const nextY = position.y + directionY * stepDistance;
    if (!canOccupy(nextX, nextY)) continue;
    const candidateDistanceSquared = squaredDistance(nextX, nextY, target.x, target.y);
    const rotation = Math.abs(offset);
    if (candidateDistanceSquared > bestDistanceSquared + 0.001) continue;
    if (Math.abs(candidateDistanceSquared - bestDistanceSquared) < 0.001 && rotation >= bestRotation) continue;
    output.x = directionX;
    output.y = directionY;
    bestDistanceSquared = candidateDistanceSquared;
    bestRotation = rotation;
    found = true;
  }
  return found ? output : null;
}

export function updateCompanionStuckState(
  state: CompanionNavigationState,
  position: Point,
  now: number,
  hasMoveIntent: boolean,
): boolean {
  if (!hasMoveIntent) {
    resetProgress(state, position, now);
    return false;
  }

  const progress = Math.hypot(position.x - state.lastProgressX, position.y - state.lastProgressY);
  if (progress >= 0.35) {
    resetProgress(state, position, now);
    return false;
  }
  if (now - state.lastProgressAt < COMPANION_MOVEMENT.stuckThresholdMs) return false;
  if (state.stuckSince === 0) state.stuckSince = now;
  return true;
}

export function getCompanionStuckDuration(state: CompanionNavigationState, now: number): number {
  return state.stuckSince > 0 ? Math.max(0, now - state.stuckSince) : 0;
}

export function markCompanionBlocked(state: CompanionNavigationState): void {
  state.blockedMoveCount += 1;
}

export function markCompanionRepath(state: CompanionNavigationState): void {
  state.repathCount += 1;
  state.blockedMoveCount = 0;
}

export function getWorldTileIndex(point: Point): number {
  const x = clampTile(Math.floor(point.x / TILE_SIZE));
  const y = clampTile(Math.floor(point.y / TILE_SIZE));
  return y * MAP_WIDTH_TILES + x;
}

export function shouldPursueAutomaticTarget(catchUpMode: boolean, targetDistance: number): boolean {
  return !catchUpMode || targetDistance <= COMPANION_MOVEMENT.immediateThreatDistance;
}

export function shouldOverrideCompanionGoalForCombat(
  command: CompanionCommand,
  explicitFocus: boolean,
  catchUpMode: boolean,
  targetDistance: number,
): boolean {
  if (command === "focus" && explicitFocus) return true;
  return command === "follow" && shouldPursueAutomaticTarget(catchUpMode, targetDistance);
}

export interface CompanionTargetCandidate {
  id: string;
  position: Point;
}

export function selectCompanionCombatTarget<T extends CompanionTargetCandidate>(
  candidates: readonly T[],
  origin: Point,
  currentTargetId: string | undefined,
  focusTarget: T | undefined,
  maximumDistance: number,
): T | undefined {
  if (focusTarget) return focusTarget;
  const maximumDistanceSquared = maximumDistance * maximumDistance;
  let current: T | undefined;
  let currentDistanceSquared = Number.POSITIVE_INFINITY;
  let nearest: T | undefined;
  let nearestDistanceSquared = maximumDistanceSquared;
  for (const candidate of candidates) {
    const distanceSquared = squaredDistance(origin.x, origin.y, candidate.position.x, candidate.position.y);
    if (candidate.id === currentTargetId) { current = candidate; currentDistanceSquared = distanceSquared; }
    if (distanceSquared > nearestDistanceSquared) continue;
    nearest = candidate;
    nearestDistanceSquared = distanceSquared;
  }
  if (current && currentDistanceSquared <= maximumDistanceSquared
    && currentDistanceSquared <= nearestDistanceSquared * 1.35) return current;
  return nearest;
}

export type CompanionCombatMovement = "approach" | "hold" | "retreat";

export function getCompanionCombatMovement(
  weapon: WeaponDefinition,
  targetDistance: number,
  command: CompanionCommand,
  mayPursue: boolean,
): CompanionCombatMovement {
  if (weapon.kind === "melee") return targetDistance > weapon.range ? "approach" : "hold";
  if (command !== "hold" && targetDistance < weapon.range * 0.6) return "retreat";
  if (targetDistance > weapon.range * 0.82 && mayPursue && command !== "hold") return "approach";
  return "hold";
}

function resetProgress(state: CompanionNavigationState, position: Point, now: number): void {
  state.lastProgressX = position.x;
  state.lastProgressY = position.y;
  state.lastProgressAt = now;
  state.stuckSince = 0;
  state.blockedMoveCount = 0;
}

function squaredDistance(firstX: number, firstY: number, secondX: number, secondY: number): number {
  const deltaX = firstX - secondX;
  const deltaY = firstY - secondY;
  return deltaX * deltaX + deltaY * deltaY;
}

function clampTile(tile: number): number {
  return Math.max(0, Math.min(MAP_WIDTH_TILES - 1, tile));
}

function tileCenter(tile: number): number {
  return tile * TILE_SIZE + TILE_SIZE / 2;
}
