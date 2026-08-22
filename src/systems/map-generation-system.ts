import { TILE_SIZE } from "../config/game-config";
import type { BuildingDefinition, DoorDefinition, RoadSegment } from "../data/map-definitions";
import type {
  BuildingEnvelope, BuildingLot, DoorAccessPlan, ReservedWorldCorridors,
  RoadCrossSection, RoadEdge, RoadGraph, RoadNode, RoadProfile, RoadProfileId, RoadRenderData,
  RoadPoint, RoadRenderTile, RoadSurface, RoadTileVariant, WorldPolygon,
} from "../data/road-generation-definitions";
import type { BridgePlan, CityKind, CityRegionPlan } from "../data/world-region-definitions";

export const ROAD_PROFILES: Record<RoadProfileId, RoadProfile> = {
  "mixed-arterial": profile("mixed-arterial", "mixed", "arterial", 6, 1),
  "mixed-secondary": profile("mixed-secondary", "mixed", "secondary", 4, 1),
  "military-arterial": profile("military-arterial", "military", "arterial", 10, 2),
  "military-secondary": profile("military-secondary", "military", "secondary", 8, 1.5),
  "industrial-arterial": profile("industrial-arterial", "industrial", "arterial", 10, 2),
  "industrial-secondary": profile("industrial-secondary", "industrial", "secondary", 8, 1.5),
  "commercial-arterial": profile("commercial-arterial", "commercial", "arterial", 8, 2),
  "commercial-secondary": profile("commercial-secondary", "commercial", "secondary", 6, 1.5),
  "world-connector": profile("world-connector", "world", "connector", 10, 2),
};

export const BUILDING_SETBACK_TILES: Record<CityKind, readonly [number, number]> = {
  mixed: [0.5, 1], commercial: [0, 0.5], industrial: [1, 3], military: [1, 3],
};

export interface RoadTerrainCodes { ground: number; road: number; sidewalk: number; water: number; riverBank: number; bridgeRoad: number }
export interface CityRoadSource { city: CityRegionPlan; roads: readonly RoadSegment[] }

export function createRoadGraph(sources: readonly CityRoadSource[], bridges: readonly BridgePlan[]): RoadGraph {
  const edges: RoadEdge[] = [];
  for (const { city, roads } of sources) {
    for (const road of roads) {
      if (road.id === "arterial-east-west" || road.id === "arterial-north-south") continue;
      const roadClass = road.kind === "arterial" ? "arterial" : "secondary";
      edges.push({
        id: `${city.id}:${road.id}`, district: city.kind, regionId: city.id, roadClass,
        centerline: [
          { x: road.startX + city.originX, y: road.startY + city.originY },
          { x: road.endX + city.originX, y: road.endY + city.originY },
        ],
        profileId: profileId(city.kind, roadClass), laneMarking: road.laneMarking,
        surfaceSections: [{ start: 0, end: 1, surface: "asphalt" }],
      });
    }
  }
  for (const bridge of bridges) edges.push(createConnectorEdge(bridge, sources));
  return { edges, nodes: createRoadNodes(edges) };
}

