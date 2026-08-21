import { describe, expect, it } from "vitest";
import { getZombieMovementSpeed, ZOMBIE_BASE_SPEEDS, ZOMBIE_DEFINITIONS, ZOMBIE_GLOBAL_MOVEMENT_MULTIPLIERS } from "../data/zombie-definitions";

describe("zombie movement speed", () => {
  it("applies each global multiplier once at the definition source", () => {
    expect(ZOMBIE_GLOBAL_MOVEMENT_MULTIPLIERS).toEqual({ walker: 1.45, runner: 1.30 });
    expect(ZOMBIE_DEFINITIONS.walker.speed).toBeCloseTo(ZOMBIE_BASE_SPEEDS.walker * 1.45);
    expect(ZOMBIE_DEFINITIONS.runner.speed).toBeCloseTo(ZOMBIE_BASE_SPEEDS.runner * 1.30);
    expect(getZombieMovementSpeed("walker")).toBe(ZOMBIE_DEFINITIONS.walker.speed);
  });
});
