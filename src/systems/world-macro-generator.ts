import { TILE_SIZE } from "../config/game-config";
import { deterministicHash } from "../core/seeded-rng";
import { TerrainType, type BuildingDefinition, type MapDefinition, type RoadSegment, type WorldObstacle } from "../data/map-definitions";
import type { DistrictPropDefinition, DoorAccessPlan, RoadEdge, WorldPolygon } from "../data/road-generation-definitions";
import {
  CITY_GAP_TILES, CITY_PROFILES, CITY_REGION_HEIGHT, CITY_REGION_WIDTH, MULTI_CITY_HEIGHT_TILES, MULTI_CITY_WIDTH_TILES,
  RIVER_BANK_WIDTH_TILES, RIVER_WIDTH_TILES, WORLD_OUTER_MARGIN_TILES,
  type BridgePlan, type CityKind, type CityRegionId, type CityRegionPlan, type TransitEdge, type TransitNode, type WorldMacroPlan,
} from "../data/world-region-definitions";
import {
  BUILDING_SETBACK_TILES, ROAD_PROFILES, createBuildingEnvelope, createBuildingLot, createDoorAccessPlan,
  createRoadGraph, measureBuildingRoadClearance, paintDoorAccessPaths, rasterizeRoadGraph,
} from "./map-generation-system";

const LEGACY_ROAD_WIDTH_TILES = 7;
const CONNECTOR_ROAD_WIDTH_TILES = 10;
const BRIDGE_APPROACH_TILES = 8;

export function createMultiCityWorld(mapSeed: number, createSingleCity: (seed: number,kind:CityKind) => MapDefinition,mapGenerationVersion=5): MapDefinition {
  if(mapGenerationVersion>=6)return createRoadFirstMultiCityWorld(mapSeed,createSingleCity);
  return createLegacyMultiCityWorld(mapSeed,createSingleCity,mapGenerationVersion);
}

function createLegacyMultiCityWorld(mapSeed: number, createSingleCity: (seed: number,kind:CityKind) => MapDefinition,mapGenerationVersion:number): MapDefinition {
  const cities = createCityPlans(mapSeed);
  const bridges = createBridgePlans(mapGenerationVersion);
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
    const local = createSingleCity(city.seed,city.kind);
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
    mapId: "multi-city-world-v1", mapVersion: mixedMap.mapVersion, mapGenerationVersion, mapSeed,
    widthTiles: MULTI_CITY_WIDTH_TILES, heightTiles: MULTI_CITY_HEIGHT_TILES, terrain, minimapWallCoverage, roadSegments,
    buildings, structures: buildings, wallSegments, generatedStructures, obstacles, doors, containers, groundItems, zombieSpawns,
    playerSpawn, companionSpawns, survivorSpawn: translatePoint(mixedMap.survivorSpawn, mixed.originX, mixed.originY),
    extractionZone: { ...translatePoint(mixedMap.extractionZone, mixed.originX, mixed.originY), radius: mixedMap.extractionZone.radius },
    safehouseZone: { ...mixedMap.safehouseZone, x: mixedMap.safehouseZone.x + mixed.originX * TILE_SIZE, y: mixedMap.safehouseZone.y + mixed.originY * TILE_SIZE },
    worldPlan,
  };
}

