import { TILE_SIZE } from "../config/game-config";
import { deterministicHash } from "../core/seeded-rng";
import { TerrainType, type BuildingDefinition, type MapDefinition, type RoadSegment, type WorldObstacle } from "../data/map-definitions";
import {
  CITY_GAP_TILES, CITY_PROFILES, CITY_REGION_HEIGHT, CITY_REGION_WIDTH, MULTI_CITY_HEIGHT_TILES, MULTI_CITY_WIDTH_TILES,
  RIVER_BANK_WIDTH_TILES, RIVER_WIDTH_TILES, WORLD_OUTER_MARGIN_TILES,
  type BridgePlan, type CityKind, type CityRegionId, type CityRegionPlan, type TransitEdge, type TransitNode, type WorldMacroPlan,
} from "../data/world-region-definitions";

const ROAD_WIDTH_TILES = 7;
const BRIDGE_APPROACH_TILES = 8;

export function createMultiCityWorld(mapSeed: number, createSingleCity: (seed: number) => MapDefinition): MapDefinition {
  const cities = createCityPlans(mapSeed);
  const bridges = createBridgePlans();
  const { nodes, edges } = createTransitGraph(cities, bridges);
  const worldPlan: WorldMacroPlan = { widthTiles: MULTI_CITY_WIDTH_TILES, heightTiles: MULTI_CITY_HEIGHT_TILES, cities, bridges, transitNodes: nodes, transitEdges: edges };
  const terrain = new Uint8Array(MULTI_CITY_WIDTH_TILES * MULTI_CITY_HEIGHT_TILES);
  const minimapWallCoverage = new Uint8Array(terrain.length);
  const roadSegments: RoadSegment[] = [];
  const buildings: BuildingDefinition[] = [];
  const wallSegments: MapDefinition["wallSegments"] = [];
  const generatedStructures: MapDefinition["generatedStructures"] = [];
  const obstacles: MapDefinition["obstacles"] = [];
  const doors: MapDefinition["doors"] = [];
  const containers: MapDefinition["containers"] = [];
  const groundItems: MapDefinition["groundItems"] = [];
  const zombieSpawns: MapDefinition["zombieSpawns"] = [];
  let mixedMap: MapDefinition | undefined;

  for (const city of cities) {
    const local = createSingleCity(city.seed);
    if (city.kind === "mixed") mixedMap = local;
    copyTerrain(local, terrain, minimapWallCoverage, city.originX, city.originY);
    const prefix = city.id;
    const buildingId = (id: string) => `${prefix}:${id}`;
    for (const road of local.roadSegments) roadSegments.push({ ...road, id: `${prefix}:${road.id}`, startX: road.startX + city.originX, endX: road.endX + city.originX, startY: road.startY + city.originY, endY: road.endY + city.originY });
    for (let index = 0; index < local.buildings.length; index += 1) {
      const building = local.buildings[index]!;
      const translated = translateBuilding(building, city, buildingId(building.id));
      if (city.kind !== "mixed" && index < city.profile.poiKinds.length) {
        translated.name = city.profile.poiKinds[index]!.replaceAll("-", " ");
        translated.kind = poiBuildingKind(city.kind, index);
      } else if (city.kind !== "mixed" && translated.kind === "safehouse") translated.kind = "office";
      buildings.push(translated);
    }
    for (const segment of local.wallSegments) wallSegments.push(translateSegment(segment, city.originX, city.originY));
    for (const structure of local.generatedStructures) generatedStructures.push({ ...structure, id: `${prefix}:${structure.id}`, buildingId: buildingId(structure.buildingId), placement: translateSegment(structure.placement, city.originX, city.originY) });
    for (const obstacle of local.obstacles) obstacles.push({ ...obstacle, id: `${prefix}:${obstacle.id}`, tileX: obstacle.tileX + city.originX, tileY: obstacle.tileY + city.originY });
    for (const door of local.doors) doors.push({ ...door, id: `${prefix}:${door.id}`, buildingId: door.buildingId ? buildingId(door.buildingId) : undefined, tileX: door.tileX + city.originX, tileY: door.tileY + city.originY, segment: door.segment ? translateSegment(door.segment, city.originX, city.originY) : undefined });
    for (const container of local.containers) containers.push({ ...container, id: `${prefix}:${container.id}`, tileX: container.tileX + city.originX, tileY: container.tileY + city.originY, part: city.kind === "mixed" ? container.part : undefined });
    for (const item of local.groundItems) groundItems.push({ ...item, id: `${prefix}:${item.id}`, tileX: item.tileX + city.originX, tileY: item.tileY + city.originY });
    for (const spawn of local.zombieSpawns) zombieSpawns.push({ ...spawn, id: `${prefix}:${spawn.id}`, tileX: spawn.tileX + city.originX, tileY: spawn.tileY + city.originY });
  }
  if (!mixedMap) throw new Error("Mixed city generation failed");

  paintRiversAndBanks(terrain);
  for (const bridge of bridges) { paintBridge(terrain, bridge); roadSegments.push(bridgeRoadSegment(bridge)); }
  obstacles.push(...createRiverCollisionStrips());
  normalizeRegionalZombieDensity(zombieSpawns,cities,terrain,mapSeed);
  const mixed = cities[0]!;
  const playerSpawn = translatePoint(mixedMap.playerSpawn, mixed.originX, mixed.originY);
  const companionSpawns = mixedMap.companionSpawns.map((spawn) => ({ ...spawn, id: `mixed-nw:${spawn.id}`, tileX: spawn.tileX + mixed.originX, tileY: spawn.tileY + mixed.originY }));
  return {
    mapId: "multi-city-world-v1", mapVersion: mixedMap.mapVersion, mapGenerationVersion: 5, mapSeed,
    widthTiles: MULTI_CITY_WIDTH_TILES, heightTiles: MULTI_CITY_HEIGHT_TILES, terrain, minimapWallCoverage, roadSegments,
    buildings, structures: buildings, wallSegments, generatedStructures, obstacles, doors, containers, groundItems, zombieSpawns,
    playerSpawn, companionSpawns, survivorSpawn: translatePoint(mixedMap.survivorSpawn, mixed.originX, mixed.originY),
    extractionZone: { ...translatePoint(mixedMap.extractionZone, mixed.originX, mixed.originY), radius: mixedMap.extractionZone.radius },
    safehouseZone: { ...mixedMap.safehouseZone, x: mixedMap.safehouseZone.x + mixed.originX * TILE_SIZE, y: mixedMap.safehouseZone.y + mixed.originY * TILE_SIZE },
    worldPlan,
  };
}

