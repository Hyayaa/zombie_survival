import type { CraftingStationKind } from "./recipe-definitions";

export type BuildableKind =
  | "barricade" | "wood-wall" | "metal-wall" | "wood-door" | "wood-crate"
  | "turret" | "solar-generator" | "fuel-generator" | "battery-bank"
  | "makeshift_workbench" | "plank_workbench" | "technical_workbench";
export type BuildableCategory = "defense" | "storage" | "power" | "production";
export type BuildablePlacementClass = "structure" | "furniture";
export type StructureMaterial = "wood" | "metal" | "machine";
export type BuildCost = { kind: "materials"; items: readonly { itemId: string; quantity: number }[] } | { kind: "kit"; itemId: string; quantity: number };

export interface BuildableDefinition {
  kind: BuildableKind; name: string; category: BuildableCategory; placementClass: BuildablePlacementClass; placementKind: "segment" | "footprint"; cost: BuildCost;
  maximumHealth: number; material: StructureMaterial; blocksVision: boolean; blocksMovement: boolean; blocksProjectiles: boolean;
  interactionRange: number; iconItemId?: string; segment?: { length: number; thickness: number; supportsDiagonal: boolean };
  /** Legacy UI/test compatibility; kit cost remains the source of truth. */ kitItemId?: string;
  footprint?: { width: number; height: number }; furnitureSize?: { width: number; height: number }; storage?: { width: number; height: number };
  craftingStationKind?: Exclude<CraftingStationKind, "hand">;
}

const kit = (itemId: string): BuildCost => ({ kind: "kit", itemId, quantity: 1 });
const materials = (...items: Array<{ itemId: string; quantity: number }>): BuildCost => ({ kind: "materials", items });
const footprint = (width: number, height: number): { width: number; height: number } => ({ width, height });

