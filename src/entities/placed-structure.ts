import { BUILDABLE_DEFINITIONS, getRotatedStructureFootprint, type BuildableKind } from "../data/buildable-definitions";
import { TILE_SIZE } from "../config/game-config";
import type { WorldStorageSnapshot } from "../systems/world-storage-container";

export type StructurePlacement =
  | { kind: "segment"; startX: number; startY: number; endX: number; endY: number; hingeSide?: -1 | 1 }
  | { kind: "furniture"; x: number; y: number; angle: number }
  | { kind: "footprint"; tileX: number; tileY: number; rotation: number };
export type StructureSource="generated"|"player-built";
export type StructureOwnership="world"|"player";

export interface PlacedStructureState {
  id: string; kind: BuildableKind; tileX: number; tileY: number; placement: StructurePlacement;
  source:StructureSource;ownership:StructureOwnership;
  health: number; maximumHealth: number; createdOrder: number;
  storedEnergy: number; fuelSeconds?: number; powered: boolean; aimAngle?: number; doorOpen?: boolean;
  storage?: WorldStorageSnapshot;
}

export type SavedStructureState = Omit<PlacedStructureState, "powered" | "placement" | "health" | "maximumHealth" | "createdOrder"|"source"|"ownership"> & {
  placement?: StructurePlacement; health?: number; maximumHealth?: number; createdOrder?: number;source?:StructureSource;ownership?:StructureOwnership;
};

export function createPlacedStructure(id: string, kind: BuildableKind, tileX: number, tileY: number, rotation = 0, createdOrder = 0): PlacedStructureState {
  const definition = BUILDABLE_DEFINITIONS[kind];
  if (definition.placementKind !== "footprint") throw new Error(`${kind} requires segment placement`);
  return { id, kind, tileX, tileY, placement: { kind: "footprint", tileX, tileY, rotation },source:"player-built",ownership:"player", health: definition.maximumHealth, maximumHealth: definition.maximumHealth, createdOrder, storedEnergy: 0, fuelSeconds: kind === "fuel-generator" ? 0 : undefined, powered: false, aimAngle: kind === "turret" ? 0 : undefined };
}

export function createPlacedFurniture(id: string, kind: BuildableKind, x: number, y: number, angle = 0, createdOrder = 0): PlacedStructureState {
  const definition = BUILDABLE_DEFINITIONS[kind];
  if (definition.placementClass !== "furniture") throw new Error(`${kind} is not furniture`);
  return { id, kind, tileX: Math.floor(x / TILE_SIZE), tileY: Math.floor(y / TILE_SIZE), placement: { kind: "furniture", x, y, angle },source:"player-built",ownership:"player", health: definition.maximumHealth, maximumHealth: definition.maximumHealth, createdOrder, storedEnergy: 0, fuelSeconds: kind === "fuel-generator" ? 0 : undefined, powered: false, aimAngle: kind === "turret" ? 0 : undefined };
}

export function createPlacedSegment(id: string, kind: "wood-wall" | "metal-wall" | "wood-door", startX: number, startY: number, endX: number, endY: number, createdOrder = 0, hingeSide: -1 | 1 = 1): PlacedStructureState {
  const definition = BUILDABLE_DEFINITIONS[kind];
  return { id, kind, tileX: Math.floor(Math.min(startX, endX) / TILE_SIZE), tileY: Math.floor(Math.min(startY, endY) / TILE_SIZE), placement: { kind: "segment", startX, startY, endX, endY, hingeSide: kind === "wood-door" ? hingeSide : undefined },source:"player-built",ownership:"player", health: definition.maximumHealth, maximumHealth: definition.maximumHealth, createdOrder, storedEnergy: 0, powered: false, doorOpen: kind === "wood-door" ? false : undefined };
}

export function normalizePlacedStructure(state: Partial<PlacedStructureState> & Pick<PlacedStructureState, "id" | "kind" | "tileX" | "tileY">): PlacedStructureState {
  const definition = BUILDABLE_DEFINITIONS[state.kind];
  let placement = state.placement ?? { kind: "footprint" as const, tileX: state.tileX, tileY: state.tileY, rotation: 0 };
  if (definition.placementClass === "furniture" && placement.kind === "footprint") {
    const footprint = getRotatedStructureFootprint(state.kind, placement.rotation);
    placement = { kind: "furniture", x: (placement.tileX + footprint.width / 2) * TILE_SIZE, y: (placement.tileY + footprint.height / 2) * TILE_SIZE, angle: placement.rotation * Math.PI / 2 };
  }
  const maximumHealth = state.maximumHealth ?? definition.maximumHealth;
  return { ...state, placement,source:state.source??"player-built",ownership:state.ownership??"player", health: Math.max(0, Math.min(maximumHealth, state.health ?? maximumHealth)), maximumHealth, createdOrder: state.createdOrder ?? 0, storedEnergy: state.storedEnergy ?? 0, powered: state.powered ?? false } as PlacedStructureState;
}

export function getPlacedStructureCenter(state: Pick<PlacedStructureState, "kind" | "tileX" | "tileY" | "placement">): { x: number; y: number } {
  if (state.placement.kind === "segment") return { x: (state.placement.startX + state.placement.endX) / 2, y: (state.placement.startY + state.placement.endY) / 2 };
  if (state.placement.kind === "furniture") return { x: state.placement.x, y: state.placement.y };
  const footprint = getRotatedStructureFootprint(state.kind, state.placement.rotation);
  return { x: (state.tileX + footprint.width / 2) * TILE_SIZE, y: (state.tileY + footprint.height / 2) * TILE_SIZE };
}
