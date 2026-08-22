import { describe, expect, it } from "vitest";
import { spreadToCrosshairGap } from "../systems/weapon-accuracy-system";
import { shouldShowWeaponCrosshair, WEAPON_CROSSHAIR_HIT_DURATION_MS } from "../ui/weapon-crosshair";

describe("weapon crosshair policy", () => {
  it("clamps gap and expands it from the same spread helper", () => {
    expect(spreadToCrosshairGap(0)).toBe(5);
    expect(spreadToCrosshairGap(0.2)).toBeGreaterThan(5);
    expect(spreadToCrosshairGap(2)).toBe(36);
  });
  it("keeps hit feedback light and shorter than 100ms", () => {
    expect(WEAPON_CROSSHAIR_HIT_DURATION_MS).toBeGreaterThanOrEqual(65);
    expect(WEAPON_CROSSHAIR_HIT_DURATION_MS).toBeLessThanOrEqual(100);
  });
  it("shows only for focused ranged play inside the game", () => {
    expect(shouldShowWeaponCrosshair({ ranged: true, pointerInsideGame: true, windowFocused: true, blocked: false })).toBe(true);
    expect(shouldShowWeaponCrosshair({ ranged: false, pointerInsideGame: true, windowFocused: true, blocked: false })).toBe(false);
    expect(shouldShowWeaponCrosshair({ ranged: true, pointerInsideGame: false, windowFocused: true, blocked: false })).toBe(false);
    expect(shouldShowWeaponCrosshair({ ranged: true, pointerInsideGame: true, windowFocused: true, blocked: true })).toBe(false);
  });
});
