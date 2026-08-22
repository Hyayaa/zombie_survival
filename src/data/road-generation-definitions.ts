import type { SegmentGeometry } from "../systems/collision-geometry";
import type { CityKind, CityRegionId } from "./world-region-definitions";

export type RoadProfileId =
  | "mixed-arterial" | "mixed-secondary"
  | "military-arterial" | "military-secondary"
  | "industrial-arterial" | "industrial-secondary"
  | "commercial-arterial" | "commercial-secondary"
  | "world-connector";
export type RoadSurface = "asphalt" | "bridge-deck";
export type RoadTileVariant =
  | "road-horizontal" | "road-vertical"
  | "road-diagonal-ne" | "road-diagonal-nw"
  | "road-transition" | "road-intersection" | "bridge-transition";

export interface RoadPoint { x: number; y: number }
export interface WorldPolygon { points: RoadPoint[] }
export interface RoadSurfaceSection { start: number; end: number; surface: RoadSurface }
export interface RoadNode { id: string; x: number; y: number; edgeIds: string[] }
export interface RoadEdge {
  id: string;
  district: CityKind;
  regionId?: CityRegionId;
  roadClass: "arterial" | "secondary" | "connector";
  centerline: RoadPoint[];
  profileId: RoadProfileId;
  laneMarking: boolean;
  surfaceSections: RoadSurfaceSection[];
}
export interface RoadGraph { nodes: RoadNode[]; edges: RoadEdge[] }

export interface RoadCrossSection {
  roadWidthTiles: number;
  leftSidewalkTiles: number;
  rightSidewalkTiles: number;
  centerlineWidthPixels: number;
  centerlineDashPixels: number;
  centerlineGapPixels: number;
}
export interface RoadProfile {
  id: RoadProfileId;
  district: CityKind | "world";
  roadClass: "arterial" | "secondary" | "connector";
  crossSection: RoadCrossSection;
}

export interface CorridorPolygon extends WorldPolygon { edgeId: string }
export interface ReservedWorldCorridors {
  roadSurface: CorridorPolygon[];
  sidewalks: CorridorPolygon[];
  bridgeApproaches: CorridorPolygon[];
  riverBanks: WorldPolygon[];
  intersections: WorldPolygon[];
}

export interface RoadRenderTile {
  tileX: number;
  tileY: number;
  variant: RoadTileVariant;
  underlayTerrain: number;
  roadRows: Uint32Array;
  sidewalkRows: Uint32Array;
  bridgeRows: Uint32Array;
  centerlineRows: Uint32Array;
}
export interface RoadRenderData {
  tileSize: number;
  chunkTiles: number;
  maskCacheEntries: number;
  tiles: RoadRenderTile[];
}

export interface BuildingLot {
  id: string;
  buildingId: string;
  regionId: CityRegionId;
  roadEdgeId: string;
  frontage: SegmentGeometry;
  polygon: WorldPolygon;
  setbackTiles: number;
}
export interface BuildingEnvelope {
  buildingId: string;
  polygon: WorldPolygon;
  wallCapsules: SegmentGeometry[];
  wallThicknessPixels: number;
  clearanceTiles: number;
}
export interface DoorAccessPlan {
  id: string;
  buildingId: string;
  doorId: string;
  roadEdgeId: string;
  path: SegmentGeometry;
  clearanceTiles: number;
}

export type DistrictPropPlacement = "static-decoration" | "static-obstacle" | "interactive-furniture";
export interface DistrictPropDefinition {
  id: string;
  regionId: CityRegionId;
  district: CityKind;
  kind: string;
  placement: DistrictPropPlacement;
  tileX: number;
  tileY: number;
  rotation: 0 | 90 | 180 | 270;
  interiorBuildingId?: string;
}