function createRoadFirstMultiCityWorld(mapSeed:number,createSingleCity:(seed:number,kind:CityKind)=>MapDefinition):MapDefinition{
  const content=createLegacyMultiCityWorld(mapSeed,createSingleCity,6);
  const cities=content.worldPlan!.cities;
  const bridges=createBridgePlans(6);
  const roadSources=cities.map((city)=>({city,roads:content.roadSegments.filter((road)=>road.id.startsWith(`${city.id}:`)).map((road)=>({
    ...road,id:road.id.slice(city.id.length+1),startX:road.startX-city.originX,startY:road.startY-city.originY,endX:road.endX-city.originX,endY:road.endY-city.originY,
  }))}));
  const roadGraph=createRoadGraph(roadSources,bridges);
  nudgeBuildingsOffCorridors(content,roadGraph.edges,cities);
  const baseTerrain=new Uint8Array(MULTI_CITY_WIDTH_TILES*MULTI_CITY_HEIGHT_TILES);
  paintRiversAndBanks(baseTerrain);
  const riverBanks=createRiverBankPolygons();
  const rasterized=rasterizeRoadGraph(baseTerrain,MULTI_CITY_WIDTH_TILES,MULTI_CITY_HEIGHT_TILES,roadGraph,{
    ground:TerrainType.Ground,road:TerrainType.Road,sidewalk:TerrainType.Sidewalk,water:TerrainType.Water,riverBank:TerrainType.RiverBank,bridgeRoad:TerrainType.BridgeRoad,
  },riverBanks);
  const terrain=rasterized.terrain;
  const minimapWallCoverage=new Uint8Array(terrain.length);
  for(const building of content.buildings){
    for(const index of building.footprintTiles)if(terrain[index]!==TerrainType.Road&&terrain[index]!==TerrainType.BridgeRoad&&terrain[index]!==TerrainType.Sidewalk)terrain[index]=TerrainType.Floor;
    for(const index of building.wallTiles)minimapWallCoverage[index]=1;
  }
  const buildingEnvelopes=content.buildings.map((building)=>{const envelope=createBuildingEnvelope(building);envelope.clearanceTiles=measureBuildingRoadClearance(envelope,roadGraph);return envelope;});
  const edgeByBuilding=new Map<string,RoadEdge>();
  for(const building of content.buildings)edgeByBuilding.set(building.id,nearestRoadEdge(roadGraph.edges,building.centerTileX,building.centerTileY));
  const buildingLots=content.buildings.map((building)=>{
    const city=cities.find((candidate)=>building.id.startsWith(`${candidate.id}:`))!;
    const edge=edgeByBuilding.get(building.id)!;
    const range=BUILDING_SETBACK_TILES[city.kind];
    const measured=buildingEnvelopes.find((candidate)=>candidate.buildingId===building.id)!.clearanceTiles;
    return createBuildingLot(building,city.id,edge,Math.max(range[0],Math.min(range[1],measured)));
  });
  const doorAccessPlans=content.doors.flatMap((door)=>{const building=door.buildingId?content.buildings.find((candidate)=>candidate.id===door.buildingId):undefined;return building?[createDoorAccessPlan(door,building,edgeByBuilding.get(building.id)!)]:[];});
  paintDoorAccessPaths(terrain,MULTI_CITY_WIDTH_TILES,MULTI_CITY_HEIGHT_TILES,doorAccessPlans,TerrainType.Road,TerrainType.Sidewalk,TerrainType.BridgeRoad);
  const districtProps=createDistrictProps(cities,content.buildings,terrain,doorAccessPlans,mapSeed);
  for(const prop of districtProps)if(prop.placement==="interactive-furniture")content.containers.push({id:`prop-container:${prop.id}`,tileX:prop.tileX,tileY:prop.tileY,kind:prop.district==="military"||prop.district==="industrial"?"crate":"drawer",loot:districtPropLoot(prop.district)});
  const propObstacles:WorldObstacle[]=districtProps.filter((prop)=>prop.placement==="static-obstacle").map((prop)=>({id:`prop-obstacle:${prop.id}`,tileX:prop.tileX,tileY:prop.tileY,widthTiles:1,heightTiles:1,blocksMovement:true,blocksVision:false,blocksProjectiles:true,coverHeight:"low",kind:"furniture"}));
  const obstacles=[...content.obstacles.filter((obstacle)=>obstacle.kind!=="water"),...createRiverCollisionStrips(CONNECTOR_ROAD_WIDTH_TILES),...propObstacles];
  const roadSegments=roadGraph.edges.map(edgeToRoadSegment);
  const worldPlan={...content.worldPlan!,bridges};
  return {...content,mapId:"multi-city-v3-road-first",mapGenerationVersion:6,terrain,minimapWallCoverage,roadSegments,obstacles,worldPlan,roadGraph,reservedCorridors:rasterized.reserved,roadRenderData:rasterized.renderData,buildingLots,buildingEnvelopes,doorAccessPlans,districtProps};
}