export const BUILDABLE_DEFINITIONS: Record<BuildableKind, BuildableDefinition> = {
  barricade: { kind: "barricade", name: "간이 바리케이드", category: "defense", placementClass: "furniture", placementKind: "footprint", cost: kit("barricade"), kitItemId: "barricade", maximumHealth: 96, material: "wood", blocksMovement: true, blocksVision: false, blocksProjectiles: true, interactionRange: 34, iconItemId: "barricade", footprint: footprint(1, 1), furnitureSize: { width: 20, height: 10 } },
  "wood-wall": { kind: "wood-wall", name: "목재 벽", category: "defense", placementClass: "structure", placementKind: "segment", cost: materials({ itemId: "wood", quantity: 4 }, { itemId: "screws", quantity: 2 }), maximumHealth: 240, material: "wood", blocksMovement: true, blocksVision: true, blocksProjectiles: true, interactionRange: 42, segment: { length: 24, thickness: 5, supportsDiagonal: true } },
  "metal-wall": { kind: "metal-wall", name: "금속 벽", category: "defense", placementClass: "structure", placementKind: "segment", cost: materials({ itemId: "steel_plate", quantity: 2 }, { itemId: "screws", quantity: 4 }), maximumHealth: 600, material: "metal", blocksMovement: true, blocksVision: true, blocksProjectiles: true, interactionRange: 42, segment: { length: 24, thickness: 6, supportsDiagonal: true } },
  "wood-door": { kind: "wood-door", name: "목재 문", category: "defense", placementClass: "structure", placementKind: "segment", cost: materials({ itemId: "wood", quantity: 5 }, { itemId: "screws", quantity: 3 }, { itemId: "duct_tape", quantity: 1 }), maximumHealth: 190, material: "wood", blocksMovement: true, blocksVision: true, blocksProjectiles: true, interactionRange: 42, segment: { length: 24, thickness: 5, supportsDiagonal: true } },
  "wood-crate": { kind: "wood-crate", name: "목재 보관함", category: "storage", placementClass: "furniture", placementKind: "footprint", cost: materials({ itemId: "wood", quantity: 6 }, { itemId: "screws", quantity: 4 }), maximumHealth: 180, material: "wood", blocksMovement: true, blocksVision: false, blocksProjectiles: true, interactionRange: 42, footprint: footprint(1, 1), furnitureSize: { width: 18, height: 16 }, storage: { width: 8, height: 6 } },
  turret: { kind: "turret", name: "터렛", category: "defense", placementClass: "furniture", placementKind: "footprint", cost: kit("turret_kit"), kitItemId: "turret_kit", maximumHealth: 320, material: "machine", blocksMovement: true, blocksVision: false, blocksProjectiles: true, interactionRange: 34, iconItemId: "turret_kit", footprint: footprint(1, 1), furnitureSize: { width: 18, height: 18 } },
  "solar-generator": { kind: "solar-generator", name: "태양광 발전기", category: "power", placementClass: "furniture", placementKind: "footprint", cost: kit("solar_generator_kit"), kitItemId: "solar_generator_kit", maximumHealth: 280, material: "machine", blocksMovement: true, blocksVision: false, blocksProjectiles: true, interactionRange: 34, iconItemId: "solar_generator_kit", footprint: footprint(1, 1), furnitureSize: { width: 22, height: 16 } },
  "fuel-generator": { kind: "fuel-generator", name: "연료 발전기", category: "power", placementClass: "furniture", placementKind: "footprint", cost: kit("fuel_generator_kit"), kitItemId: "fuel_generator_kit", maximumHealth: 360, material: "machine", blocksMovement: true, blocksVision: false, blocksProjectiles: true, interactionRange: 34, iconItemId: "fuel_generator_kit", footprint: footprint(1, 1), furnitureSize: { width: 20, height: 18 } },
  "battery-bank": { kind: "battery-bank", name: "축전지", category: "power", placementClass: "furniture", placementKind: "footprint", cost: kit("battery_bank_kit"), kitItemId: "battery_bank_kit", maximumHealth: 300, material: "machine", blocksMovement: true, blocksVision: false, blocksProjectiles: true, interactionRange: 34, iconItemId: "battery_bank_kit", footprint: footprint(1, 1), furnitureSize: { width: 18, height: 20 } },
  makeshift_workbench: { kind: "makeshift_workbench", name: "간이 제작대", category: "production", placementClass: "furniture", placementKind: "footprint", cost: kit("makeshift_workbench_kit"), kitItemId: "makeshift_workbench_kit", maximumHealth: 260, material: "wood", blocksMovement: true, blocksVision: false, blocksProjectiles: false, interactionRange: 72, iconItemId: "makeshift_workbench_kit", footprint: footprint(2, 2), furnitureSize: { width: 42, height: 30 }, craftingStationKind: "makeshift" },
  plank_workbench: { kind: "plank_workbench", name: "판자 제작대", category: "production", placementClass: "furniture", placementKind: "footprint", cost: kit("plank_workbench_kit"), kitItemId: "plank_workbench_kit", maximumHealth: 340, material: "wood", blocksMovement: true, blocksVision: false, blocksProjectiles: false, interactionRange: 72, iconItemId: "plank_workbench_kit", footprint: footprint(2, 2), furnitureSize: { width: 44, height: 30 }, craftingStationKind: "plank" },
  technical_workbench: { kind: "technical_workbench", name: "기술 제작대", category: "production", placementClass: "furniture", placementKind: "footprint", cost: kit("technical_workbench_kit"), kitItemId: "technical_workbench_kit", maximumHealth: 460, material: "machine", blocksMovement: true, blocksVision: false, blocksProjectiles: false, interactionRange: 72, iconItemId: "technical_workbench_kit", footprint: footprint(3, 2), furnitureSize: { width: 64, height: 34 }, craftingStationKind: "technical" },
};

export const BUILDABLE_ITEM_KIND: Readonly<Record<string, BuildableKind>> = Object.freeze(Object.fromEntries(
  Object.values(BUILDABLE_DEFINITIONS).filter((definition) => definition.cost.kind === "kit").map((definition) => [(definition.cost as Extract<BuildCost, { kind: "kit" }>).itemId, definition.kind]),
));

export function getBuildCostItems(definition: BuildableDefinition): readonly { itemId: string; quantity: number }[] {
  return definition.cost.kind === "materials" ? definition.cost.items : [{ itemId: definition.cost.itemId, quantity: definition.cost.quantity }];
}

export function getRotatedStructureFootprint(kind: BuildableKind, rotation: number): { width: number; height: number } {
  const footprint = BUILDABLE_DEFINITIONS[kind].footprint!;
  return Math.abs(rotation) % 2 === 1 ? { width: footprint.height, height: footprint.width } : { ...footprint };
}
