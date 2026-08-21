import { describe, expect, it } from "vitest";
import { createPixelDebrisPlan } from "../effects/pixel-debris-effects";
import { createFootstepDustPlan } from "../effects/footstep-dust";

describe("pixel debris effects", () => {
  it("creates more running dust than walking dust", () => {
    expect(createFootstepDustPlan(1, 0, true, "ground").length).toBeGreaterThan(createFootstepDustPlan(1, 0, false, "ground").length);
  });
  it("creates deterministic bounded wall, metal, posture, wood, and ground fragments", () => {
    for (const kind of ["wall", "metal", "posture", "wood", "bat-ground"] as const) {
      const first = createPixelDebrisPlan(kind, 4, 0.25);
      expect(first).toEqual(createPixelDebrisPlan(kind, 4, 0.25));
      expect(first.length).toBeGreaterThanOrEqual(4);
      expect(first.every((item) => item.width <= 2 && item.height <= 2 && item.lifetimeMs <= 300)).toBe(true);
    }
  });
});
