import { describe, expect, it } from "vitest";
import { createPowerWirePolyline } from "../rendering/power-wire-geometry";

describe("power wire geometry", () => {
  it("is deterministic, bounded and preserves endpoints and inputs", () => {
    const start = { x: 10, y: 20 }; const end = { x: 110, y: 20 };
    const points = createPowerWirePolyline(start, end, "a", "b");
    expect(points).toEqual(createPowerWirePolyline(start, end, "a", "b"));
    expect(points[0]).toEqual(start); expect(points.at(-1)).toEqual(end);
    expect(Math.abs(points[1]!.y - 20)).toBeGreaterThanOrEqual(1);
    expect(Math.abs(points[1]!.y - 20)).toBeLessThanOrEqual(3);
    expect(start).toEqual({ x: 10, y: 20 }); expect(end).toEqual({ x: 110, y: 20 });
  });
  it("varies by id and handles zero length", () => {
    expect(createPowerWirePolyline({x:0,y:0},{x:100,y:0},"a","b")).not.toEqual(createPowerWirePolyline({x:0,y:0},{x:100,y:0},"a","c"));
    for (const point of createPowerWirePolyline({x:4,y:4},{x:4,y:4},"x","y")) expect(Number.isNaN(point.x + point.y)).toBe(false);
  });
});