export function rasterizeRoadGraph(
  baseTerrain: Uint8Array,
  width: number,
  height: number,
  graph: RoadGraph,
  codes: RoadTerrainCodes,
  riverBanks: readonly WorldPolygon[],
): { terrain: Uint8Array; reserved: ReservedWorldCorridors; renderData: RoadRenderData } {
  const terrain = baseTerrain.slice();
  const mutableTiles = new Map<number, MutableRoadTile>();
  const maskCache = new Map<string, CachedMask>();
  const reserved: ReservedWorldCorridors = { roadSurface: [], sidewalks: [], bridgeApproaches: [], riverBanks: [...riverBanks], intersections: [] };
  for (const edge of graph.edges) {
    const crossSection = ROAD_PROFILES[edge.profileId].crossSection;
    for (let part = 0; part < edge.centerline.length - 1; part += 1) {
      const start = edge.centerline[part]!;
      const end = edge.centerline[part + 1]!;
      appendCorridors(reserved, edge, start.x, start.y, end.x, end.y, crossSection);
      rasterizeRoadPart(terrain, width, height, edge, start.x, start.y, end.x, end.y, crossSection, codes, mutableTiles, maskCache);
    }
  }
  for (const node of graph.nodes) if (node.edgeIds.length >= 3) {
    const radius = Math.max(...node.edgeIds.map((id) => {
      const edge = graph.edges.find((candidate) => candidate.id === id)!;
      const section = ROAD_PROFILES[edge.profileId].crossSection;
      return section.roadWidthTiles / 2 + Math.max(section.leftSidewalkTiles, section.rightSidewalkTiles);
    }));
    reserved.intersections.push(circlePolygon(node.x, node.y, radius, 8));
  }
  const tiles: RoadRenderTile[] = [];
  for (const [index, tile] of mutableTiles) {
    for (let row = 0; row < TILE_SIZE; row += 1) tile.sidewalkRows[row] &= ~tile.roadRows[row]!;
    tiles.push({ tileX: index % width, tileY: Math.floor(index / width), variant: tile.edgeTouches > 1 ? "road-intersection" : tile.variant,
      underlayTerrain: tile.underlayTerrain, roadRows: tile.roadRows, sidewalkRows: tile.sidewalkRows,
      bridgeRows: tile.bridgeRows, centerlineRows: tile.centerlineRows });
  }
  tiles.sort((a, b) => a.tileY - b.tileY || a.tileX - b.tileX);
  return { terrain, reserved, renderData: { tileSize: TILE_SIZE, chunkTiles: 16, maskCacheEntries: maskCache.size, tiles } };
}

export function createBuildingEnvelope(building: BuildingDefinition): BuildingEnvelope {
  const points = building.wallSegments.flatMap((segment) => [
    { x: segment.startX / TILE_SIZE, y: segment.startY / TILE_SIZE },
    { x: segment.endX / TILE_SIZE, y: segment.endY / TILE_SIZE },
  ]);
  const polygon = convexHull(points.length > 0 ? points : footprintCorners(building));
  const wallThicknessPixels = building.wallSegments.reduce((maximum, segment) => Math.max(maximum, segment.thickness), 0);
  return { buildingId: building.id, polygon: { points: polygon }, wallCapsules: building.wallSegments.map((segment) => ({ ...segment })), wallThicknessPixels, clearanceTiles: 0 };
}

export function createBuildingLot(building: BuildingDefinition, regionId: CityRegionPlan["id"], edge: RoadEdge, setbackTiles: number): BuildingLot {
  const center = { x: building.centerTileX, y: building.centerTileY };
  const projection = projectToEdge(center.x, center.y, edge);
  return {
    id: `lot:${building.id}`, buildingId: building.id, regionId, roadEdgeId: edge.id, setbackTiles,
    frontage: { startX: projection.x * TILE_SIZE, startY: projection.y * TILE_SIZE, endX: center.x * TILE_SIZE, endY: center.y * TILE_SIZE, thickness: TILE_SIZE },
    polygon: { points: convexHull(footprintCorners(building)) },
  };
}

export function measureBuildingRoadClearance(envelope: BuildingEnvelope, graph: RoadGraph): number {
  let minimum = Number.POSITIVE_INFINITY;
  for (const wall of envelope.wallCapsules) {
    const wallRadius = wall.thickness / (2 * TILE_SIZE);
    for (const edge of graph.edges) {
      const section = ROAD_PROFILES[edge.profileId].crossSection;
      const corridorHalfWidth = section.roadWidthTiles / 2 + Math.max(section.leftSidewalkTiles, section.rightSidewalkTiles);
      for (let part = 0; part < edge.centerline.length - 1; part += 1) {
        const start = edge.centerline[part]!; const end = edge.centerline[part + 1]!;
        const distance = segmentDistance(
          wall.startX / TILE_SIZE, wall.startY / TILE_SIZE, wall.endX / TILE_SIZE, wall.endY / TILE_SIZE,
          start.x, start.y, end.x, end.y,
        ) - corridorHalfWidth - wallRadius;
        minimum = Math.min(minimum, distance);
      }
    }
  }
  return minimum;
}