export function createCityPlans(seed: number): CityRegionPlan[] {
  const far = WORLD_OUTER_MARGIN_TILES + CITY_REGION_WIDTH + CITY_GAP_TILES;
  const specs: ReadonlyArray<[CityRegionId, CityKind, number, number]> = [
    ["mixed-nw", "mixed", WORLD_OUTER_MARGIN_TILES, WORLD_OUTER_MARGIN_TILES], ["military-ne", "military", far, WORLD_OUTER_MARGIN_TILES],
    ["industrial-sw", "industrial", WORLD_OUTER_MARGIN_TILES, far], ["commercial-se", "commercial", far, far],
  ];
  return specs.map(([id, kind, originX, originY], index) => ({ id, kind, originX, originY, widthTiles: CITY_REGION_WIDTH, heightTiles: CITY_REGION_HEIGHT, seed: subSeed(seed, index + 1), profile: CITY_PROFILES[kind] }));
}

export function createBridgePlans(): BridgePlan[] {
  const north = WORLD_OUTER_MARGIN_TILES + CITY_REGION_HEIGHT / 2; const south = north + CITY_REGION_HEIGHT + CITY_GAP_TILES;
  const west = WORLD_OUTER_MARGIN_TILES + CITY_REGION_WIDTH / 2; const east = west + CITY_REGION_WIDTH + CITY_GAP_TILES;
  const center = WORLD_OUTER_MARGIN_TILES + CITY_REGION_WIDTH + CITY_GAP_TILES / 2;
  return [
    { id: "bridge-mixed-military", from: "mixed-nw", to: "military-ne", axis: "horizontal", centerX: center, centerY: north, widthTiles: ROAD_WIDTH_TILES, approachLengthTiles: BRIDGE_APPROACH_TILES },
    { id: "bridge-mixed-industrial", from: "mixed-nw", to: "industrial-sw", axis: "vertical", centerX: west, centerY: center, widthTiles: ROAD_WIDTH_TILES, approachLengthTiles: BRIDGE_APPROACH_TILES },
    { id: "bridge-military-commercial", from: "military-ne", to: "commercial-se", axis: "vertical", centerX: east, centerY: center, widthTiles: ROAD_WIDTH_TILES, approachLengthTiles: BRIDGE_APPROACH_TILES },
    { id: "bridge-industrial-commercial", from: "industrial-sw", to: "commercial-se", axis: "horizontal", centerX: center, centerY: south, widthTiles: ROAD_WIDTH_TILES, approachLengthTiles: BRIDGE_APPROACH_TILES },
  ];
}

