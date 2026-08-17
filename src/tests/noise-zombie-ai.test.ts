import { describe, expect, it } from "vitest";
import { NoiseSystem } from "../systems/noise-system";
import { createZombieMind, updateZombieMind } from "../systems/zombie-ai-system";
import { ZOMBIE_DEFINITIONS } from "../data/zombie-definitions";

describe("noise and zombie perception", () => {
  it("alerts a zombie inside the noise radius but not one outside", () => {
    const noise = new NoiseSystem();
    noise.emit({ x: 0, y: 0, intensity: 20, radius: 50, category: "run", createdAt: 100 });
    expect(noise.loudestHeard(30, 0, 1, 100)).toBeDefined();
    expect(noise.loudestHeard(70, 0, 1, 100)).toBeUndefined();
  });

  it("investigates heard noise without knowing the player position", () => {
    const noise = new NoiseSystem();
    noise.emit({ x: 30, y: 40, intensity: 20, radius: 100, category: "run", createdAt: 100 });
    const heard = noise.loudestHeard(0, 0, 1, 100);
    const next = updateZombieMind(createZombieMind(), { canSeeTarget: false, heardNoise: heard });
    expect(next.state).toBe("InvestigateNoise");
    expect(next.lastHeardNoisePosition).toEqual({ x: 30, y: 40 });
    expect(next.currentTargetId).toBeUndefined();
  });

  it("chases a visible target and keeps its visual lock through brief LOS loss", () => {
    const chasing = updateZombieMind(createZombieMind(), { canSeeTarget: true, targetPosition: { x: 20, y: 10 }, targetId: "player", inAttackRange: false, nowMs: 100 });
    expect(chasing.state).toBe("Chase");
    const pursuing = updateZombieMind(chasing, { canSeeTarget: false, targetAlive: true, targetDistance: 80, targetPosition: { x: 30, y: 10 }, nowMs: 500 });
    expect(pursuing.state).toBe("Chase");
    expect(pursuing.lastSeenTargetPosition).toEqual({ x: 30, y: 10 });
  });

  it("reduces long-range perception while keeping runners more sensitive", () => {
    expect(ZOMBIE_DEFINITIONS.walker.sightRadius).toBeLessThanOrEqual(82);
    expect(ZOMBIE_DEFINITIONS.walker.hearingMultiplier).toBeLessThanOrEqual(0.7);
    expect(ZOMBIE_DEFINITIONS.runner.sightRadius).toBeGreaterThan(ZOMBIE_DEFINITIONS.walker.sightRadius);
    expect(ZOMBIE_DEFINITIONS.runner.hearingMultiplier).toBeGreaterThan(ZOMBIE_DEFINITIONS.walker.hearingMultiplier);
  });
});

