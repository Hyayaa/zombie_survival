import { describe, expect, it } from "vitest";
import { MELEE_ATTACK_DEFINITIONS } from "../data/melee-attack-definitions";
import { createCrescentTrailGeometry, crescentThicknessAt } from "../effects/melee-trail-geometry";

function geometry(weapon: "knife" | "bat", aimAngle = 0, sweepDirection: -1 | 1 = 1) {
  const attack = MELEE_ATTACK_DEFINITIONS[weapon].swing;
  return createCrescentTrailGeometry({
    originX: 0,
    originY: 0,
    aimAngle,
    sweepDirection,
    innerRadius: weapon === "knife" ? 13 : 23,
    outerRadius: attack.range,
    arcRadians: attack.arcRadians,
    maximumThickness: weapon === "knife" ? 6 : 10,
  });
}

describe("pixel crescent melee trail geometry", () => {
  it("rasterizes one tapered partial silhouette into integer cells", () => {
    const trail = geometry("knife");
    expect(trail.frame.cells.length + trail.frame.edgeCells.length).toBeGreaterThan(20);
    expect(trail.arcRadians).toBeLessThan(Math.PI);
    expect(crescentThicknessAt(0.5, 6)).toBeGreaterThan(crescentThicknessAt(0, 6));
    expect(crescentThicknessAt(0.5, 6)).toBeGreaterThan(crescentThicknessAt(1, 6));
    for (const cell of [...trail.frame.cells, ...trail.frame.edgeCells]) {
      expect(Number.isInteger(cell.x) && Number.isInteger(cell.y)).toBe(true);
      expect(Math.hypot(cell.x, cell.y)).toBeLessThanOrEqual(trail.outerRadius + 1);
    }
  });

  it("keeps the knife mask smaller than the bat mask and matches profile range", () => {
    const knife = geometry("knife"), bat = geometry("bat");
    expect(knife.outerRadius).toBe(MELEE_ATTACK_DEFINITIONS.knife.swing.range);
    expect(bat.outerRadius).toBe(Math.round(MELEE_ATTACK_DEFINITIONS.bat.swing.range));
    expect(Math.abs(bat.outerRadius - MELEE_ATTACK_DEFINITIONS.bat.swing.range)).toBeLessThanOrEqual(0.5);
    expect(knife.outerRadius).toBeLessThan(bat.outerRadius);
    expect(knife.arcRadians).toBeLessThan(bat.arcRadians);
  });

  it("rotates with aim and reverses reveal order without changing the final mask", () => {
    const horizontal = geometry("knife", 0, 1);
    const vertical = geometry("knife", Math.PI / 2, 1);
    const reversed = geometry("knife", 0, -1);
    const average = (cells: readonly { x: number; y: number }[], axis: "x" | "y") => cells.reduce((sum, cell) => sum + cell[axis], 0) / cells.length;
    expect(average(horizontal.frame.cells, "x")).toBeGreaterThan(average(horizontal.frame.cells, "y"));
    expect(average(vertical.frame.cells, "y")).toBeGreaterThan(average(vertical.frame.cells, "x"));
    expect(new Set(horizontal.frame.cells.map((cell) => `${cell.x},${cell.y}`))).toEqual(new Set(reversed.frame.cells.map((cell) => `${cell.x},${cell.y}`)));
    expect(horizontal.revealFrames[0]).not.toEqual(reversed.revealFrames[0]);
  });

  it("contains no fragment, polygon, circle, or smooth-arc render data", () => {
    const trail = geometry("bat");
    expect(Object.keys(trail)).toEqual(["kind", "frame", "revealFrames", "innerRadius", "outerRadius", "arcRadians"]);
    expect(Object.keys(trail.frame).sort()).toEqual(["cells", "edgeCells"]);
  });
});
