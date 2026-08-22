export const CITY_REGION_WIDTH = 128;
export const CITY_REGION_HEIGHT = 128;
export const RIVER_WIDTH_TILES = 10;
export const RIVER_BANK_WIDTH_TILES = 2;
export const WORLD_OUTER_MARGIN_TILES = 6;
export const CITY_GAP_TILES = RIVER_BANK_WIDTH_TILES * 2 + RIVER_WIDTH_TILES;
export const MULTI_CITY_WIDTH_TILES = CITY_REGION_WIDTH * 2 + CITY_GAP_TILES + WORLD_OUTER_MARGIN_TILES * 2;
export const MULTI_CITY_HEIGHT_TILES = CITY_REGION_HEIGHT * 2 + CITY_GAP_TILES + WORLD_OUTER_MARGIN_TILES * 2;

export type CityKind = "mixed" | "military" | "industrial" | "commercial";
export type CityRegionId = "mixed-nw" | "military-ne" | "industrial-sw" | "commercial-se";

export interface BuildingSizeRange { minWidth: number; maxWidth: number; minDepth: number; maxDepth: number }
export interface BuildingGenerationProfile {
  district: CityKind;
  ordinary: BuildingSizeRange;
  landmark?: BuildingSizeRange;
  setbackTiles: readonly [number, number];
  placementRetries: number;
  maximumDoors: 4;
}
export interface DistrictPropProfile { district: CityKind; outdoorKinds: readonly string[]; interiorKinds: readonly string[] }

export interface CityGenerationProfile {
  kind: CityKind;
  zombieDensityMultiplier: number;
  poiKinds: readonly string[];
  lootBias: readonly string[];
  buildings: BuildingGenerationProfile;
}

export interface CityRegionPlan {
  id: CityRegionId;
  kind: CityKind;
  originX: number;
  originY: number;
  widthTiles: number;
  heightTiles: number;
  seed: number;
  profile: CityGenerationProfile;
}

export interface BridgePlan { id: string; from: CityRegionId; to: CityRegionId; axis: "horizontal" | "vertical"; centerX: number; centerY: number; widthTiles: number; approachLengthTiles: number }
export interface TransitNode { id: string; tileX: number; tileY: number; regionId?: CityRegionId }
export interface TransitEdge { from: string; to: string; cost: number }
export interface WorldMacroPlan { widthTiles: number; heightTiles: number; cities: CityRegionPlan[]; bridges: BridgePlan[]; transitNodes: TransitNode[]; transitEdges: TransitEdge[] }

export const CITY_PROFILES: Record<CityKind, CityGenerationProfile> = {
  mixed: { kind: "mixed", zombieDensityMultiplier: 1, poiKinds: ["safehouse", "clinic", "store", "warehouse"], lootBias: ["food", "medicine", "tools"], buildings:{district:"mixed",ordinary:{minWidth:6,maxWidth:14,minDepth:5,maxDepth:11},setbackTiles:[.5,1],placementRetries:10,maximumDoors:4} },
  military: { kind: "military", zombieDensityMultiplier: 1.2, poiKinds: ["checkpoint", "barracks", "armory", "vehicle-maintenance", "command", "infirmary", "training-supply"], lootBias: ["ammo", "weapons", "medicine"], buildings:{district:"military",ordinary:{minWidth:12,maxWidth:24,minDepth:10,maxDepth:20},landmark:{minWidth:40,maxWidth:64,minDepth:40,maxDepth:64},setbackTiles:[1,3],placementRetries:12,maximumDoors:4} },
  industrial: { kind: "industrial", zombieDensityMultiplier: 1.1, poiKinds: ["steelworks", "factory", "warehouse", "scrapyard", "power-substation", "machine-maintenance"], lootBias: ["materials", "tools", "fuel"], buildings:{district:"industrial",ordinary:{minWidth:16,maxWidth:32,minDepth:12,maxDepth:26},landmark:{minWidth:32,maxWidth:52,minDepth:24,maxDepth:40},setbackTiles:[1,3],placementRetries:12,maximumDoors:4} },
  commercial: { kind: "commercial", zombieDensityMultiplier: 1.2, poiKinds: ["department-store", "it-office", "electronics-store", "shopping-complex", "parking", "convenience-food"], lootBias: ["electronics", "food", "clothing"], buildings:{district:"commercial",ordinary:{minWidth:10,maxWidth:22,minDepth:8,maxDepth:18},landmark:{minWidth:24,maxWidth:38,minDepth:16,maxDepth:30},setbackTiles:[0,.5],placementRetries:10,maximumDoors:4} },
};
