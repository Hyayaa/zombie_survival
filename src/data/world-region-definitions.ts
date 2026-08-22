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

export interface CityGenerationProfile {
  kind: CityKind;
  zombieDensityMultiplier: number;
  poiKinds: readonly string[];
  lootBias: readonly string[];
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
  mixed: { kind: "mixed", zombieDensityMultiplier: 1, poiKinds: ["safehouse", "clinic", "store", "warehouse"], lootBias: ["food", "medicine", "tools"] },
  military: { kind: "military", zombieDensityMultiplier: 1.2, poiKinds: ["checkpoint", "barracks", "armory", "vehicle-maintenance", "command", "infirmary", "training-supply"], lootBias: ["ammo", "weapons", "medicine"] },
  industrial: { kind: "industrial", zombieDensityMultiplier: 1.1, poiKinds: ["steelworks", "factory", "warehouse", "scrapyard", "power-substation", "machine-maintenance"], lootBias: ["materials", "tools", "fuel"] },
  commercial: { kind: "commercial", zombieDensityMultiplier: 1.2, poiKinds: ["department-store", "it-office", "electronics-store", "shopping-complex", "parking", "convenience-food"], lootBias: ["electronics", "food", "clothing"] },
};
