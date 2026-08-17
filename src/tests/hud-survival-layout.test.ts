import { describe, expect, it } from "vitest";
import { clampHudGauge, SURVIVAL_GAUGE_ORDER } from "../ui/hud";

describe("survival HUD layout model", () => {
  it("keeps exactly five gauges in the required order", () => expect(SURVIVAL_GAUGE_ORDER).toEqual(["health", "stamina", "hunger", "thirst", "infection"]));
  it("rounds and clamps displayed values", () => { expect(clampHudGauge(25.4)).toBe(25); expect(clampHudGauge(-3)).toBe(0); expect(clampHudGauge(120)).toBe(100); });
});
