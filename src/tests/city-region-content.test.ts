import { describe, expect, it } from "vitest";
import { createCityBlockMap } from "../data/map-definitions";
import { validateMap } from "../data/map-validation";

describe("city region content",()=>{
  it("places every required specialized POI name",()=>{const map=createCityBlockMap(0x8877),names=new Set(map.buildings.map((building)=>building.name));for(const city of map.worldPlan!.cities.filter((candidate)=>candidate.kind!=="mixed"))for(const poi of city.profile.poiKinds)expect(names.has(poi.replaceAll("-"," "))).toBe(true);});
  it("keeps objectives and companions in the mixed starting city",()=>{const map=createCityBlockMap(0x7788);expect(map.containers.filter((container)=>container.part)).toHaveLength(3);expect(map.containers.filter((container)=>container.part).every((container)=>container.id.startsWith("mixed-nw:"))).toBe(true);expect(map.companionSpawns).toHaveLength(4);expect(map.companionSpawns.every((spawn)=>spawn.id.startsWith("mixed-nw:"))).toBe(true);});
  it("keeps lightweight source definitions for content in every region",()=>{const map=createCityBlockMap(0x6677);for(const city of map.worldPlan!.cities){expect(map.containers.some((container)=>container.id.startsWith(`${city.id}:`))).toBe(true);expect(map.zombieSpawns.some((spawn)=>spawn.id.startsWith(`${city.id}:`))).toBe(true);}});
  it("applies each region's zombie density multiplier",()=>{const map=createCityBlockMap(0x6677),counts=Object.fromEntries(map.worldPlan!.cities.map((city)=>[city.id,map.zombieSpawns.filter((spawn)=>spawn.id.startsWith(`${city.id}:`)).length])),base=counts["mixed-nw"]!;expect(counts["military-ne"]).toBe(Math.round(base*1.2));expect(counts["industrial-sw"]).toBe(Math.round(base*1.1));expect(counts["commercial-se"]).toBe(Math.round(base*1.2));});
  it("passes full world generation validation",()=>{const result=validateMap(createCityBlockMap(0x5566));expect(result.errors,result.errors.join("\n")).toEqual([]);});
});