export function createDoorAccessPlan(door: DoorDefinition, building: BuildingDefinition, edge: RoadEdge): DoorAccessPlan {
  const doorX = door.segment ? (door.segment.startX + door.segment.endX) / (2 * TILE_SIZE) : door.tileX + 0.5;
  const doorY = door.segment ? (door.segment.startY + door.segment.endY) / (2 * TILE_SIZE) : door.tileY + 0.5;
  const projection = projectToEdge(doorX, doorY, edge);
  return {
    id: `access:${door.id}`, buildingId: building.id, doorId: door.id, roadEdgeId: edge.id, clearanceTiles: 1,
    path: { startX: doorX * TILE_SIZE, startY: doorY * TILE_SIZE, endX: projection.x * TILE_SIZE, endY: projection.y * TILE_SIZE, thickness: TILE_SIZE },
  };
}

export function paintDoorAccessPaths(terrain: Uint8Array, width: number, height: number, plans: readonly DoorAccessPlan[], roadCode: number, sidewalkCode: number, bridgeCode: number): void {
  for (const plan of plans) {
    const startX = plan.path.startX / TILE_SIZE; const startY = plan.path.startY / TILE_SIZE;
    const endX = plan.path.endX / TILE_SIZE; const endY = plan.path.endY / TILE_SIZE;
    const minX = Math.max(0, Math.floor(Math.min(startX, endX) - 1)); const maxX = Math.min(width - 1, Math.ceil(Math.max(startX, endX) + 1));
    const minY = Math.max(0, Math.floor(Math.min(startY, endY) - 1)); const maxY = Math.min(height - 1, Math.ceil(Math.max(startY, endY) + 1));
    for (let y = minY; y <= maxY; y += 1) for (let x = minX; x <= maxX; x += 1) {
      const index = y * width + x;
      if (terrain[index] === roadCode || terrain[index] === bridgeCode) continue;
      if (pointSegmentDistance(x + 0.5, y + 0.5, startX, startY, endX, endY) <= 0.55) terrain[index] = sidewalkCode;
    }
  }
}

export function roadVariant(startX: number, startY: number, endX: number, endY: number): RoadTileVariant {
  const dx = endX - startX; const dy = endY - startY;
  if (Math.abs(dy) < 0.001) return "road-horizontal";
  if (Math.abs(dx) < 0.001) return "road-vertical";
  return dx * dy < 0 ? "road-diagonal-ne" : "road-diagonal-nw";
}

function profile(id: RoadProfileId, district: CityKind | "world", roadClass: RoadProfile["roadClass"], width: number, sidewalk: number): RoadProfile {
  return { id, district, roadClass, crossSection: { roadWidthTiles: width, leftSidewalkTiles: sidewalk, rightSidewalkTiles: sidewalk, centerlineWidthPixels: 2, centerlineDashPixels: 10, centerlineGapPixels: 8 } };
}
function profileId(kind: CityKind, roadClass: "arterial" | "secondary"): RoadProfileId { return `${kind}-${roadClass}` as RoadProfileId; }

function createConnectorEdge(bridge: BridgePlan, sources: readonly CityRoadSource[]): RoadEdge {
  const from = sources.find((source) => source.city.id === bridge.from)!.city;
  const to = sources.find((source) => source.city.id === bridge.to)!.city;
  const horizontal = bridge.axis === "horizontal";
  const start = horizontal ? { x: from.originX, y: bridge.centerY } : { x: bridge.centerX, y: from.originY };
  const end = horizontal ? { x: to.originX + to.widthTiles - 1, y: bridge.centerY } : { x: bridge.centerX, y: to.originY + to.heightTiles - 1 };
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  const bridgeHalf = 7;
  const bridgeStart = Math.max(0, (length / 2 - bridgeHalf) / length);
  const bridgeEnd = Math.min(1, (length / 2 + bridgeHalf) / length);
  return { id: `connector:${bridge.id}`, district: from.kind, roadClass: "connector", centerline: [start, end], profileId: "world-connector", laneMarking: true,
    surfaceSections: [{ start: 0, end: bridgeStart, surface: "asphalt" }, { start: bridgeStart, end: bridgeEnd, surface: "bridge-deck" }, { start: bridgeEnd, end: 1, surface: "asphalt" }] };
}

