import { describe, expect, it } from "vitest";
import { createCityBlockMap } from "../data/map-definitions";
import { VisionOccluderSpatialIndex } from "../systems/vision-occluder-surface";
import { getLastMultiCityGenerationProfile } from "../systems/world-macro-generator";

describe("multi-city runtime structural budget", () => {
  it("keeps generated walls static and generated doors as the lightweight dynamic subset", () => {
    const map = createCityBlockMap(5_352_513);
    const walls = map.generatedStructures.filter((structure) => structure.buildableId === "wood-wall");
    const doors = map.generatedStructures.filter((structure) => structure.buildableId === "wood-door");
    expect(walls).toHaveLength(map.wallSegments.length);
    expect(doors).toHaveLength(map.doors.length);
    expect(walls.every((wall) => wall.source === "generated" && !wall.demolishable && !wall.refund)).toBe(true);
    expect(map.roadRenderData!.maskCacheEntries).toBeLessThan(map.roadRenderData!.tiles.length);
    const profile = getLastMultiCityGenerationProfile();
    expect(profile?.mapSeed).toBe(5_352_513);
    expect(profile!.totalMs).toBeGreaterThanOrEqual(profile!.roadRasterMs);
  }, 30_000);

  it("keeps static district props out of the interactive furniture subset", () => {
    const map = createCityBlockMap(5_352_513);
    const staticProps = map.districtProps!.filter((prop) => prop.placement !== "interactive-furniture");
    const interactive = map.districtProps!.filter((prop) => prop.placement === "interactive-furniture");
    expect(staticProps.length).toBeGreaterThan(interactive.length);
    expect(interactive.length).toBeGreaterThan(0);
  }, 30_000);

  it("queries visible occluders from nearby buckets and reuses candidate storage", () => {
    const index = new VisionOccluderSpatialIndex(384);
    index.add({ key: "near", segment: { startX: 10, startY: 10, endX: 20, endY: 20, thickness: 4 } });
    index.add({ key: "far", segment: { startX: 4_000, startY: 4_000, endX: 4_020, endY: 4_020, thickness: 4 } });
    const scratch = [{ key: "old", segment: { startX: 0, startY: 0, endX: 0, endY: 0, thickness: 1 } }];
    expect(index.query(0, 0, 500, 500, scratch)).toBe(scratch);
    expect(scratch.map((surface) => surface.key)).toEqual(["near"]);
  });
});
