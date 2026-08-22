import { describe, expect, it } from "vitest";
import { createCityBlockMap, TerrainType } from "../data/map-definitions";
import { createBridgePlans, findMacroRoute } from "../systems/world-macro-generator";
import { CollisionSystem } from "../systems/collision-system";
import { TILE_SIZE } from "../config/game-config";

describe("city bridge network",()=>{
  it("creates exactly the four required city connections",()=>expect(createBridgePlans().map(({from,to})=>`${from}->${to}`)).toEqual(["mixed-nw->military-ne","mixed-nw->industrial-sw","military-ne->commercial-se","industrial-sw->commercial-se"]));
  it("uses ten tile connector bridges with eight tile approaches",()=>expect(createBridgePlans().every((bridge)=>bridge.widthTiles===10&&bridge.approachLengthTiles===8)).toBe(true));
  it("cuts passable bridge roads through water collision strips",()=>{const map=createCityBlockMap(99);for(const bridge of map.worldPlan!.bridges){expect(map.terrain[bridge.centerY*map.widthTiles+bridge.centerX]).toBe(TerrainType.BridgeRoad);expect(map.obstacles.some((obstacle)=>obstacle.kind==="water"&&bridge.centerX>=obstacle.tileX&&bridge.centerX<obstacle.tileX+obstacle.widthTiles&&bridge.centerY>=obstacle.tileY&&bridge.centerY<obstacle.tileY+obstacle.heightTiles)).toBe(false);}});
  it("finds a macro route between opposite cities through bridge nodes",()=>{const plan=createCityBlockMap(100).worldPlan!,route=findMacroRoute(plan,"city:mixed-nw","city:commercial-se");expect(route[0]).toBe("city:mixed-nw");expect(route.at(-1)).toBe("city:commercial-se");expect(route.some((id)=>id.startsWith("bridge:"))).toBe(true);});
  it("blocks river movement without blocking bridge centers",()=>{const map=createCityBlockMap(101),collision=new CollisionSystem(map.obstacles,map.doors,map.widthTiles,map.heightTiles,TILE_SIZE,map.wallSegments),center=Math.floor(map.widthTiles/2);expect(collision.isTileBlocked(center,center)).toBe(true);for(const bridge of map.worldPlan!.bridges)expect(collision.isTileBlocked(bridge.centerX,bridge.centerY)).toBe(false);});
});