function createRoadNodes(edges: readonly RoadEdge[]): RoadNode[] {
  const nodes = new Map<string, RoadNode>();
  const add = (x: number, y: number, edgeId: string) => { const key = `${x.toFixed(3)},${y.toFixed(3)}`; const node = nodes.get(key) ?? { id: `road-node:${nodes.size}`, x, y, edgeIds: [] }; if (!node.edgeIds.includes(edgeId)) node.edgeIds.push(edgeId); nodes.set(key, node); };
  for (const edge of edges) { const first = edge.centerline[0]!; const last = edge.centerline.at(-1)!; add(first.x, first.y, edge.id); add(last.x, last.y, edge.id); }
  for (let first = 0; first < edges.length; first += 1) for (let second = first + 1; second < edges.length; second += 1) {
    const a = edges[first]!; const b = edges[second]!;
    for (let ai = 0; ai < a.centerline.length - 1; ai += 1) for (let bi = 0; bi < b.centerline.length - 1; bi += 1) {
      const intersection = segmentIntersection(a.centerline[ai]!, a.centerline[ai + 1]!, b.centerline[bi]!, b.centerline[bi + 1]!);
      if (intersection) { add(intersection.x, intersection.y, a.id); add(intersection.x, intersection.y, b.id); }
    }
  }
  return [...nodes.values()];
}

interface MutableRoadTile extends Omit<RoadRenderTile, "tileX" | "tileY"> { edgeTouches: number; touchedEdgeIds: Set<string> }
interface CachedMask { roadRows: Uint32Array; sidewalkRows: Uint32Array; bridgeRows: Uint32Array; centerlineRows: Uint32Array }