function edgeToRoadSegment(edge:RoadEdge):RoadSegment{const start=edge.centerline[0]!,end=edge.centerline.at(-1)!,section=ROAD_PROFILES[edge.profileId].crossSection;return{id:edge.id,kind:edge.roadClass==="connector"?"arterial":Math.abs(end.x-start.x)>0.01&&Math.abs(end.y-start.y)>0.01?"diagonal":edge.roadClass==="arterial"?"arterial":"street",startX:start.x,startY:start.y,endX:end.x,endY:end.y,widthTiles:section.roadWidthTiles,sidewalkTiles:Math.max(section.leftSidewalkTiles,section.rightSidewalkTiles),laneMarking:edge.laneMarking};}
function nearestRoadEdge(edges:readonly RoadEdge[],x:number,y:number):RoadEdge{let best=edges[0]!,distance=Number.POSITIVE_INFINITY;for(const edge of edges){const start=edge.centerline[0]!,end=edge.centerline.at(-1)!,candidate=pointSegmentDistanceTiles(x,y,start.x,start.y,end.x,end.y);if(candidate<distance){distance=candidate;best=edge;}}return best;}
function pointSegmentDistanceTiles(px:number,py:number,ax:number,ay:number,bx:number,by:number):number{const dx=bx-ax,dy=by-ay,length=dx*dx+dy*dy,amount=length===0?0:Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/length));return Math.hypot(px-(ax+dx*amount),py-(ay+dy*amount));}
function nudgeBuildingsOffCorridors(map:MapDefinition,edges:readonly RoadEdge[],cities:readonly CityRegionPlan[]):void{
  const occupied=new Set<number>(map.buildings.flatMap((building)=>building.footprintTiles));
  for(const building of map.buildings){
    if(measureBuildingRoadClearance(createBuildingEnvelope(building),{edges:[...edges],nodes:[]})>=0)continue;
    for(const index of building.footprintTiles)occupied.delete(index);
    const city=cities.find((candidate)=>building.id.startsWith(`${candidate.id}:`))!;
    let placed=false;
    const tryOffset=(dx:number,dy:number):boolean=>{
      const candidate=shiftedBuilding(building,dx,dy,map.widthTiles),bounds=buildingBounds(candidate,map.widthTiles);
      if(bounds.minX<city.originX+1||bounds.minY<city.originY+1||bounds.maxX>=city.originX+city.widthTiles-1||bounds.maxY>=city.originY+city.heightTiles-1||candidate.footprintTiles.some((tile)=>occupied.has(tile)))return false;
      if(measureBuildingRoadClearance(createBuildingEnvelope(candidate),{edges:[...edges],nodes:[]})<0)return false;
      shiftBuildingContent(map,building,dx,dy);return true;
    };
    for(let radius=1;radius<=8&&!placed;radius+=1){
      const offsets:ReadonlyArray<readonly[number,number]>=[[radius,0],[-radius,0],[0,radius],[0,-radius],[radius,radius],[radius,-radius],[-radius,radius],[-radius,-radius]];
      for(const [dx,dy] of offsets)if(tryOffset(dx,dy)){placed=true;break;}
    }
    for(const index of building.footprintTiles)occupied.add(index);
  }
  map.wallSegments.length=0;for(const structure of map.generatedStructures)if(structure.buildableId==="wood-wall")map.wallSegments.push(structure.placement);
}
function shiftedBuilding(building:BuildingDefinition,dx:number,dy:number,width:number):BuildingDefinition{const delta=dy*width+dx,shiftSegment=<T extends{startX:number;startY:number;endX:number;endY:number}>(segment:T):T=>({...segment,startX:segment.startX+dx*TILE_SIZE,endX:segment.endX+dx*TILE_SIZE,startY:segment.startY+dy*TILE_SIZE,endY:segment.endY+dy*TILE_SIZE});return{...building,centerTileX:building.centerTileX+dx,centerTileY:building.centerTileY+dy,footprintTiles:building.footprintTiles.map((index)=>index+delta),floorTiles:building.floorTiles.map((index)=>index+delta),wallTiles:building.wallTiles.map((index)=>index+delta),entranceTiles:building.entranceTiles.map((index)=>index+delta),wallSegments:building.wallSegments.map(shiftSegment)};}
function shiftBuildingContent(map:MapDefinition,building:BuildingDefinition,dx:number,dy:number):void{const oldFootprint=new Set(building.footprintTiles),shifted=shiftedBuilding(building,dx,dy,map.widthTiles),shiftSegment=<T extends{startX:number;startY:number;endX:number;endY:number}>(segment:T):T=>({...segment,startX:segment.startX+dx*TILE_SIZE,endX:segment.endX+dx*TILE_SIZE,startY:segment.startY+dy*TILE_SIZE,endY:segment.endY+dy*TILE_SIZE});Object.assign(building,shifted);for(const structure of map.generatedStructures)if(structure.buildingId===building.id)structure.placement=shiftSegment(structure.placement);for(const door of map.doors)if(door.buildingId===building.id){door.tileX+=dx;door.tileY+=dy;if(door.segment)door.segment=shiftSegment(door.segment);}for(const container of map.containers)if(oldFootprint.has(container.tileY*map.widthTiles+container.tileX)){container.tileX+=dx;container.tileY+=dy;}for(const item of map.groundItems)if(oldFootprint.has(item.tileY*map.widthTiles+item.tileX)){item.tileX+=dx;item.tileY+=dy;}for(const spawn of map.companionSpawns)if(oldFootprint.has(spawn.tileY*map.widthTiles+spawn.tileX)){spawn.tileX+=dx;spawn.tileY+=dy;}const playerTile=Math.floor(map.playerSpawn.y/TILE_SIZE)*map.widthTiles+Math.floor(map.playerSpawn.x/TILE_SIZE);if(oldFootprint.has(playerTile)){map.playerSpawn.x+=dx*TILE_SIZE;map.playerSpawn.y+=dy*TILE_SIZE;}const survivorTile=Math.floor(map.survivorSpawn.y/TILE_SIZE)*map.widthTiles+Math.floor(map.survivorSpawn.x/TILE_SIZE);if(oldFootprint.has(survivorTile)){map.survivorSpawn.x+=dx*TILE_SIZE;map.survivorSpawn.y+=dy*TILE_SIZE;}if(building.kind==="safehouse"){map.safehouseZone.x+=dx*TILE_SIZE;map.safehouseZone.y+=dy*TILE_SIZE;}}
function buildingBounds(building:BuildingDefinition,width:number):{minX:number;minY:number;maxX:number;maxY:number}{let minX=width,minY=width,maxX=0,maxY=0;for(const index of building.footprintTiles){const x=index%width,y=Math.floor(index/width);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}return{minX,minY,maxX,maxY};}
function createRiverBankPolygons():WorldPolygon[]{const bankStart=WORLD_OUTER_MARGIN_TILES+CITY_REGION_WIDTH,waterStart=bankStart+RIVER_BANK_WIDTH_TILES,waterEnd=waterStart+RIVER_WIDTH_TILES,worldWidth=MULTI_CITY_WIDTH_TILES,worldHeight=MULTI_CITY_HEIGHT_TILES,rectangle=(minX:number,minY:number,maxX:number,maxY:number):WorldPolygon=>({points:[{x:minX,y:minY},{x:maxX,y:minY},{x:maxX,y:maxY},{x:minX,y:maxY}]});return[rectangle(bankStart,0,waterStart,worldHeight),rectangle(waterEnd,0,waterEnd+RIVER_BANK_WIDTH_TILES,worldHeight),rectangle(0,bankStart,worldWidth,waterStart),rectangle(0,waterEnd,worldWidth,waterEnd+RIVER_BANK_WIDTH_TILES)];}

