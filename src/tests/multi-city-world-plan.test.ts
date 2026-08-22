import { describe, expect, it } from "vitest";
import { createCityBlockMap, TerrainType } from "../data/map-definitions";
import { CITY_PROFILES, MULTI_CITY_HEIGHT_TILES, MULTI_CITY_WIDTH_TILES, RIVER_WIDTH_TILES } from "../data/world-region-definitions";
import { createCityPlans } from "../systems/world-macro-generator";

describe("multi-city world plan",()=>{
  it("lays out four deterministic 128 tile city regions in a 2x2 world",()=>{const first=createCityPlans(123),second=createCityPlans(123);expect(first).toEqual(second);expect(first.map((city)=>city.kind)).toEqual(["mixed","military","industrial","commercial"]);expect(new Set(first.map((city)=>city.seed)).size).toBe(4);});
  it("builds the expected dynamic world dimensions with fewer, larger district lots",()=>{const map=createCityBlockMap(456);expect(map.widthTiles).toBe(MULTI_CITY_WIDTH_TILES);expect(map.heightTiles).toBe(MULTI_CITY_HEIGHT_TILES);expect(map.worldPlan?.cities).toHaveLength(4);expect(map.buildings.length).toBeGreaterThanOrEqual(60);});
  it("keeps the central river intersection as impassable water",()=>{const map=createCityBlockMap(789),centerX=Math.floor(map.widthTiles/2),centerY=Math.floor(map.heightTiles/2);expect(map.terrain[centerY*map.widthTiles+centerX]).toBe(TerrainType.Water);expect(map.obstacles.some((obstacle)=>obstacle.kind==="water"&&centerX>=obstacle.tileX&&centerX<obstacle.tileX+obstacle.widthTiles&&centerY>=obstacle.tileY&&centerY<obstacle.tileY+obstacle.heightTiles)).toBe(true);expect(RIVER_WIDTH_TILES).toBe(10);});
  it("exposes the required regional density profiles",()=>expect(Object.values(CITY_PROFILES).map((profile)=>profile.zombieDensityMultiplier)).toEqual([1,1.2,1.1,1.2]));
  it("keeps macro definitions bounded for runtime activation",()=>{const map=createCityBlockMap(987);expect(map.obstacles.length).toBeLessThan(250);expect(map.containers.length).toBeLessThan(260);expect(map.zombieSpawns.length).toBeLessThan(1_500);expect(map.generatedStructures.length).toBeLessThan(5_000);});
});
