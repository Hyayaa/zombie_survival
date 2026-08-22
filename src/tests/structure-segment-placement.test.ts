import { describe, expect, it } from "vitest";
import { createOrientedSegmentChain, createSegmentChain, MAX_WALL_CHAIN_SEGMENTS, segmentConflicts } from "../systems/structure-segment-placement";

describe("structure segment placement", () => {
  it.each([[{x:0,y:0},{x:72,y:0},3],[{x:0,y:0},{x:0,y:72},3],[{x:0,y:0},{x:72,y:72},3],[{x:0,y:72},{x:72,y:0},3]] as const)("creates horizontal, vertical and diagonal chains", (start, end, count) => expect(createSegmentChain("wood-wall", start, end)).toHaveLength(count));
  it("limits a drag to eight segments", () => expect(createSegmentChain("wood-wall", {x:0,y:0}, {x:1000,y:0})).toHaveLength(MAX_WALL_CHAIN_SEGMENTS));
  it("cycles horizontal, down diagonal, vertical and up diagonal chain orientation",()=>{const end={x:72,y:72};expect(createOrientedSegmentChain("wood-wall",{x:0,y:0},end,0)[0]).toMatchObject({endX:24,endY:0});expect(createOrientedSegmentChain("wood-wall",{x:0,y:0},end,1)[0]).toMatchObject({endX:24,endY:24});expect(createOrientedSegmentChain("wood-wall",{x:0,y:0},end,2)[0]).toMatchObject({endX:0,endY:24});expect(createOrientedSegmentChain("wood-wall",{x:0,y:0},end,3)[0]).toMatchObject({endX:24,endY:-24});});
  it("allows shared endpoints but rejects duplicates and middle crossings", () => {
    const existing = [{ startX: 0, startY: 0, endX: 24, endY: 0, thickness: 5 }];
    expect(segmentConflicts({ startX: 24, startY: 0, endX: 48, endY: 0, thickness: 5 }, existing)).toBeNull();
    expect(segmentConflicts({ ...existing[0]! }, existing)).toBe("duplicate");
    expect(segmentConflicts({ startX: 12, startY: -12, endX: 12, endY: 12, thickness: 5 }, existing)).toBe("intersection");
  });
});
