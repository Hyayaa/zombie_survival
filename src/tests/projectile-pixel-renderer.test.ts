import { describe, expect, it } from "vitest";
import { createProjectilePixelPlan } from "../rendering/projectile-renderer";
import { WEAPON_DEFINITIONS } from "../data/weapon-definitions";

describe("projectile pixel renderer", () => {
  it("draws only short integer pixel head, body, and broken tail commands", () => {
    const plan = createProjectilePixelPlan({ x: 10.4, y: 12.6, velocityX: 100, velocityY: 37, visualLength: 8, visualWidth: 2 });
    expect(new Set(plan.map((item) => item.role))).toEqual(new Set(["head", "body", "tail"]));
    expect(plan.length).toBeLessThan(10);
    expect(plan.every((item) => Number.isInteger(item.x) && Number.isInteger(item.y) && item.width <= 2 && item.height <= 2)).toBe(true);
  });
  it("keeps rifle longest and shotgun shortest", () => {
    expect(WEAPON_DEFINITIONS.hunting_rifle.projectileVisualLength).toBeGreaterThan(WEAPON_DEFINITIONS.pistol.projectileVisualLength!);
    expect(WEAPON_DEFINITIONS.shotgun.projectileVisualLength).toBeLessThan(WEAPON_DEFINITIONS.pistol.projectileVisualLength!);
  });
});
