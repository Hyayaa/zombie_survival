import { describe, expect, it } from "vitest";
import { ZOMBIE_DEFINITIONS } from "../data/zombie-definitions";
import { getFinalZombieKnockback, ZOMBIE_KNOCKBACK_MULTIPLIERS } from "../systems/combat-system";

describe("zombie combat balance", () => {
  it("raises walker and runner durability without changing their offensive roles", () => {
    expect(ZOMBIE_DEFINITIONS.walker.health).toBe(72);
    expect(ZOMBIE_DEFINITIONS.runner.health).toBe(36);
    expect(ZOMBIE_DEFINITIONS.runner.health / 28).toBeLessThan(ZOMBIE_DEFINITIONS.walker.health / 48);
    expect(ZOMBIE_DEFINITIONS.walker.damage).toBe(9);
    expect(ZOMBIE_DEFINITIONS.runner.infectionBite).toBe(14);
  });

  it("applies one centralized bounded knockback multiplier and none for zero damage", () => {
    expect(ZOMBIE_KNOCKBACK_MULTIPLIERS).toEqual({ melee: 0.6, ranged: 0.5 });
    expect(getFinalZombieKnockback({ x: 12, y: -4 }, 10, "ranged")).toEqual({ x: 6, y: -2 });
    expect(getFinalZombieKnockback({ x: 12, y: -4 }, 10, "melee")).toEqual({ x: 7.199999999999999, y: -2.4 });
    expect(getFinalZombieKnockback({ x: 99, y: 99 }, 0, "ranged")).toEqual({ x: 0, y: 0 });
  });
});
