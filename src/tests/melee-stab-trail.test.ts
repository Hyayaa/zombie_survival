import { describe, expect, it } from "vitest";
import { MELEE_ATTACK_DEFINITIONS } from "../data/melee-attack-definitions";
import { createStabTrailGeometry } from "../effects/melee-trail-geometry";
import { createActiveMeleeTrail } from "../effects/melee-trail-system";

function stab(weapon: "knife" | "bat", heavy = false, aimAngle = 0, sequence = 3) {
  const attack = MELEE_ATTACK_DEFINITIONS[weapon][heavy ? "heavy" : "stab"];
  return createStabTrailGeometry({ originX: 0, originY: 0, aimAngle, startOffset: 8, length: attack.range * (weapon === "bat" ? 0.72 : heavy ? 0.95 : 0.9), maximumWidth: weapon === "bat" ? 7 : heavy ? 7 : 4, fragmentCount: heavy ? 6 : 3, sequence });
}

describe("stab melee trail geometry", () => {
  it("extends forward to a pointed tip without a rear circular shape", () => {
    const trail = stab("knife");
    expect(trail.start.x).toBeGreaterThanOrEqual(7);
    expect(trail.tip.x).toBeGreaterThan(trail.start.x);
    expect(Math.max(...trail.mainPolygon.map((point) => point.x))).toBeLessThanOrEqual(MELEE_ATTACK_DEFINITIONS.knife.stab.range + 9);
    expect(trail.tipPolygon[0]).toEqual(trail.tip);
    expect(trail.mainPolygon.length).toBeLessThan(8);
  });

  it("makes knife heavy longer while bat stab is thicker and slightly shorter", () => {
    const knife = stab("knife"), heavy = stab("knife", true), bat = stab("bat");
    expect(heavy.tip.x).toBeGreaterThan(knife.tip.x);
    expect(bat.tip.x).toBeLessThan(knife.tip.x);
    const knifeHeight = Math.max(...knife.mainPolygon.map((point) => point.y)) - Math.min(...knife.mainPolygon.map((point) => point.y));
    const batHeight = Math.max(...bat.mainPolygon.map((point) => point.y)) - Math.min(...bat.mainPolygon.map((point) => point.y));
    expect(batHeight).toBeGreaterThan(knifeHeight);
  });

  it("rotates its raster core with aim and is deterministic finite integer geometry", () => {
    const vertical = stab("knife", false, Math.PI / 2, 12), repeated = stab("knife", false, Math.PI / 2, 12);
    expect(Math.abs(vertical.tip.y)).toBeGreaterThan(Math.abs(vertical.tip.x));
    expect(vertical.trailingFragments).toEqual(repeated.trailingFragments);
    for (const point of [...vertical.mainPolygon, ...vertical.coreLine, ...vertical.tipPolygon]) expect(Number.isInteger(point.x) && Number.isInteger(point.y) && Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
  });

  it("selects stab for knife heavy and crescent for bat heavy", () => {
    const common = { sequence: 1, originX: 0, originY: 0, angle: 0, startedAt: 100, impacts: [] as const };
    expect(createActiveMeleeTrail({ ...common, weapon: "knife", meleeMode: "heavy" })?.geometry.kind).toBe("stab");
    expect(createActiveMeleeTrail({ ...common, weapon: "bat", meleeMode: "heavy" })?.geometry.kind).toBe("crescent");
  });
});
