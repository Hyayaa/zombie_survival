import { describe, expect, it } from "vitest";
import { SeededRng } from "../core/seeded-rng";
import { effectSeed, getMuzzlePosition, getTracerSegment, getTracerSegmentCount, sampleSwingPixel, swingOffsetAt } from "../effects/pixel-effect-math";

describe("pixel effect math", () => {
  it("keeps knife and bat swings inside their configured arcs", () => {
    let knifeMinimum = Number.POSITIVE_INFINITY;
    let knifeMaximum = Number.NEGATIVE_INFINITY;
    for (let index = 0; index <= 100; index += 1) {
      const offset = swingOffsetAt("knife", index / 100);
      knifeMinimum = Math.min(knifeMinimum, offset);
      knifeMaximum = Math.max(knifeMaximum, offset);
    }
    expect(knifeMinimum).toBeGreaterThanOrEqual(-56 * Math.PI / 180);
    expect(knifeMaximum).toBeLessThanOrEqual(56 * Math.PI / 180);
    expect(swingOffsetAt("bat", 0.2)).toBeCloseTo(-75 * Math.PI / 180, 5);
    expect(swingOffsetAt("bat", 0.75)).toBeCloseTo(70 * Math.PI / 180, 5);
  });

  it("produces integer swing pixels within the weapon radius", () => {
    const seed = effectSeed(1, "knife", 100, 100);
    for (let index = 0; index < 12; index += 1) {
      const point = sampleSwingPixel("knife", 100, 100, 0, index / 11, seed, index);
      expect(Number.isInteger(point.x)).toBe(true);
      expect(Number.isInteger(point.y)).toBe(true);
      expect(Math.hypot(point.x - 100, point.y - 100)).toBeLessThanOrEqual(17.8);
    }
  });

  it("rotates the same deterministic arc with the aim direction", () => {
    const seed = effectSeed(8, "knife", 80, 80);
    const right = sampleSwingPixel("knife", 80, 80, 0, 0.55, seed, 3);
    const down = sampleSwingPixel("knife", 80, 80, Math.PI / 2, 0.55, seed, 3);
    expect(down.x - 80).toBeCloseTo(-(right.y - 80), 0);
    expect(down.y - 80).toBeCloseTo(right.x - 80, 0);
  });

  it("is stable for one effect seed and varies by attack sequence", () => {
    const firstSeed = effectSeed(12, "bat", 42, 57);
    const sameSeed = effectSeed(12, "bat", 42, 57);
    const nextSeed = effectSeed(13, "bat", 42, 57);
    expect(sampleSwingPixel("bat", 42, 57, 0.4, 0.48, firstSeed, 5)).toEqual(
      sampleSwingPixel("bat", 42, 57, 0.4, 0.48, sameSeed, 5),
    );
    let changed = false;
    for (let sample = 0; sample < 16; sample += 1) {
      const progress = sample / 15;
      const first = sampleSwingPixel("bat", 42, 57, 0.4, progress, firstSeed, sample);
      const next = sampleSwingPixel("bat", 42, 57, 0.4, progress, nextSeed, sample);
      if (first.x !== next.x || first.y !== next.y) changed = true;
    }
    expect(changed).toBe(true);
  });

  it("places the muzzle at the pistol end for cardinal directions", () => {
    expect(getMuzzlePosition(50, 60, 0)).toEqual({ x: 62, y: 60 });
    expect(getMuzzlePosition(50, 60, Math.PI / 2)).toEqual({ x: 50, y: 72 });
    expect(getMuzzlePosition(50, 60, Math.PI)).toEqual({ x: 38, y: 60 });
    expect(Math.hypot(getMuzzlePosition(50, 60, 0.7).x - 50, getMuzzlePosition(50, 60, 0.7).y - 60)).toBeCloseTo(12, 0);
  });

  it("keeps dashed tracer segments between muzzle and impact", () => {
    expect(getTracerSegmentCount(0, 0, 4, 0)).toBe(2);
    expect(getTracerSegmentCount(0, 0, 400, 0)).toBe(5);
    const count = getTracerSegmentCount(10, 20, 210, 20);
    for (let index = 0; index < count; index += 1) {
      const segment = getTracerSegment(10, 20, 210, 20, index, count);
      expect(segment.start.x).toBeGreaterThanOrEqual(10);
      expect(segment.end.x).toBeLessThanOrEqual(210);
      expect(segment.end.x).toBeGreaterThanOrEqual(segment.start.x);
      expect(segment.start.y).toBe(20);
      expect(segment.end.y).toBe(20);
    }
  });

  it("does not consume gameplay RNG state", () => {
    const gameplay = new SeededRng(99);
    const before = gameplay.getSeedState();
    const seed = effectSeed(44, "pistol", 11, 23);
    sampleSwingPixel("knife", 11, 23, 0, 0.5, seed, 2);
    getTracerSegment(0, 0, 100, 30, 1, 4);
    expect(gameplay.getSeedState()).toBe(before);
  });
});
