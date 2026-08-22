import type { PlacedStructureState } from "../entities/placed-structure";
import { BUILDABLE_DEFINITIONS } from "../data/buildable-definitions";
import { visitSegmentTiles, type SegmentGeometry } from "./collision-geometry";
import { TILE_SIZE } from "../config/game-config";

export class PlacedStructureRegistry {
  private readonly structures = new Map<string, PlacedStructureState>();
  private readonly buckets = new Map<number, Set<string>>();
  private revisionValue = 0;
  constructor(private readonly widthTiles = 128, private readonly heightTiles = 128) {}
  get revision(): number { return this.revisionValue; }
  get size(): number { return this.structures.size; }
  get(id: string): PlacedStructureState | undefined { return this.structures.get(id); }
  values(): IterableIterator<PlacedStructureState> { return this.structures.values(); }
  snapshot(): PlacedStructureState[] { return [...this.structures.values()].sort((a, b) => a.createdOrder - b.createdOrder || a.id.localeCompare(b.id)).map((state) => structuredClone(state)); }
  register(state: PlacedStructureState): void {
    if (this.structures.has(state.id)) throw new Error(`Duplicate placed structure id: ${state.id}`);
    this.structures.set(state.id, state); this.visitBuckets(state, (key) => this.addToBucket(key, state.id)); this.revisionValue += 1;
  }
  remove(id: string): PlacedStructureState | undefined {
    const state = this.structures.get(id); if (!state) return undefined;
    this.visitBuckets(state, (key) => { const bucket = this.buckets.get(key); bucket?.delete(id); if (bucket?.size === 0) this.buckets.delete(key); });
    this.structures.delete(id); this.revisionValue += 1; return state;
  }
  clear(): void { this.structures.clear(); this.buckets.clear(); this.revisionValue += 1; }
  queryTiles(minTileX: number, minTileY: number, maxTileX: number, maxTileY: number): PlacedStructureState[] {
    const ids = new Set<string>(); const result: PlacedStructureState[] = [];
    for (let y = Math.max(0, minTileY); y <= Math.min(this.heightTiles - 1, maxTileY); y += 1) for (let x = Math.max(0, minTileX); x <= Math.min(this.widthTiles - 1, maxTileX); x += 1) for (const id of this.buckets.get(y * this.widthTiles + x) ?? []) ids.add(id);
    for (const id of ids) { const state = this.structures.get(id); if (state) result.push(state); }
    return result;
  }
  private visitBuckets(state: PlacedStructureState, visitor: (key: number) => void): void {
    if (state.placement.kind === "segment") {
      const definition = BUILDABLE_DEFINITIONS[state.kind].segment!;
      const geometry: SegmentGeometry = { ...state.placement, thickness: definition.thickness };
      visitSegmentTiles(geometry, TILE_SIZE, this.widthTiles, this.heightTiles, (x, y) => visitor(y * this.widthTiles + x), 6);
      return;
    }
    const footprint = BUILDABLE_DEFINITIONS[state.kind].footprint!;
    for (let y = state.tileY; y < state.tileY + footprint.height; y += 1) for (let x = state.tileX; x < state.tileX + footprint.width; x += 1) if (x >= 0 && y >= 0 && x < this.widthTiles && y < this.heightTiles) visitor(y * this.widthTiles + x);
  }
  private addToBucket(key: number, id: string): void { let bucket = this.buckets.get(key); if (!bucket) { bucket = new Set(); this.buckets.set(key, bucket); } bucket.add(id); }
}
