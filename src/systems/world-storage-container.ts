import { getEffectiveFootprint, type InventoryRotation } from "../data/item-definitions";
import { getInventoryObjectDefinition } from "../data/inventory-object-definitions";

export interface WorldStorageItem { instanceId: string; itemId: string; quantity: number; x: number; y: number; rotation: InventoryRotation }
export interface WorldStorageSnapshot { version: 1; width: number; height: number; nextInstanceId: number; items: WorldStorageItem[] }

/** Independent grid storage. It is deliberately not part of InventorySystem counts. */
export class WorldStorageContainer {
  private readonly items = new Map<string, WorldStorageItem>();
  private readonly occupancy: Array<string | undefined>;
  private nextInstanceId = 1;
  constructor(readonly id: string, readonly width = 8, readonly height = 6, snapshot?: WorldStorageSnapshot) {
    this.occupancy = new Array(width * height);
    if (snapshot) this.restore(snapshot);
  }
  get size(): number { return this.items.size; }
  isEmpty(): boolean { return this.items.size === 0; }
  getItems(): WorldStorageItem[] { return [...this.items.values()].sort((a, b) => a.y - b.y || a.x - b.x || a.instanceId.localeCompare(b.instanceId)).map((item) => ({ ...item })); }
  add(itemId: string, quantity: number, x?: number, y?: number, rotation: InventoryRotation = 0, instanceId?: string): boolean {
    if (quantity <= 0) return false; const definition = getInventoryObjectDefinition(itemId); const footprint = getEffectiveFootprint(definition, rotation);
    const target = x === undefined || y === undefined ? this.findFit(footprint.width, footprint.height) : { x, y };
    if (!target || !this.cellsFree(target.x, target.y, footprint.width, footprint.height)) return false;
    const id = instanceId ?? `${this.id}:${this.nextInstanceId++}`; if (this.items.has(id)) return false;
    const item = { instanceId: id, itemId, quantity, x: target.x, y: target.y, rotation }; this.items.set(id, item); this.mark(item, id); return true;
  }
  remove(instanceId: string): WorldStorageItem | undefined { const item = this.items.get(instanceId); if (!item) return undefined; this.mark(item, undefined); this.items.delete(instanceId); return { ...item }; }
  move(instanceId: string, x: number, y: number, rotation?: InventoryRotation): boolean {
    const item = this.items.get(instanceId); if (!item) return false; const before = { ...item }; this.mark(item, undefined); item.rotation = rotation ?? item.rotation; item.x = x; item.y = y;
    const footprint = getEffectiveFootprint(getInventoryObjectDefinition(item.itemId), item.rotation);
    if (!this.cellsFree(x, y, footprint.width, footprint.height)) { Object.assign(item, before); this.mark(item, item.instanceId); return false; }
    this.mark(item, item.instanceId); return true;
  }
  rotate(instanceId: string): boolean { const item = this.items.get(instanceId); return item ? this.move(instanceId, item.x, item.y, item.rotation === 0 ? 1 : 0) : false; }
  snapshot(): WorldStorageSnapshot { return { version: 1, width: this.width, height: this.height, nextInstanceId: this.nextInstanceId, items: this.getItems() }; }
  drainForDestruction(): WorldStorageItem[] { const items = this.getItems(); this.items.clear(); this.occupancy.fill(undefined); return items; }
  private restore(snapshot: WorldStorageSnapshot): void { this.nextInstanceId = Math.max(1, snapshot.nextInstanceId); for (const item of snapshot.items) this.add(item.itemId, item.quantity, item.x, item.y, item.rotation, item.instanceId); }
  private findFit(width: number, height: number): { x: number; y: number } | null { for (let y = 0; y <= this.height - height; y += 1) for (let x = 0; x <= this.width - width; x += 1) if (this.cellsFree(x, y, width, height)) return { x, y }; return null; }
  private cellsFree(x: number, y: number, width: number, height: number): boolean { if (x < 0 || y < 0 || x + width > this.width || y + height > this.height) return false; for (let row = y; row < y + height; row += 1) for (let column = x; column < x + width; column += 1) if (this.occupancy[row * this.width + column]) return false; return true; }
  private mark(item: WorldStorageItem, value: string | undefined): void { const footprint = getEffectiveFootprint(getInventoryObjectDefinition(item.itemId), item.rotation); for (let y = item.y; y < item.y + footprint.height; y += 1) for (let x = item.x; x < item.x + footprint.width; x += 1) this.occupancy[y * this.width + x] = value; }
}

export function deterministicStorageDropOffsets(count: number, spacing = 9): Array<{ x: number; y: number }> {
  const result: Array<{ x: number; y: number }> = [];
  const directions = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]] as const;
  for (let index = 0; index < count; index += 1) { const ring = 1 + Math.floor(index / directions.length); const direction = directions[index % directions.length]!; result.push({ x: direction[0] * spacing * ring, y: direction[1] * spacing * ring }); }
  return result;
}
