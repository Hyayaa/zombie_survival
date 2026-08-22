import { describe, expect, it } from "vitest";
import { ZOMBIE_DEFINITIONS } from "../data/zombie-definitions";
import { cancelZombieAttackWindups, createZombiePosture, damageZombiePosture, updateZombiePosture } from "../systems/zombie-posture-system";

describe("zombie posture", () => {
  it("breaks independently from health and grants a short immunity window", () => {
    const definition = ZOMBIE_DEFINITIONS.walker;
    const posture = createZombiePosture(definition);
    expect(damageZombiePosture(posture, 99, 100, definition).broken).toBe(false);
    const result = damageZombiePosture(posture, 2, 110, definition);
    expect(result.broken).toBe(true);
    expect(posture.value).toBe(25);
    expect(posture.staggerUntil).toBe(790);
    expect(damageZombiePosture(posture, 99, 120, definition).applied).toBe(0);
  });

  it("recovers only after its delay and outside stagger", () => {
    const definition = ZOMBIE_DEFINITIONS.runner;
    const posture = createZombiePosture(definition);
    damageZombiePosture(posture, 20, 100, definition);
    updateZombiePosture(posture, definition, 1_000, 1);
    expect(posture.value).toBe(58);
    updateZombiePosture(posture, definition, 1_400, 0.5);
    expect(posture.value).toBe(75);
  });

  it("cancels bite and obstacle windups when posture breaks", () => {
    const runtime = { biteCompletesAt: 800, obstacleAttackCompletesAt: 900, obstacleTargetId: "door" };
    cancelZombieAttackWindups(runtime);
    expect(runtime).toEqual({ biteCompletesAt: 0, obstacleAttackCompletesAt: 0, obstacleTargetId: undefined });
  });
});
