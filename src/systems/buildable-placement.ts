import type { BuildableKind } from "../data/buildable-definitions";

export interface BuildablePlacementProbe {
  inBounds: boolean;
  blocked: boolean;
  occupiedByStructure: boolean;
  doorway: boolean;
  objective: boolean;
  extraction: boolean;
  actorOccupied: boolean;
  indoor: boolean;
  roadLane: boolean;
  withinRange?: boolean;
  visible?: boolean;
  lineOfSight?: boolean;
}

export type BuildablePlacementFailure = "out-of-bounds" | "blocked" | "occupied" | "doorway" | "objective" | "extraction" | "actor" | "unseen" | "out-of-range" | "line-of-sight" | "solar-indoors" | "solar-road";

export function getBuildablePlacementFailure(kind: BuildableKind, probe: BuildablePlacementProbe): BuildablePlacementFailure | null {
  if (!probe.inBounds) return "out-of-bounds";
  if (probe.blocked) return "blocked";
  if (probe.occupiedByStructure) return "occupied";
  if (probe.doorway) return "doorway";
  if (probe.objective) return "objective";
  if (probe.extraction) return "extraction";
  if (probe.actorOccupied) return "actor";
  if (probe.visible === false) return "unseen";
  if (probe.withinRange === false) return "out-of-range";
  if (probe.lineOfSight === false) return "line-of-sight";
  if (kind === "solar-generator" && probe.indoor) return "solar-indoors";
  if (kind === "solar-generator" && probe.roadLane) return "solar-road";
  return null;
}

export function placeBuildableWithInventory(kind: BuildableKind, probe: BuildablePlacementProbe, consumeKit: () => boolean, place: () => void): boolean {
  if (getBuildablePlacementFailure(kind, probe)) return false;
  if (!consumeKit()) return false;
  place();
  return true;
}
