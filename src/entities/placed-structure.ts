import type { BuildableKind } from "../data/buildable-definitions";

export interface PlacedStructureState {
  id: string;
  kind: BuildableKind;
  tileX: number;
  tileY: number;
  storedEnergy: number;
  fuelSeconds?: number;
  powered: boolean;
  aimAngle?: number;
}

export interface SavedStructureState extends Omit<PlacedStructureState, "powered"> {}

export function createPlacedStructure(id: string, kind: BuildableKind, tileX: number, tileY: number): PlacedStructureState {
  return { id, kind, tileX, tileY, storedEnergy: 0, fuelSeconds: kind === "fuel-generator" ? 0 : undefined, powered: false, aimAngle: kind === "turret" ? 0 : undefined };
}
