import { describe, expect, it } from "vitest";
import { TILE_SIZE } from "../config/game-config";
import { createCityBlockMap } from "../data/map-definitions";
import { createStructureSegmentGeometry, segmentKey } from "../systems/structure-segment-placement";

describe("generated building anchor alignment", () => {
  it("uses integer tile anchors and unit cardinal or diagonal segments", () => {
    const map=createCityBlockMap(0xabc,4);
    for(const segment of [...map.wallSegments,...map.doors.map((door)=>door.segment!)]){
      for(const value of [segment.startX,segment.startY,segment.endX,segment.endY])expect(value/TILE_SIZE).toBe(Math.round(value/TILE_SIZE));
      const dx=Math.abs(segment.endX-segment.startX)/TILE_SIZE,dy=Math.abs(segment.endY-segment.startY)/TILE_SIZE;
      expect(Math.max(dx,dy)).toBe(1);expect(dx===0||dy===0||dx===dy).toBe(true);
    }
  });
  it("replaces wall segments with doors without duplicates",()=>{
    const map=createCityBlockMap(0xdef,4),wallKeys=new Set(map.wallSegments.map(segmentKey));
    expect(new Set(map.wallSegments.map(segmentKey)).size).toBe(map.wallSegments.length);
    for(const door of map.doors)expect(wallKeys.has(segmentKey(door.segment!))).toBe(false);
  });
  it("uses the same helper as player construction",()=>expect(createStructureSegmentGeometry({x:3,y:5},{x:4,y:6})).toMatchObject({startX:3*TILE_SIZE,startY:5*TILE_SIZE,endX:4*TILE_SIZE,endY:6*TILE_SIZE}));
});
