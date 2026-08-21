import { describe, expect, it } from "vitest";
import { MELEE_ATTACK_DEFINITIONS } from "../data/melee-attack-definitions";
import { createActiveMeleeTrail } from "../effects/melee-trail-system";
import { collectMeleeTargets } from "../systems/melee-combat-system";

describe("knife melee range", () => {
  it("uses the reduced final range and bounded width profiles", () => {
    expect(MELEE_ATTACK_DEFINITIONS.knife.stab.range).toBe(26);
    expect(MELEE_ATTACK_DEFINITIONS.knife.swing.range).toBe(28);
    expect(MELEE_ATTACK_DEFINITIONS.knife.heavy.range).toBe(30);
    expect(MELEE_ATTACK_DEFINITIONS.knife.stab.width).toBeGreaterThanOrEqual(6);
    expect(MELEE_ATTACK_DEFINITIONS.knife.stab.width).toBeLessThanOrEqual(8);
    expect(MELEE_ATTACK_DEFINITIONS.knife.heavy.width).toBeGreaterThanOrEqual(8);
    expect(MELEE_ATTACK_DEFINITIONS.knife.heavy.width).toBeLessThanOrEqual(10);
  });

  it("keeps every knife attack shorter than its bat counterpart", () => {
    for (const mode of ["stab", "swing", "heavy"] as const) {
      expect(MELEE_ATTACK_DEFINITIONS.knife[mode].range).toBeLessThan(MELEE_ATTACK_DEFINITIONS.bat[mode].range);
    }
  });

  it("matches the swing pixel radius to the 28px hit profile", () => {
    const trail = createActiveMeleeTrail({ sequence: 1, weapon: "knife", meleeMode: "swing", originX: 0, originY: 0, angle: 0, startedAt: 0, impacts: [], meleeRange: MELEE_ATTACK_DEFINITIONS.knife.swing.range, meleeArcRadians: MELEE_ATTACK_DEFINITIONS.knife.swing.arcRadians })!;
    expect(trail.geometry.outerRadius).toBe(28);
    expect(trail.geometry.outerRadius - MELEE_ATTACK_DEFINITIONS.knife.swing.range).toBeLessThanOrEqual(2);
  });

  it("does not reach a target beyond profile plus target radius and preserves line-of-sight blocking", () => {
    const target = { id: "zombie", position: { x: 34, y: 0 }, alive: true };
    expect(collectMeleeTargets({ x: 0, y: 0 }, 0, MELEE_ATTACK_DEFINITIONS.knife.stab, [target], () => true, [])).toHaveLength(0);
    const closeTarget = { ...target, position: { x: 24, y: 0 } };
    expect(collectMeleeTargets({ x: 0, y: 0 }, 0, MELEE_ATTACK_DEFINITIONS.knife.stab, [closeTarget], () => false, [])).toHaveLength(0);
    expect(collectMeleeTargets({ x: 0, y: 0 }, 0, MELEE_ATTACK_DEFINITIONS.knife.stab, [closeTarget], () => true, [])).toHaveLength(1);
  });
});