export function createTransitGraph(cities: readonly CityRegionPlan[], bridges: readonly BridgePlan[]): { nodes: TransitNode[]; edges: TransitEdge[] } {
  const nodes: TransitNode[] = cities.map((city) => ({ id: `city:${city.id}`, tileX: city.originX + city.widthTiles / 2, tileY: city.originY + city.heightTiles / 2, regionId: city.id }));
  const edges: TransitEdge[] = [];
  for (const bridge of bridges) {
    const node: TransitNode = { id: `bridge:${bridge.id}`, tileX: bridge.centerX, tileY: bridge.centerY };
    nodes.push(node);
    for (const regionId of [bridge.from, bridge.to]) { const cityNode = nodes.find((candidate) => candidate.id === `city:${regionId}`)!; const cost = Math.hypot(cityNode.tileX - node.tileX, cityNode.tileY - node.tileY); edges.push({ from: cityNode.id, to: node.id, cost }, { from: node.id, to: cityNode.id, cost }); }
  }
  return { nodes, edges };
}

export function findMacroRoute(plan: Pick<WorldMacroPlan, "transitNodes" | "transitEdges">, startId: string, goalId: string): string[] {
  const distances = new Map<string, number>([[startId, 0]]); const previous = new Map<string, string>(); const open = new Set(plan.transitNodes.map((node) => node.id));
  while (open.size) { let current: string | undefined; let best = Number.POSITIVE_INFINITY; for (const id of open) { const value = distances.get(id) ?? Number.POSITIVE_INFINITY; if (value < best) { best = value; current = id; } } if (!current || current === goalId) break; open.delete(current); for (const edge of plan.transitEdges) if (edge.from === current && open.has(edge.to)) { const next = best + edge.cost; if (next < (distances.get(edge.to) ?? Number.POSITIVE_INFINITY)) { distances.set(edge.to, next); previous.set(edge.to, current); } } }
  if (!distances.has(goalId)) return [];
  const route = [goalId]; while (route[0] !== startId) { const parent = previous.get(route[0]!); if (!parent) return []; route.unshift(parent); } return route;
}