function rasterizeRoadPart(terrain: Uint8Array, width: number, height: number, edge: RoadEdge, startX: number, startY: number, endX: number, endY: number, section: RoadCrossSection, codes: RoadTerrainCodes, tiles: Map<number, MutableRoadTile>, cache: Map<string, CachedMask>): void {
  const outer = section.roadWidthTiles / 2 + Math.max(section.leftSidewalkTiles, section.rightSidewalkTiles);
  const minX = Math.max(0, Math.floor(Math.min(startX, endX) - outer - 1)); const maxX = Math.min(width - 1, Math.ceil(Math.max(startX, endX) + outer + 1));
  const minY = Math.max(0, Math.floor(Math.min(startY, endY) - outer - 1)); const maxY = Math.min(height - 1, Math.ceil(Math.max(startY, endY) + outer + 1));
  const variant = roadVariant(startX, startY, endX, endY);
  for (let tileY = minY; tileY <= maxY; tileY += 1) for (let tileX = minX; tileX <= maxX; tileX += 1) {
    const centerDistance = pointSegmentDistance(tileX + 0.5, tileY + 0.5, startX, startY, endX, endY);
    if (centerDistance > outer + 0.8) continue;
    const index = tileY * width + tileX;
    let tile = tiles.get(index);
    if (!tile) {
      tile = { variant, underlayTerrain: terrain[index]!, roadRows: new Uint32Array(TILE_SIZE), sidewalkRows: new Uint32Array(TILE_SIZE), bridgeRows: new Uint32Array(TILE_SIZE), centerlineRows: new Uint32Array(TILE_SIZE), edgeTouches: 0, touchedEdgeIds: new Set() };
      tiles.set(index, tile);
    }
    if (!tile.touchedEdgeIds.has(edge.id)) { tile.touchedEdgeIds.add(edge.id); tile.edgeTouches += 1; }
    if(edge.surfaceSections.some((candidate)=>candidate.surface==="bridge-deck")){
      const surfaces=new Set([surfaceAt(edge,projectionAmount(tileX,tileY,startX,startY,endX,endY)),surfaceAt(edge,projectionAmount(tileX+1,tileY,startX,startY,endX,endY)),surfaceAt(edge,projectionAmount(tileX,tileY+1,startX,startY,endX,endY)),surfaceAt(edge,projectionAmount(tileX+1,tileY+1,startX,startY,endX,endY))]);
      if(surfaces.size>1)tile.variant="bridge-transition";
    }
    const cacheKey = `${edge.profileId}:${variant}:${edge.laneMarking ? 1 : 0}:${Math.round((tileX-startX)*TILE_SIZE)}:${Math.round((tileY-startY)*TILE_SIZE)}:${Math.round((endX-startX)*TILE_SIZE)}:${Math.round((endY-startY)*TILE_SIZE)}:${surfaceAt(edge, projectionAmount(tileX + 0.5, tileY + 0.5, startX, startY, endX, endY))}`;
    let mask = cache.get(cacheKey);
    if (!mask) { mask = createTileMask(tileX, tileY, edge, startX, startY, endX, endY, section); cache.set(cacheKey, mask); }
    mergeRows(tile.roadRows, mask.roadRows); mergeRows(tile.sidewalkRows, mask.sidewalkRows); mergeRows(tile.bridgeRows, mask.bridgeRows); mergeRows(tile.centerlineRows, mask.centerlineRows);
    const surface = surfaceAt(edge, projectionAmount(tileX + 0.5, tileY + 0.5, startX, startY, endX, endY));
    if (centerDistance <= section.roadWidthTiles / 2) terrain[index] = surface === "bridge-deck" ? codes.bridgeRoad : codes.road;
    else if (terrain[index] !== codes.road && terrain[index] !== codes.bridgeRoad && centerDistance <= outer) terrain[index] = codes.sidewalk;
  }
}

