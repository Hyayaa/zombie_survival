import { describe, expect, it } from "vitest";
import { MELEE_ATTACK_DEFINITIONS } from "../data/melee-attack-definitions";
import { createActiveMeleeTrail } from "../effects/melee-trail-system";

const PREVIOUS_BAT_RANGES = { stab: 40, swing: 47, heavy: 50 } as const;

describe("baseball bat range", () => {
  it("applies the range reduction exactly once to every bat attack", () => {
    for (const mode of ["stab", "swing", "heavy"] as const) {
      expect(MELEE_ATTACK_DEFINITIONS.bat[mode].range).toBe(PREVIOUS_BAT_RANGES[mode] * 0.5);
    }
    expect(MELEE_ATTACK_DEFINITIONS.bat.stab.range).toBeGreaterThan(MELEE_ATTACK_DEFINITIONS.knife.stab.range);
  });

  it("keeps trail reach synchronized with the collision profile", () => {
    for (const mode of ["stab", "swing", "heavy"] as const) {
      const definition = MELEE_ATTACK_DEFINITIONS.bat[mode];
      const trail = createActiveMeleeTrail({
        weapon: "bat", meleeMode: mode, meleeRange: definition.range,
        meleeArcRadians: definition.arcRadians, originX: 0, originY: 0,
        angle: 0, startedAt: 0, sequence: mode === "stab" ? 1 : mode === "swing" ? 2 : 3,
        impacts: [],
      });
      expect(trail).toBeDefined();
      const visualReach = trail!.geometry.kind === "stab" ? trail!.geometry.length : trail!.geometry.outerRadius;
      expect(Math.abs(visualReach - definition.range)).toBeLessThanOrEqual(0.5);
    }
  });

  it("retains wall blocking and multi-target bat profiles", () => {
    expect(MELEE_ATTACK_DEFINITIONS.bat.stab.geometry).toBe("capsule");
    expect(MELEE_ATTACK_DEFINITIONS.bat.swing.maxTargets).toBe(3);
    expect(MELEE_ATTACK_DEFINITIONS.bat.heavy.maxTargets).toBe(2);
  });
});
