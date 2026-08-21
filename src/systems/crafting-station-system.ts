import { CRAFTING_STATION_TIER, type CraftingStationKind } from "../data/recipe-definitions";
import type { Point } from "./zombie-ai-system";

export const CRAFTING_STATION_RANGE = 72;

export interface CraftingStationRegistration extends Point {
  id: string;
  kind: Exclude<CraftingStationKind, "hand">;
}

export interface CraftingStationQuery {
  hasLineOfSight(from: Point, to: Point): boolean;
}

export class CraftingStationSystem {
  private readonly stations = new Map<string, CraftingStationRegistration>();

  register(station: CraftingStationRegistration): void {
    if (this.stations.has(station.id)) throw new Error(`Duplicate crafting station id: ${station.id}`);
    this.stations.set(station.id, { ...station });
  }

  unregister(id: string): boolean { return this.stations.delete(id); }
  get(id: string): CraftingStationRegistration | undefined { return this.stations.get(id); }
  clear(): void { this.stations.clear(); }
  get size(): number { return this.stations.size; }

  findBest(origin: Point, query: CraftingStationQuery, range = CRAFTING_STATION_RANGE): CraftingStationRegistration | undefined {
    const rangeSquared = range * range;
    let best: CraftingStationRegistration | undefined;
    let bestDistanceSquared = Number.POSITIVE_INFINITY;
    for (const station of this.stations.values()) {
      const distanceSquared = squaredDistance(origin, station);
      if (distanceSquared > rangeSquared || !query.hasLineOfSight(origin, station)) continue;
      if (!best || CRAFTING_STATION_TIER[station.kind] > CRAFTING_STATION_TIER[best.kind]
        || (CRAFTING_STATION_TIER[station.kind] === CRAFTING_STATION_TIER[best.kind]
          && (distanceSquared < bestDistanceSquared || (distanceSquared === bestDistanceSquared && station.id < best.id)))) {
        best = station;
        bestDistanceSquared = distanceSquared;
      }
    }
    return best;
  }
}

function squaredDistance(first: Point, second: Point): number { return (first.x - second.x) ** 2 + (first.y - second.y) ** 2; }