function createTileMask(tileX: number, tileY: number, edge: RoadEdge, startX: number, startY: number, endX: number, endY: number, section: RoadCrossSection): CachedMask {
  if(Math.abs(startY-endY)<.001&&tileX>=Math.min(startX,endX)&&tileX+1<=Math.max(startX,endX))return createHorizontalTileMask(tileX,tileY,edge,startX,startY,endX,section);
  if(Math.abs(startX-endX)<.001&&tileY>=Math.min(startY,endY)&&tileY+1<=Math.max(startY,endY))return createVerticalTileMask(tileX,tileY,edge,startX,startY,endY,section);
  const roadRows = new Uint32Array(TILE_SIZE); const sidewalkRows = new Uint32Array(TILE_SIZE); const bridgeRows = new Uint32Array(TILE_SIZE); const centerlineRows = new Uint32Array(TILE_SIZE);
  const roadHalf = section.roadWidthTiles / 2; const sidewalkOuter = roadHalf + Math.max(section.leftSidewalkTiles, section.rightSidewalkTiles);
  const centerlineHalf = section.centerlineWidthPixels / (2 * TILE_SIZE); const dashPeriod = section.centerlineDashPixels + section.centerlineGapPixels;
  const lengthPixels = Math.hypot(endX - startX, endY - startY) * TILE_SIZE;
  const centerX=tileX+.5,centerY=tileY+.5,centerDistance=pointSegmentDistance(centerX,centerY,startX,startY,endX,endY),pixelRadius=Math.SQRT1_2;
  const centerAmount=projectionAmount(centerX,centerY,startX,startY,endX,endY),centerSurface=surfaceAt(edge,centerAmount);
  const cornerSurfaces=[surfaceAt(edge,projectionAmount(tileX,tileY,startX,startY,endX,endY)),surfaceAt(edge,projectionAmount(tileX+1,tileY,startX,startY,endX,endY)),surfaceAt(edge,projectionAmount(tileX,tileY+1,startX,startY,endX,endY)),surfaceAt(edge,projectionAmount(tileX+1,tileY+1,startX,startY,endX,endY))];
  const uniformSurface=cornerSurfaces.every((surface)=>surface===centerSurface);
  if(centerDistance+pixelRadius<=roadHalf&&uniformSurface&&(!edge.laneMarking||centerDistance-pixelRadius>centerlineHalf)){
    roadRows.fill(0xffffff);if(centerSurface==="bridge-deck")bridgeRows.fill(0xffffff);return{roadRows,sidewalkRows,bridgeRows,centerlineRows};
  }
  if(centerDistance-pixelRadius>=roadHalf&&centerDistance+pixelRadius<=sidewalkOuter){sidewalkRows.fill(0xffffff);return{roadRows,sidewalkRows,bridgeRows,centerlineRows};}
  for (let py = 0; py < TILE_SIZE; py += 1) for (let px = 0; px < TILE_SIZE; px += 1) {
    const x = tileX + (px + 0.5) / TILE_SIZE; const y = tileY + (py + 0.5) / TILE_SIZE;
    const amount = projectionAmount(x, y, startX, startY, endX, endY); const distance = pointSegmentDistance(x, y, startX, startY, endX, endY); const bit = 1 << px;
    if (distance <= roadHalf) {
      roadRows[py] |= bit;
      if (surfaceAt(edge, amount) === "bridge-deck") bridgeRows[py] |= bit;
      if (edge.laneMarking && distance <= centerlineHalf && (Math.floor(amount * lengthPixels) % dashPeriod) < section.centerlineDashPixels) centerlineRows[py] |= bit;
    } else if (distance <= sidewalkOuter) sidewalkRows[py] |= bit;
  }
  return { roadRows, sidewalkRows, bridgeRows, centerlineRows };
}

function createHorizontalTileMask(tileX:number,tileY:number,edge:RoadEdge,startX:number,lineY:number,endX:number,section:RoadCrossSection):CachedMask{
  const roadRows=new Uint32Array(TILE_SIZE),sidewalkRows=new Uint32Array(TILE_SIZE),bridgeRows=new Uint32Array(TILE_SIZE),centerlineRows=new Uint32Array(TILE_SIZE),roadHalf=section.roadWidthTiles/2,outer=roadHalf+Math.max(section.leftSidewalkTiles,section.rightSidewalkTiles),centerHalf=section.centerlineWidthPixels/(2*TILE_SIZE),lengthPixels=Math.abs(endX-startX)*TILE_SIZE,period=section.centerlineDashPixels+section.centerlineGapPixels,hasBridge=edge.surfaceSections.some((candidate)=>candidate.surface==="bridge-deck");
  for(let py=0;py<TILE_SIZE;py+=1){const distance=Math.abs(tileY+(py+.5)/TILE_SIZE-lineY);if(distance<=roadHalf){roadRows[py]=0xffffff;if(hasBridge||edge.laneMarking&&distance<=centerHalf)for(let px=0;px<TILE_SIZE;px+=1){const x=tileX+(px+.5)/TILE_SIZE,amount=projectionAmount(x,lineY,startX,lineY,endX,lineY),bit=1<<px;if(hasBridge&&surfaceAt(edge,amount)==="bridge-deck")bridgeRows[py]|=bit;if(edge.laneMarking&&distance<=centerHalf&&(Math.floor(amount*lengthPixels)%period)<section.centerlineDashPixels)centerlineRows[py]|=bit;}}else if(distance<=outer)sidewalkRows[py]=0xffffff;}
  return{roadRows,sidewalkRows,bridgeRows,centerlineRows};
}
function createVerticalTileMask(tileX:number,tileY:number,edge:RoadEdge,lineX:number,startY:number,endY:number,section:RoadCrossSection):CachedMask{
  const roadRows=new Uint32Array(TILE_SIZE),sidewalkRows=new Uint32Array(TILE_SIZE),bridgeRows=new Uint32Array(TILE_SIZE),centerlineRows=new Uint32Array(TILE_SIZE),roadHalf=section.roadWidthTiles/2,outer=roadHalf+Math.max(section.leftSidewalkTiles,section.rightSidewalkTiles),centerHalf=section.centerlineWidthPixels/(2*TILE_SIZE),lengthPixels=Math.abs(endY-startY)*TILE_SIZE,period=section.centerlineDashPixels+section.centerlineGapPixels,hasBridge=edge.surfaceSections.some((candidate)=>candidate.surface==="bridge-deck");let roadBits=0,sidewalkBits=0,centerBits=0;
  for(let px=0;px<TILE_SIZE;px+=1){const distance=Math.abs(tileX+(px+.5)/TILE_SIZE-lineX),bit=1<<px;if(distance<=roadHalf){roadBits|=bit;if(distance<=centerHalf)centerBits|=bit;}else if(distance<=outer)sidewalkBits|=bit;}
  for(let py=0;py<TILE_SIZE;py+=1){roadRows[py]=roadBits;sidewalkRows[py]=sidewalkBits;if(roadBits===0)continue;const y=tileY+(py+.5)/TILE_SIZE,amount=projectionAmount(lineX,y,lineX,startY,lineX,endY);if(hasBridge&&surfaceAt(edge,amount)==="bridge-deck")bridgeRows[py]=roadBits;if(edge.laneMarking&&centerBits!==0&&(Math.floor(amount*lengthPixels)%period)<section.centerlineDashPixels)centerlineRows[py]=centerBits;}
  return{roadRows,sidewalkRows,bridgeRows,centerlineRows};
}

