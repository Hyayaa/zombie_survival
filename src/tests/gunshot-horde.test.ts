import { describe, expect, it } from "vitest";
import { GUNSHOT_PRESSURE_MAX, NoiseSystem } from "../systems/noise-system";
import { getHordeActivationCount, getHordeActivationIntervalMs, HORDE_SPAWN_SCAN_BUDGET, isEligibleHordeSpawn } from "../systems/gunshot-horde-system";

describe("gunshot horde pressure", () => {
  it("uses weapon-specific pressure and accumulates automatic fire", () => {
    const pistol = new NoiseSystem(); pistol.emitGunshot("pistol", 0, 0, 90, 0);
    const shotgun = new NoiseSystem(); shotgun.emitGunshot("shotgun", 0, 0, 120, 0);
    const rifle = new NoiseSystem(); rifle.emitGunshot("hunting_rifle", 0, 0, 135, 0);
    const smg = new NoiseSystem(); for (let index = 0; index < 5; index += 1) smg.emitGunshot("smg", 0, 0, 82, index * 100);
    expect(shotgun.getGunshotPressure().value).toBeGreaterThan(pistol.getGunshotPressure().value);
    expect(rifle.getGunshotPressure().value).toBeGreaterThan(pistol.getGunshotPressure().value);
    expect(smg.getGunshotPressure().value).toBeCloseTo(1.8);
  });

  it("decays pressure, caps it, and keeps turret pressure lighter", () => {
    const noise = new NoiseSystem(); for (let index = 0; index < 20; index += 1) noise.emitGunshot("shotgun", 0, 0, 120, index);
    expect(noise.getGunshotPressure().value).toBe(GUNSHOT_PRESSURE_MAX);
    noise.updateGunshotPressure(10); expect(noise.getGunshotPressure().value).toBeLessThan(GUNSHOT_PRESSURE_MAX);
    const turret = new NoiseSystem(); turret.emitGunshot("turret", 0, 0, 72, 0);
    expect(turret.getGunshotPressure().value).toBeLessThan(1);
  });

  it("alerts active zombies inside the firearm radius and refreshes the attractor", () => {
    const noise = new NoiseSystem(); noise.emitGunshot("pistol", 100, 200, 90, 100);
    expect(noise.loudestHeard(700, 200, 0.67, 100)?.category).toBe("gunshot");
    expect(noise.loudestHeard(900, 200, 1, 100)).toBeUndefined();
    noise.emitGunshot("pistol", 200, 300, 90, 200);
    expect(noise.getGunshotAttractor(201)?.lastShotAt).toBe(200);
  });

  it("bounds incremental dormant activation and rejects unsafe spawn points", () => {
    expect(getHordeActivationCount(1)).toBe(0);
    expect(getHordeActivationCount(2)).toBeGreaterThanOrEqual(4);
    expect(getHordeActivationCount(99)).toBeLessThanOrEqual(16);
    expect(getHordeActivationIntervalMs(9)).toBeGreaterThanOrEqual(1_000);
    expect(HORDE_SPAWN_SCAN_BUDGET).toBeLessThanOrEqual(128);
    const base = { spawn: { x: 500, y: 0 }, player: { x: 0, y: 0 }, attractor: { x: 0, y: 0 }, insideCamera: false, visibleInFog: false, blocked: false };
    expect(isEligibleHordeSpawn(base)).toBe(true);
    expect(isEligibleHordeSpawn({ ...base, spawn: { x: 100, y: 0 } })).toBe(false);
    expect(isEligibleHordeSpawn({ ...base, visibleInFog: true })).toBe(false);
    expect(isEligibleHordeSpawn({ ...base, insideCamera: true })).toBe(false);
  });
});