const DISTRICT_OUTDOOR_PROPS:Record<CityKind,readonly string[]>={
  mixed:["streetlight","bench","trash-can","mailbox","bus-stop","planter","parked-car","street-sign"],
  military:["checkpoint-barrier","sandbag","security-fence","floodlight","supply-crate","maintenance-cart","training-target","military-vehicle"],
  industrial:["steel-coil","pallet","pipe-bundle","cargo-crate","oil-drum","scrap-pile","storage-tank","loading-ramp"],
  commercial:["bench","planter","billboard","shopping-cart","bus-stop","road-barrier","streetlight","vending-machine"],
};
const DISTRICT_INTERIOR_PROPS:Record<CityKind,readonly string[]>={
  mixed:["bed","table","chair","refrigerator","shelf","cabinet"],military:["bunk","locker","weapon-rack","medical-bed","operations-table","radio-console"],
  industrial:["workbench","machine-tool","conveyor","toolbox","welding-station","electric-motor"],commercial:["display-shelf","checkout-counter","clothing-rack","office-desk","monitor","server-rack"],
};
function createDistrictProps(cities:readonly CityRegionPlan[],buildings:readonly BuildingDefinition[],terrain:Uint8Array,accessPlans:readonly DoorAccessPlan[],seed:number):DistrictPropDefinition[]{
  const props:DistrictPropDefinition[]=[];
  for(const city of cities){
    const outdoor=DISTRICT_OUTDOOR_PROPS[city.kind];let outdoorIndex=0;
    for(let attempt=0;attempt<900&&outdoorIndex<outdoor.length*2;attempt+=1){const x=city.originX+2+Math.floor(deterministicHash(attempt,city.seed,seed^0x70726f70)*(city.widthTiles-4)),y=city.originY+2+Math.floor(deterministicHash(city.seed,attempt,seed^0x64697374)*(city.heightTiles-4)),index=y*MULTI_CITY_WIDTH_TILES+x;if(terrain[index]!==TerrainType.Ground||!hasAdjacentSidewalk(terrain,x,y)||accessPlans.some((plan)=>pointSegmentDistanceTiles(x+.5,y+.5,plan.path.startX/TILE_SIZE,plan.path.startY/TILE_SIZE,plan.path.endX/TILE_SIZE,plan.path.endY/TILE_SIZE)<1.25))continue;props.push({id:`${city.id}:outdoor-${outdoorIndex}`,regionId:city.id,district:city.kind,kind:outdoor[outdoorIndex%outdoor.length]!,placement:outdoorIndex%4===0?"static-obstacle":"static-decoration",tileX:x,tileY:y,rotation:([0,90,180,270] as const)[outdoorIndex%4]!});outdoorIndex+=1;}
    const regionalBuildings=buildings.filter((building)=>building.id.startsWith(`${city.id}:`));const interior=DISTRICT_INTERIOR_PROPS[city.kind];
    for(let index=0;index<interior.length*2&&regionalBuildings.length>0;index+=1){const building=regionalBuildings[index%regionalBuildings.length]!,tile=building.floorTiles[(index*7+3)%building.floorTiles.length]!;props.push({id:`${city.id}:interior-${index}`,regionId:city.id,district:city.kind,kind:interior[index%interior.length]!,placement:index%3===0?"interactive-furniture":"static-decoration",tileX:tile%MULTI_CITY_WIDTH_TILES,tileY:Math.floor(tile/MULTI_CITY_WIDTH_TILES),rotation:([0,90,180,270] as const)[index%4]!,interiorBuildingId:building.id});}
  }
  return props;
}
function hasAdjacentSidewalk(terrain:Uint8Array,x:number,y:number):boolean{return([[1,0],[-1,0],[0,1],[0,-1]] as const).some(([dx,dy])=>terrain[(y+dy)*MULTI_CITY_WIDTH_TILES+x+dx]===TerrainType.Sidewalk);}
function districtPropLoot(district:CityKind):MapDefinition["containers"][number]["loot"]{if(district==="military")return[{itemId:"pistol_ammo",quantity:3}];if(district==="industrial")return[{itemId:"metal",quantity:2}];if(district==="commercial")return[{itemId:"canned_food",quantity:1}];return[{itemId:"cloth",quantity:1}];}

