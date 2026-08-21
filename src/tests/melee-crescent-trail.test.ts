import { describe, expect, it } from "vitest";
import { MELEE_ATTACK_DEFINITIONS } from "../data/melee-attack-definitions";
import { createCrescentTrailGeometry } from "../effects/melee-trail-geometry";

function geometry(weapon: "knife" | "bat", aimAngle = 0, sweepDirection: -1 | 1 = 1, sequence = 7) {
  const attack = MELEE_ATTACK_DEFINITIONS[weapon].swing;
  return createCrescentTrailGeometry({ originX: 0, originY: 0, aimAngle, sweepDirection, innerRadius: weapon === "knife" ? 17 : 23, outerRadius: attack.range, arcRadians: attack.arcRadians, segmentCount: 16, maximumThickness: weapon === "knife" ? 7 : 10, sequence });
}

describe("crescent melee trail geometry", () => {
  it("forms a tapered partial arc with a thicker center", () => {
    const trail = geometry("knife");
    const thicknesses = trail.outerSamples.map((outer, index) => Math.hypot(outer.x, outer.y) - Math.hypot(trail.innerSamples[index]!.x, trail.innerSamples[index]!.y));
    expect(trail.mainPolygon.length).toBeGreaterThan(8);
    expect(thicknesses[Math.floor(thicknesses.length / 2)]!).toBeGreaterThan(thicknesses[0]!);
    expect(thicknesses[Math.floor(thicknesses.length / 2)]!).toBeGreaterThan(thicknesses.at(-1)!);
    expect(Math.max(...trail.outerSamples.map((point) => Math.hypot(point.x, point.y)))).toBeGreaterThan(Math.max(...trail.innerSamples.map((point) => Math.hypot(point.x, point.y))));
    expect(MELEE_ATTACK_DEFINITIONS.knife.swing.arcRadians).toBeLessThan(Math.PI);
  });

  it("keeps knife smaller and narrower than the bat", () => {
    const knife = geometry("knife"), bat = geometry("bat");
    expect(MELEE_ATTACK_DEFINITIONS.knife.swing.arcRadians).toBeLessThan(MELEE_ATTACK_DEFINITIONS.bat.swing.arcRadians);
    expect(Math.max(...knife.outerSamples.map((point) => Math.hypot(point.x, point.y)))).toBeLessThan(Math.max(...bat.outerSamples.map((point) => Math.hypot(point.x, point.y))));
  });

  it("rotates with aim and mirrors the ordered sweep", () => {
    const base = geometry("knife", 0, 1), rotated = geometry("knife", Math.PI / 2, 1), mirrored = geometry("knife", 0, -1);
    expect(rotated.outerSamples[0]).toEqual({ x: -base.outerSamples[0]!.y, y: base.outerSamples[0]!.x });
    expect(mirrored.outerSamples[0]).toEqual({ x: base.outerSamples.at(-1)!.x, y: -base.outerSamples[0]!.y });
  });

  it("uses finite integer pixels, preserves input, and deterministically places fragments", () => {
    const input = { originX: 3, originY: 4, aimAngle: 0.3, sweepDirection: 1 as const, innerRadius: 17, outerRadius: 35, arcRadians: 1.4, segmentCount: 14, maximumThickness: 7, sequence: 22 };
    const before = { ...input };
    const first = createCrescentTrailGeometry(input), second = createCrescentTrailGeometry(input);
    expect(input).toEqual(before);
    expect(first.trailingFragments).toEqual(second.trailingFragments);
    for (const point of [...first.mainPolygon, ...first.highlightPolygon, ...first.trailingFragments]) {
      expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
      expect(Number.isInteger(point.x) && Number.isInteger(point.y)).toBe(true);
    }
  });
});