function appendCorridors(target: ReservedWorldCorridors, edge: RoadEdge, ax: number, ay: number, bx: number, by: number, section: RoadCrossSection): void {
  const roadHalf = section.roadWidthTiles / 2;
  target.roadSurface.push({ edgeId: edge.id, points: segmentStrip(ax, ay, bx, by, -roadHalf, roadHalf) });
  target.sidewalks.push({ edgeId: edge.id, points: segmentStrip(ax, ay, bx, by, roadHalf, roadHalf + section.leftSidewalkTiles) });
  target.sidewalks.push({ edgeId: edge.id, points: segmentStrip(ax, ay, bx, by, -roadHalf - section.rightSidewalkTiles, -roadHalf) });
  if (edge.surfaceSections.some((candidate) => candidate.surface === "bridge-deck")) {
    const bridge = edge.surfaceSections.find((candidate) => candidate.surface === "bridge-deck")!;
    const dx = bx - ax; const dy = by - ay; const approach = 8 / Math.max(1, Math.hypot(dx, dy));
    const start = Math.max(0, bridge.start - approach); const end = Math.min(1, bridge.end + approach);
    target.bridgeApproaches.push({ edgeId: edge.id, points: segmentStrip(ax + dx * start, ay + dy * start, ax + dx * end, ay + dy * end, -roadHalf - section.rightSidewalkTiles, roadHalf + section.leftSidewalkTiles) });
  }
}

