import { BUILDABLE_DEFINITIONS, type BuildableKind } from "../data/buildable-definitions";
import { TILE_SIZE } from "../config/game-config";

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

export function getPlacedStructureCenter(state: Pick<PlacedStructureState, "kind" | "tileX" | "tileY">): { x: number; y: number } {
  const footprint = BUILDABLE_DEFINITIONS[state.kind].footprint;
  return { x: (state.tileX + footprint.width / 2) * TILE_SIZE, y: (state.tileY + footprint.height / 2) * TILE_SIZE };
}
