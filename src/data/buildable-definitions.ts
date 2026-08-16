export type BuildableKind = "turret" | "solar-generator" | "fuel-generator" | "battery-bank";

export interface BuildableDefinition {
  kind: BuildableKind;
  name: string;
  kitItemId: string;
  blocksVision: boolean;
}

export const BUILDABLE_DEFINITIONS: Record<BuildableKind, BuildableDefinition> = {
  turret: { kind: "turret", name: "터렛", kitItemId: "turret_kit", blocksVision: false },
  "solar-generator": { kind: "solar-generator", name: "태양광 발전기", kitItemId: "solar_generator_kit", blocksVision: false },
  "fuel-generator": { kind: "fuel-generator", name: "연료 발전기", kitItemId: "fuel_generator_kit", blocksVision: false },
  "battery-bank": { kind: "battery-bank", name: "축전지", kitItemId: "battery_bank_kit", blocksVision: false },
};

export const BUILDABLE_ITEM_KIND: Readonly<Record<string, BuildableKind>> = Object.freeze(
  Object.fromEntries(Object.values(BUILDABLE_DEFINITIONS).map((definition) => [definition.kitItemId, definition.kind])),
);
