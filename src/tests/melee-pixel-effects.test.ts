import { describe, expect, it } from "vitest";
import { CHARGE_PIXEL_CAP, createChargePixelPlan, createMeleeTrailPlan, createPostureShatterPlan, MELEE_TRAIL_PIXEL_CAP, POSTURE_SHATTER_PIXEL_CAP } from "../effects/melee-pixel-effect-math";

describe("melee pixel effects", () => {
  it("is deterministic and keeps every effect within its fixed cap", () => {
    const first = createMeleeTrailPlan(7, "bat", "heavy", 10, 20, 0.4, 1);
    expect(first).toEqual(createMeleeTrailPlan(7, "bat", "heavy", 10, 20, 0.4, 1));
    expect(first.length).toBeLessThanOrEqual(MELEE_TRAIL_PIXEL_CAP);
    expect(createPostureShatterPlan(7, 1, 2, 0).length).toBeLessThanOrEqual(POSTURE_SHATTER_PIXEL_CAP);
    expect(createChargePixelPlan(7, 1, 2, 0, 1).length).toBeLessThanOrEqual(CHARGE_PIXEL_CAP);
  });

  it("gives stab, swing and heavy distinct silhouettes", () => {
    const stab = createMeleeTrailPlan(1, "knife", "stab", 0, 0, 0);
    const swing = createMeleeTrailPlan(1, "knife", "swing", 0, 0, 0);
    const heavy = createMeleeTrailPlan(1, "knife", "heavy", 0, 0, 0);
    expect(stab.length).toBeLessThan(swing.length);
    expect(heavy.length).toBeGreaterThan(swing.length);
    expect(new Set(stab.map((pixel) => Math.round(pixel.y))).size).toBeLessThan(new Set(swing.map((pixel) => Math.round(pixel.y))).size);
  });
});