function surfaceAt(edge: RoadEdge, amount: number): RoadSurface { return edge.surfaceSections.find((section) => amount >= section.start && amount <= section.end)?.surface ?? "asphalt"; }
function projectToEdge(x: number, y: number, edge: RoadEdge): { x: number; y: number } { const start = edge.centerline[0]!; const end = edge.centerline.at(-1)!; const amount = projectionAmount(x, y, start.x, start.y, end.x, end.y); return { x: start.x + (end.x - start.x) * amount, y: start.y + (end.y - start.y) * amount }; }
function projectionAmount(px: number, py: number, ax: number, ay: number, bx: number, by: number): number { const dx = bx - ax; const dy = by - ay; const length = dx * dx + dy * dy; return length === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length)); }
function pointSegmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number): number { const amount = projectionAmount(px, py, ax, ay, bx, by); return Math.hypot(px - (ax + (bx - ax) * amount), py - (ay + (by - ay) * amount)); }
function segmentDistance(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): number { if (segmentIntersection({ x: ax, y: ay }, { x: bx, y: by }, { x: cx, y: cy }, { x: dx, y: dy })) return 0; return Math.min(pointSegmentDistance(ax, ay, cx, cy, dx, dy), pointSegmentDistance(bx, by, cx, cy, dx, dy), pointSegmentDistance(cx, cy, ax, ay, bx, by), pointSegmentDistance(dx, dy, ax, ay, bx, by)); }
function segmentIntersection(a: {x:number;y:number}, b: {x:number;y:number}, c: {x:number;y:number}, d: {x:number;y:number}): {x:number;y:number} | undefined { const denominator = (a.x-b.x)*(c.y-d.y)-(a.y-b.y)*(c.x-d.x); if (Math.abs(denominator)<1e-8)return undefined; const crossA=a.x*b.y-a.y*b.x,crossC=c.x*d.y-c.y*d.x; const x=(crossA*(c.x-d.x)-(a.x-b.x)*crossC)/denominator,y=(crossA*(c.y-d.y)-(a.y-b.y)*crossC)/denominator; const within=(value:number,first:number,second:number)=>value>=Math.min(first,second)-1e-6&&value<=Math.max(first,second)+1e-6; return within(x,a.x,b.x)&&within(y,a.y,b.y)&&within(x,c.x,d.x)&&within(y,c.y,d.y)?{x,y}:undefined; }
function segmentStrip(ax: number, ay: number, bx: number, by: number, left: number, right: number): RoadPoint[] { const length = Math.hypot(bx-ax,by-ay)||1,nx=-(by-ay)/length,ny=(bx-ax)/length; return [{x:ax+nx*left,y:ay+ny*left},{x:bx+nx*left,y:by+ny*left},{x:bx+nx*right,y:by+ny*right},{x:ax+nx*right,y:ay+ny*right}]; }
function circlePolygon(x:number,y:number,radius:number,steps:number):WorldPolygon{return{points:Array.from({length:steps},(_,index)=>{const angle=index/steps*Math.PI*2;return{x:x+Math.cos(angle)*radius,y:y+Math.sin(angle)*radius};})};}
function mergeRows(target:Uint32Array,source:Uint32Array):void{for(let row=0;row<target.length;row+=1)target[row]|=source[row]!;}
function footprintCorners(building:BuildingDefinition):Array<{x:number;y:number}>{const xs=building.footprintTiles.map((index)=>index%282),ys=building.footprintTiles.map((index)=>Math.floor(index/282));if(xs.length===0)return[{x:building.centerTileX,y:building.centerTileY}];return[{x:Math.min(...xs),y:Math.min(...ys)},{x:Math.max(...xs)+1,y:Math.min(...ys)},{x:Math.max(...xs)+1,y:Math.max(...ys)+1},{x:Math.min(...xs),y:Math.max(...ys)+1}];}
function convexHull(points:readonly {x:number;y:number}[]):Array<{x:number;y:number}>{const unique=[...new Map(points.map((point)=>[`${point.x},${point.y}`,point])).values()].sort((a,b)=>a.x-b.x||a.y-b.y);if(unique.length<=2)return unique;const cross=(o:{x:number;y:number},a:{x:number;y:number},b:{x:number;y:number})=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x),lower:{x:number;y:number}[]=[],upper:{x:number;y:number}[]=[];for(const point of unique){while(lower.length>=2&&cross(lower.at(-2)!,lower.at(-1)!,point)<=0)lower.pop();lower.push(point);}for(let index=unique.length-1;index>=0;index-=1){const point=unique[index]!;while(upper.length>=2&&cross(upper.at(-2)!,upper.at(-1)!,point)<=0)upper.pop();upper.push(point);}lower.pop();upper.pop();return[...lower,...upper];}