export function createCityPlans(seed: number): CityRegionPlan[] {
  const far = WORLD_OUTER_MARGIN_TILES + CITY_REGION_WIDTH + CITY_GAP_TILES;
  const specs: ReadonlyArray<[CityRegionId, CityKind, number, number]> = [
    ["mixed-nw", "mixed", WORLD_OUTER_MARGIN_TILES, WORLD_OUTER_MARGIN_TILES], ["military-ne", "military", far, WORLD_OUTER_MARGIN_TILES],
    ["industrial-sw", "industrial", WORLD_OUTER_MARGIN_TILES, far], ["commercial-se", "commercial", far, far],
  ];
  return specs.map(([id, kind, originX, originY], index) => ({ id, kind, originX, originY, widthTiles: CITY_REGION_WIDTH, heightTiles: CITY_REGION_HEIGHT, seed: subSeed(seed, index + 1), profile: CITY_PROFILES[kind] }));
}

export function createBridgePlans(mapGenerationVersion=6): BridgePlan[] {
  const north = WORLD_OUTER_MARGIN_TILES + CITY_REGION_HEIGHT / 2; const south = north + CITY_REGION_HEIGHT + CITY_GAP_TILES;
  const west = WORLD_OUTER_MARGIN_TILES + CITY_REGION_WIDTH / 2; const east = west + CITY_REGION_WIDTH + CITY_GAP_TILES;
  const center = WORLD_OUTER_MARGIN_TILES + CITY_REGION_WIDTH + CITY_GAP_TILES / 2;
  const width=mapGenerationVersion>=6?CONNECTOR_ROAD_WIDTH_TILES:LEGACY_ROAD_WIDTH_TILES;
  return [
    { id: "bridge-mixed-military", from: "mixed-nw", to: "military-ne", axis: "horizontal", centerX: center, centerY: north, widthTiles: width, approachLengthTiles: BRIDGE_APPROACH_TILES },
    { id: "bridge-mixed-industrial", from: "mixed-nw", to: "industrial-sw", axis: "vertical", centerX: west, centerY: center, widthTiles: width, approachLengthTiles: BRIDGE_APPROACH_TILES },
    { id: "bridge-military-commercial", from: "military-ne", to: "commercial-se", axis: "vertical", centerX: east, centerY: center, widthTiles: width, approachLengthTiles: BRIDGE_APPROACH_TILES },
    { id: "bridge-industrial-commercial", from: "industrial-sw", to: "commercial-se", axis: "horizontal", centerX: center, centerY: south, widthTiles: width, approachLengthTiles: BRIDGE_APPROACH_TILES },
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
function createRiverCollisionStrips(roadWidth=LEGACY_ROAD_WIDTH_TILES):WorldObstacle[]{const bankStart=WORLD_OUTER_MARGIN_TILES+CITY_REGION_WIDTH,waterStart=bankStart+RIVER_BANK_WIDTH_TILES,centers=[WORLD_OUTER_MARGIN_TILES+CITY_REGION_WIDTH/2,WORLD_OUTER_MARGIN_TILES+CITY_REGION_WIDTH+CITY_GAP_TILES+CITY_REGION_WIDTH/2],half=Math.ceil(roadWidth/2),ranges=(maximum:number)=>[[0,centers[0]!-half],[centers[0]!+half+1,centers[1]!-half],[centers[1]!+half+1,maximum]] as const,obstacles:WorldObstacle[]=[];for(const [start,end] of ranges(MULTI_CITY_HEIGHT_TILES))if(end>start)obstacles.push(waterObstacle(`water-vertical-${start}`,waterStart,start,RIVER_WIDTH_TILES,end-start));for(const [start,end] of ranges(MULTI_CITY_WIDTH_TILES))if(end>start)obstacles.push(waterObstacle(`water-horizontal-${start}`,start,waterStart,end-start,RIVER_WIDTH_TILES));return obstacles;}
function waterObstacle(id:string,tileX:number,tileY:number,widthTiles:number,heightTiles:number):WorldObstacle{return{id,tileX,tileY,widthTiles,heightTiles,blocksMovement:true,blocksVision:false,blocksProjectiles:false,coverHeight:"none",kind:"water"};}
function normalizeRegionalZombieDensity(spawns:MapDefinition["zombieSpawns"],cities:readonly CityRegionPlan[],terrain:Uint8Array,seed:number):void{const base=spawns.filter((spawn)=>spawn.id.startsWith("mixed-nw:")).length,occupied=new Set(spawns.map((spawn)=>`${spawn.tileX},${spawn.tileY}`));for(const city of cities){const prefix=`${city.id}:`,regional=spawns.filter((spawn)=>spawn.id.startsWith(prefix)),target=Math.round(base*city.profile.zombieDensityMultiplier);if(regional.length>target){const remove=new Set(regional.slice(target).map((spawn)=>spawn.id));for(let index=spawns.length-1;index>=0;index-=1)if(remove.has(spawns[index]!.id)){occupied.delete(`${spawns[index]!.tileX},${spawns[index]!.tileY}`);spawns.splice(index,1);}}let sequence=regional.length;for(let attempt=0;sequence<target&&attempt<CITY_REGION_WIDTH*CITY_REGION_HEIGHT*2;attempt+=1){const x=city.originX+Math.floor(deterministicHash(attempt,city.seed,seed)*CITY_REGION_WIDTH),y=city.originY+Math.floor(deterministicHash(city.seed,attempt,seed^0x9e3779b9)*CITY_REGION_HEIGHT),key=`${x},${y}`,tile=terrain[y*MULTI_CITY_WIDTH_TILES+x];if(occupied.has(key)||tile===TerrainType.Floor||tile===TerrainType.Water)continue;occupied.add(key);spawns.push({id:`${prefix}density-${sequence}`,tileX:x,tileY:y,kind:deterministicHash(x,y,city.seed)<.24?"runner":"walker"});sequence+=1;}}}
