import type { CraftingStationKind } from "./recipe-definitions";

export type BuildableKind = "turret" | "solar-generator" | "fuel-generator" | "battery-bank" | "makeshift_workbench" | "plank_workbench" | "technical_workbench";

export interface BuildableDefinition {
  kind: BuildableKind;
  name: string;
  kitItemId: string;
  blocksVision: boolean;
  blocksMovement: boolean;
  blocksProjectiles: boolean;
  footprint: { width: number; height: number };
  craftingStationKind?: Exclude<CraftingStationKind, "hand">;
}

export const BUILDABLE_DEFINITIONS: Record<BuildableKind, BuildableDefinition> = {
  turret: { kind: "turret", name: "터렛", kitItemId: "turret_kit", blocksMovement: true, blocksVision: false, blocksProjectiles: true, footprint: { width: 1, height: 1 } },
  "solar-generator": { kind: "solar-generator", name: "태양광 발전기", kitItemId: "solar_generator_kit", blocksMovement: true, blocksVision: false, blocksProjectiles: true, footprint: { width: 1, height: 1 } },
  "fuel-generator": { kind: "fuel-generator", name: "연료 발전기", kitItemId: "fuel_generator_kit", blocksMovement: true, blocksVision: false, blocksProjectiles: true, footprint: { width: 1, height: 1 } },
  "battery-bank": { kind: "battery-bank", name: "축전지", kitItemId: "battery_bank_kit", blocksMovement: true, blocksVision: false, blocksProjectiles: true, footprint: { width: 1, height: 1 } },
  makeshift_workbench: { kind: "makeshift_workbench", name: "간이 제작대", kitItemId: "makeshift_workbench_kit", blocksMovement: true, blocksVision: false, blocksProjectiles: false, footprint: { width: 2, height: 2 }, craftingStationKind: "makeshift" },
  plank_workbench: { kind: "plank_workbench", name: "판자 제작대", kitItemId: "plank_workbench_kit", blocksMovement: true, blocksVision: false, blocksProjectiles: false, footprint: { width: 2, height: 2 }, craftingStationKind: "plank" },
  technical_workbench: { kind: "technical_workbench", name: "기술 제작대", kitItemId: "technical_workbench_kit", blocksMovement: true, blocksVision: false, blocksProjectiles: false, footprint: { width: 3, height: 2 }, craftingStationKind: "technical" },
};

export const BUILDABLE_ITEM_KIND: Readonly<Record<string, BuildableKind>> = Object.freeze(
  Object.fromEntries(Object.values(BUILDABLE_DEFINITIONS).map((definition) => [definition.kitItemId, definition.kind])),
);
