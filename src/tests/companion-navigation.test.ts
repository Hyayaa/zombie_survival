import { describe, expect, it } from "vitest";
import { MAX_PATHFINDING_PER_FRAME } from "../config/game-config";
import { COMPANION_MOVEMENT, TILE_SIZE } from "../config/game-config";
import { chooseLocalSteering, createCompanionNavigationState, findNearestWalkableGoal, getCompanionFollowSpeed, getCompanionStuckDuration, shouldOverrideCompanionGoalForCombat, shouldPursueAutomaticTarget, updateCatchUpMode, updateCompanionStuckState } from "../systems/companion-navigation";

describe("companion navigation", () => {
  it("keeps the shared pathfinding budget capped at four jobs per frame", () => {
    expect(MAX_PATHFINDING_PER_FRAME).toBe(4);
  });
  it("keeps an open formation slot and replaces a blocked slot with a nearby tile center", () => {
    const requested = { x: 100, y: 100 };
    expect(findNearestWalkableGoal(requested, () => true)).toEqual(requested);
    const replacement = findNearestWalkableGoal(requested, (x, y) => !(
      x === 100 && y === 100 || x === 108 && y === 108
    ));
    expect(replacement).not.toBeNull();
    expect(replacement).not.toEqual(requested);
    expect((replacement?.x ?? 0) % TILE_SIZE).toBe(TILE_SIZE / 2);
    expect((replacement?.y ?? 0) % TILE_SIZE).toBe(TILE_SIZE / 2);
  });

  it("returns no goal when every nearby tile is blocked", () => {
    expect(findNearestWalkableGoal({ x: 100, y: 100 }, () => false, 2)).toBeNull();
  });

  it("detects 250ms without progress and resets after movement", () => {
    const state = createCompanionNavigationState({ x: 20, y: 20 });
    expect(updateCompanionStuckState(state, { x: 20.2, y: 20 }, 249, true)).toBe(false);
    expect(updateCompanionStuckState(state, { x: 20.2, y: 20 }, 250, true)).toBe(true);
    expect(getCompanionStuckDuration(state, 500)).toBe(250);
    expect(updateCompanionStuckState(state, { x: 21, y: 20 }, 510, true)).toBe(false);
    expect(getCompanionStuckDuration(state, 510)).toBe(0);
  });

  it("chooses a side direction when forward movement is blocked", () => {
    const direction = chooseLocalSteering(
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      4,
      (x, y) => !(x > 3.9 && Math.abs(y) < 0.2),
    );
    expect(direction).not.toBeNull();
    expect(Math.abs(direction?.y ?? 0)).toBeGreaterThan(0);
    expect(chooseLocalSteering({ x: 0, y: 0 }, { x: 20, y: 0 }, 4, () => false)).toBeNull();
  });

  it("scales follow speed from 70 to a hard maximum of 136", () => {
    expect(getCompanionFollowSpeed(72)).toBe(COMPANION_MOVEMENT.baseSpeed);
    expect(getCompanionFollowSpeed(140)).toBeGreaterThan(COMPANION_MOVEMENT.baseSpeed);
    expect(getCompanionFollowSpeed(210)).toBe(COMPANION_MOVEMENT.maxCatchUpSpeed);
    expect(getCompanionFollowSpeed(1_000)).toBe(136);
  });

  it("uses 120/72 hysteresis only for follow commands", () => {
    expect(updateCatchUpMode(false, 119, "follow")).toBe(false);
    expect(updateCatchUpMode(false, 120, "follow")).toBe(true);
    expect(updateCatchUpMode(true, 100, "follow")).toBe(true);
    expect(updateCatchUpMode(true, 72, "follow")).toBe(false);
    expect(updateCatchUpMode(true, 300, "hold")).toBe(false);
    expect(updateCatchUpMode(true, 300, "move")).toBe(false);
    expect(updateCatchUpMode(true, 300, "focus")).toBe(false);
  });

  it("suppresses distant automatic pursuit during catch-up but allows immediate threats", () => {
    expect(shouldPursueAutomaticTarget(true, 100)).toBe(false);
    expect(shouldPursueAutomaticTarget(true, COMPANION_MOVEMENT.immediateThreatDistance)).toBe(true);
    expect(shouldPursueAutomaticTarget(false, 100)).toBe(true);
    expect(shouldOverrideCompanionGoalForCombat("follow", false, true, 100)).toBe(false);
    expect(shouldOverrideCompanionGoalForCombat("move", false, false, 20)).toBe(false);
    expect(shouldOverrideCompanionGoalForCombat("hold", false, false, 20)).toBe(false);
    expect(shouldOverrideCompanionGoalForCombat("focus", true, false, 200)).toBe(true);
  });
});