function copyTerrain(local: MapDefinition, target: Uint8Array, wallCoverage: Uint8Array, offsetX: number, offsetY: number): void { for (let y=0;y<local.heightTiles;y+=1) for(let x=0;x<local.widthTiles;x+=1){const source=y*local.widthTiles+x,destination=(y+offsetY)*MULTI_CITY_WIDTH_TILES+x+offsetX;target[destination]=local.terrain[source]!;wallCoverage[destination]=local.minimapWallCoverage[source]!;} }
function translateBuilding(building: BuildingDefinition, city: CityRegionPlan, id: string): BuildingDefinition { const translateIndex=(index:number)=>(Math.floor(index/CITY_REGION_WIDTH)+city.originY)*MULTI_CITY_WIDTH_TILES+(index%CITY_REGION_WIDTH)+city.originX;return{...building,id,roadId:`${city.id}:${building.roadId}`,centerTileX:building.centerTileX+city.originX,centerTileY:building.centerTileY+city.originY,footprintTiles:building.footprintTiles.map(translateIndex),floorTiles:building.floorTiles.map(translateIndex),wallTiles:building.wallTiles.map(translateIndex),entranceTiles:building.entranceTiles.map(translateIndex),wallSegments:building.wallSegments.map((segment)=>translateSegment(segment,city.originX,city.originY))}; }
function translateSegment<T extends {startX:number;startY:number;endX:number;endY:number}>(segment:T,offsetX:number,offsetY:number):T{return{...segment,startX:segment.startX+offsetX*TILE_SIZE,endX:segment.endX+offsetX*TILE_SIZE,startY:segment.startY+offsetY*TILE_SIZE,endY:segment.endY+offsetY*TILE_SIZE};}
function translatePoint<T extends {x:number;y:number}>(point:T,offsetX:number,offsetY:number):T{return{...point,x:point.x+offsetX*TILE_SIZE,y:point.y+offsetY*TILE_SIZE};}
function poiBuildingKind(kind:CityKind,index:number):BuildingDefinition["kind"]{if(kind==="military")return index===5?"clinic":index===3?"garage":"warehouse";if(kind==="industrial")return index===2?"warehouse":index===5?"garage":"ruin";return index===4?"garage":index===1?"office":"store";}
function subSeed(seed:number,salt:number):number{return Math.floor(deterministicHash(salt,salt*17,seed)*0x1_0000_0000)>>>0;}
function paintRiversAndBanks(terrain:Uint8Array):void{const bankStart=WORLD_OUTER_MARGIN_TILES+CITY_REGION_WIDTH,waterStart=bankStart+RIVER_BANK_WIDTH_TILES,waterEnd=waterStart+RIVER_WIDTH_TILES;for(let y=0;y<MULTI_CITY_HEIGHT_TILES;y+=1)for(let x=bankStart;x<waterEnd+RIVER_BANK_WIDTH_TILES;x+=1)terrain[y*MULTI_CITY_WIDTH_TILES+x]=x>=waterStart&&x<waterEnd?TerrainType.Water:TerrainType.RiverBank;for(let y=bankStart;y<waterEnd+RIVER_BANK_WIDTH_TILES;y+=1)for(let x=0;x<MULTI_CITY_WIDTH_TILES;x+=1)terrain[y*MULTI_CITY_WIDTH_TILES+x]=y>=waterStart&&y<waterEnd?TerrainType.Water:TerrainType.RiverBank;}
function paintBridge(terrain:Uint8Array,bridge:BridgePlan):void{const half=Math.floor(bridge.widthTiles/2),span=CITY_GAP_TILES+bridge.approachLengthTiles*2;if(bridge.axis==="horizontal")for(let y=bridge.centerY-half;y<=bridge.centerY+half;y+=1)for(let x=Math.floor(bridge.centerX-span/2);x<=Math.ceil(bridge.centerX+span/2);x+=1)terrain[y*MULTI_CITY_WIDTH_TILES+x]=TerrainType.BridgeRoad;else for(let x=bridge.centerX-half;x<=bridge.centerX+half;x+=1)for(let y=Math.floor(bridge.centerY-span/2);y<=Math.ceil(bridge.centerY+span/2);y+=1)terrain[y*MULTI_CITY_WIDTH_TILES+x]=TerrainType.BridgeRoad;}
function bridgeRoadSegment(bridge:BridgePlan):RoadSegment{const halfSpan=CITY_GAP_TILES/2+BRIDGE_APPROACH_TILES;return{id:bridge.id,kind:"arterial",startX:bridge.axis==="horizontal"?bridge.centerX-halfSpan:bridge.centerX,startY:bridge.axis==="vertical"?bridge.centerY-halfSpan:bridge.centerY,endX:bridge.axis==="horizontal"?bridge.centerX+halfSpan:bridge.centerX,endY:bridge.axis==="vertical"?bridge.centerY+halfSpan:bridge.centerY,widthTiles:bridge.widthTiles,sidewalkTiles:0,laneMarking:true};}
function createRiverCollisionStrips():WorldObstacle[]{const bankStart=WORLD_OUTER_MARGIN_TILES+CITY_REGION_WIDTH,waterStart=bankStart+RIVER_BANK_WIDTH_TILES,centers=[WORLD_OUTER_MARGIN_TILES+CITY_REGION_WIDTH/2,WORLD_OUTER_MARGIN_TILES+CITY_REGION_WIDTH+CITY_GAP_TILES+CITY_REGION_WIDTH/2],half=Math.floor(ROAD_WIDTH_TILES/2),ranges=(maximum:number)=>[[0,centers[0]!-half],[centers[0]!+half+1,centers[1]!-half],[centers[1]!+half+1,maximum]] as const,obstacles:WorldObstacle[]=[];for(const [start,end] of ranges(MULTI_CITY_HEIGHT_TILES))if(end>start)obstacles.push(waterObstacle(`water-vertical-${start}`,waterStart,start,RIVER_WIDTH_TILES,end-start));for(const [start,end] of ranges(MULTI_CITY_WIDTH_TILES))if(end>start)obstacles.push(waterObstacle(`water-horizontal-${start}`,start,waterStart,end-start,RIVER_WIDTH_TILES));return obstacles;}
function waterObstacle(id:string,tileX:number,tileY:number,widthTiles:number,heightTiles:number):WorldObstacle{return{id,tileX,tileY,widthTiles,heightTiles,blocksMovement:true,blocksVision:false,blocksProjectiles:false,coverHeight:"none",kind:"water"};}
function normalizeRegionalZombieDensity(spawns:MapDefinition["zombieSpawns"],cities:readonly CityRegionPlan[],terrain:Uint8Array,seed:number):void{const base=spawns.filter((spawn)=>spawn.id.startsWith("mixed-nw:")).length,occupied=new Set(spawns.map((spawn)=>`${spawn.tileX},${spawn.tileY}`));for(const city of cities){const prefix=`${city.id}:`,regional=spawns.filter((spawn)=>spawn.id.startsWith(prefix)),target=Math.round(base*city.profile.zombieDensityMultiplier);if(regional.length>target){const remove=new Set(regional.slice(target).map((spawn)=>spawn.id));for(let index=spawns.length-1;index>=0;index-=1)if(remove.has(spawns[index]!.id)){occupied.delete(`${spawns[index]!.tileX},${spawns[index]!.tileY}`);spawns.splice(index,1);}}let sequence=regional.length;for(let attempt=0;sequence<target&&attempt<CITY_REGION_WIDTH*CITY_REGION_HEIGHT*2;attempt+=1){const x=city.originX+Math.floor(deterministicHash(attempt,city.seed,seed)*CITY_REGION_WIDTH),y=city.originY+Math.floor(deterministicHash(city.seed,attempt,seed^0x9e3779b9)*CITY_REGION_HEIGHT),key=`${x},${y}`,tile=terrain[y*MULTI_CITY_WIDTH_TILES+x];if(occupied.has(key)||tile===TerrainType.Floor||tile===TerrainType.Water)continue;occupied.add(key);spawns.push({id:`${prefix}density-${sequence}`,tileX:x,tileY:y,kind:deterministicHash(x,y,city.seed)<.24?"runner":"walker"});sequence+=1;}}}
