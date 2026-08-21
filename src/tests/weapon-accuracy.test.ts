import { describe, expect, it } from "vitest";
import { WEAPON_DEFINITIONS } from "../data/weapon-definitions";
import { createWeaponAccuracyState, deterministicProjectileAngle, getEffectiveWeaponSpread, recordWeaponShot, recoverWeaponBloom, spreadToCrosshairGap } from "../systems/weapon-accuracy-system";

describe("weapon accuracy", () => {
  it("shares stationary, movement, running, bloom, and crosshair spread", () => {
    const weapon = WEAPON_DEFINITIONS.smg; const state = createWeaponAccuracyState();
    const stationary = getEffectiveWeaponSpread(weapon, state, "stationary");
    const walking = getEffectiveWeaponSpread(weapon, state, "walking");
    const running = getEffectiveWeaponSpread(weapon, state, "running");
    expect(stationary).toBeLessThan(walking); expect(walking).toBeLessThan(running);
    recordWeaponShot(state, weapon, 0); recordWeaponShot(state, weapon, 100);
    expect(getEffectiveWeaponSpread(weapon, state, "stationary")).toBeGreaterThan(stationary);
    expect(state.bloomRadians).toBeLessThanOrEqual(weapon.maximumBloomRadians!);
    recoverWeaponBloom(state, weapon, 1); expect(state.bloomRadians).toBe(0);
    expect(spreadToCrosshairGap(running)).toBeGreaterThan(spreadToCrosshairGap(stationary));
  });
  it("creates deterministic angles inside effective spread", () => {
    const angle = deterministicProjectileAngle(1, 0.2, 7, 2, 6);
    expect(angle).toBe(deterministicProjectileAngle(1, 0.2, 7, 2, 6));
    expect(Math.abs(angle - 1)).toBeLessThanOrEqual(0.2);
  });
});
