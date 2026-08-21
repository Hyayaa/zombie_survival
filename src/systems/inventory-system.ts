import { BALANCE } from "../config/game-config";
import { getEffectiveFootprint, type InventoryRotation, type StorageSlot } from "../data/item-definitions";
import { getInventoryObjectDefinition, isWeaponItemId } from "../data/inventory-object-definitions";
import type { WeaponId } from "../data/weapon-definitions";

export interface InventorySlot { itemId: string; quantity: number; instanceId?: string }
export type InventoryContainerKind = "pockets" | StorageSlot;

export interface InventoryItemInstance {
  instanceId: string; itemId: string; quantity: number; containerId: string | null;
  x: number; y: number; width: number; height: number; rotation: InventoryRotation;
}

export interface InventoryContainerView {
  id: string; kind: InventoryContainerKind; sourceItemInstanceId: string | null;
  width: number; height: number; occupancy: Int32Array;
}

export interface GridInventorySnapshot {
  version: 2 | 3 | 4;
  nextInstanceId: number;
  items: Array<Omit<InventoryItemInstance, "rotation"> & { rotation?: InventoryRotation }>;
  equipment: Partial<Record<StorageSlot, string>>;
  weaponEquipment?: WeaponEquipmentState;
}

export type WeaponEquipmentSlot = "primary" | "secondary";
export interface WeaponEquipmentState {
  primaryInstanceId?: string;
  secondaryInstanceId?: string;
  activeSlot: WeaponEquipmentSlot;
}

export type InventorySnapshot = Array<InventorySlot | null> | GridInventorySnapshot;
export interface InventoryMoveTarget { containerId: string; x: number; y: number; rotation?: InventoryRotation }
export type InventoryItemLocation = { kind: "container"; containerId: string; x: number; y: number } | { kind: "equipment"; slot: StorageSlot } | { kind: "weapon"; slot: WeaponEquipmentSlot };
export type InventoryDropTarget = ({ kind: "container" } & InventoryMoveTarget) | { kind: "equipment"; slot: StorageSlot } | { kind: "weapon"; slot: WeaponEquipmentSlot };
export type EquipmentMoveFailureReason = "storage-not-empty" | "target-blocked" | "invalid-slot" | "own-storage" | "missing-instance";
export interface EquipmentMoveResult { success: boolean; reason?: EquipmentMoveFailureReason }

const CONTAINER_ORDER: readonly InventoryContainerKind[] = ["pockets", "shirt", "pants", "belt", "vest", "backpack"];
const EQUIPMENT_SLOTS: readonly StorageSlot[] = ["shirt", "pants", "belt", "vest", "backpack"];
interface MutableContainer extends InventoryContainerView {}

function isGridSnapshot(value: InventorySnapshot): value is GridInventorySnapshot {
  return !Array.isArray(value) && (value.version === 2 || value.version === 3 || value.version === 4) && Array.isArray(value.items);
}

function copyItem(item: InventoryItemInstance): InventoryItemInstance { return { ...item }; }

export class InventorySystem {
  private readonly containers = new Map<string, MutableContainer>();
  private readonly items = new Map<string, InventoryItemInstance>();
  private readonly equipment: Partial<Record<StorageSlot, string>> = {};
  private weaponEquipment: WeaponEquipmentState = { activeSlot: "primary" };
  private nextInstanceId = 1;
  private nextOccupancyId = 1;
  private readonly occupancyIds = new Map<string, number>();
  private legacyOverflow: InventorySlot[] = [];
  private revisionValue = 0;

  constructor(_slotCount: number = BALANCE.inventorySlots, initial?: InventorySnapshot) {
    this.createContainer("pockets", "pockets", 4, 2, null);
    if (initial && isGridSnapshot(initial)) { this.restore(initial); return; }
    this.createStartingEquipment();
    if (initial) this.migrateLegacy(initial);
  }

  get revision(): number { return this.revisionValue; }

  getContainers(): ReadonlyArray<InventoryContainerView> {
    return this.sortedContainers().map((container) => ({ ...container, occupancy: new Int32Array(container.occupancy) }));
  }

  getItems(): ReadonlyArray<InventoryItemInstance> { return [...this.items.values()].map(copyItem); }
  getStoredItems(): ReadonlyArray<InventoryItemInstance> {
    return [...this.items.values()].filter((item) => item.containerId !== null).map(copyItem);
  }
  getItem(instanceId: string): InventoryItemInstance | null {
    const item = this.items.get(instanceId); return item ? copyItem(item) : null;
  }
  getItemLocation(instanceId: string): InventoryItemLocation | null {
    const item = this.items.get(instanceId); if (!item) return null;
    if (item.containerId !== null) return { kind: "container", containerId: item.containerId, x: item.x, y: item.y };
    for (const slot of EQUIPMENT_SLOTS) if (this.equipment[slot] === instanceId) return { kind: "equipment", slot };
    if (this.weaponEquipment.primaryInstanceId === instanceId) return { kind: "weapon", slot: "primary" };
    if (this.weaponEquipment.secondaryInstanceId === instanceId) return { kind: "weapon", slot: "secondary" };
    return null;
  }
  getEquipment(): Readonly<Partial<Record<StorageSlot, string>>> { return { ...this.equipment }; }
  getWeaponEquipment(): Readonly<WeaponEquipmentState> { return { ...this.weaponEquipment }; }
  getWeaponInstance(slot: WeaponEquipmentSlot): InventoryItemInstance | null {
    const instanceId = slot === "primary" ? this.weaponEquipment.primaryInstanceId : this.weaponEquipment.secondaryInstanceId;
    const item = instanceId ? this.items.get(instanceId) : undefined; return item ? copyItem(item) : null;
  }
  getActiveWeaponId(): WeaponId | null {
    const item = this.getWeaponInstance(this.weaponEquipment.activeSlot); return item && isWeaponItemId(item.itemId) ? item.itemId : null;
  }
  getSlots(): ReadonlyArray<InventorySlot | null> {
    return this.getStoredItems().map((item) => ({ itemId: item.itemId, quantity: item.quantity, instanceId: item.instanceId }));
  }

  count(itemId: string): number {
    let total = 0;
    for (const item of this.items.values()) if (item.itemId === itemId) total += item.quantity;
    return total;
  }
  has(requirements: Record<string, number>): boolean {
    return Object.entries(requirements).every(([itemId, quantity]) => this.count(itemId) >= quantity);
  }
  canAdd(itemId: string, quantity: number): boolean {
    const clone = this.clone(); return clone.add(itemId, quantity) === quantity;
  }

  add(itemId: string, quantity: number): number {
    if (quantity <= 0) return 0;
    const definition = getInventoryObjectDefinition(itemId);
    let remaining = quantity;
    for (const item of this.items.values()) {
      if (item.containerId === null || item.itemId !== itemId || item.quantity >= definition.maxStack) continue;
      const moved = Math.min(remaining, definition.maxStack - item.quantity);
      item.quantity += moved; remaining -= moved;
      if (remaining === 0) break;
    }
    while (remaining > 0) {
      const location = this.findFirstFit(itemId);
      const moved = Math.min(remaining, definition.maxStack);
      if (!location) {
        const storage = definition.storageEquipment;
        if (!storage || this.equipment[storage.slot]) break;
        const item = this.createItem(itemId, moved);
        this.equipment[storage.slot] = item.instanceId;
        this.createEquipmentContainer(item);
        remaining -= moved;
        continue;
      }
      const item = this.createItem(itemId, moved);
      this.applyRotation(item, location.rotation ?? 0);
      if (!this.place(item, location.containerId, location.x, location.y)) { this.items.delete(item.instanceId); break; }
      remaining -= moved;
    }
    if (remaining !== quantity) this.bumpRevision();
    return quantity - remaining;
  }

  remove(itemId: string, quantity: number): boolean {
    if (quantity <= 0) return true;
    if (this.count(itemId) < quantity) return false;
    let remaining = quantity;
    const candidates = [...this.items.values()].filter((item) => item.itemId === itemId && item.containerId !== null).reverse();
    for (const item of candidates) {
      const removed = Math.min(item.quantity, remaining);
      item.quantity -= removed; remaining -= removed;
      if (item.quantity === 0) this.deleteStoredItem(item);
      if (remaining === 0) break;
    }
    if (remaining > 0) return false;
    this.bumpRevision(); return true;
  }

  moveItem(instanceId: string, target: InventoryMoveTarget): boolean {
    const item = this.items.get(instanceId);
    if (!item || item.containerId === null) return false;
    const previous = { containerId: item.containerId, x: item.x, y: item.y, rotation: item.rotation };
    this.clearOccupancy(item);
    this.applyRotation(item, target.rotation ?? item.rotation);
    if (this.place(item, target.containerId, target.x, target.y)) { this.bumpRevision(); return true; }
    this.applyRotation(item, previous.rotation);
    this.place(item, previous.containerId, previous.x, previous.y);
    return false;
  }

  canPlace(instanceId: string, target: InventoryMoveTarget): boolean {
    const item = this.items.get(instanceId); const container = this.containers.get(target.containerId);
    if (!item || item.containerId === null || !container || !this.canStoreInContainer(item.itemId, container)) return false;
    const footprint = getEffectiveFootprint(getInventoryObjectDefinition(item.itemId), target.rotation ?? item.rotation);
    return this.cellsAreAvailable(container, target.x, target.y, footprint.width, footprint.height, this.occupancyIds.get(instanceId));
  }

  rotateItem(instanceId: string): boolean {
    const item = this.items.get(instanceId);
    if (!item || item.containerId === null || item.width === item.height) return false;
    return this.moveItem(instanceId, { containerId: item.containerId, x: item.x, y: item.y, rotation: item.rotation === 0 ? 1 : 0 });
  }

  equip(instanceId: string): boolean {
    const item = this.items.get(instanceId);
    if (!item || item.containerId === null) return false;
    const storage = getInventoryObjectDefinition(item.itemId).storageEquipment;
    if (!storage) return false;
    if (storage.slot === "backpack" && this.containers.get(item.containerId)?.kind === "backpack") return false;
    const before = this.snapshot();
    const occupiedId = this.equipment[storage.slot]; const occupied = occupiedId ? this.items.get(occupiedId) : undefined;
    this.clearOccupancy(item);
    if (occupied) {
      const container = this.containerForSlot(storage.slot);
      if (!container || !this.isContainerEmpty(container.id)) { this.restore(before); return false; }
      this.containers.delete(container.id); delete this.equipment[storage.slot];
      const location = this.findFirstFit(occupied.itemId, occupied.rotation);
      if (!location) { this.restore(before); return false; }
      this.applyRotation(occupied, location.rotation ?? occupied.rotation);
      if (!this.place(occupied, location.containerId, location.x, location.y)) { this.restore(before); return false; }
    }
    item.containerId = null; item.x = 0; item.y = 0;
    this.equipment[storage.slot] = instanceId;
    this.createEquipmentContainer(item);
    this.bumpRevision(); return true;
  }

  canEquipToSlot(instanceId: string, slot: StorageSlot): boolean {
    const item = this.items.get(instanceId);
    if (!item || getInventoryObjectDefinition(item.itemId).storageEquipment?.slot !== slot) return false;
    return this.clone().equipToSlot(instanceId, slot);
  }

  equipToSlot(instanceId: string, slot: StorageSlot): boolean {
    const item = this.items.get(instanceId);
    if (!item || item.containerId === null || getInventoryObjectDefinition(item.itemId).storageEquipment?.slot !== slot) return false;
    return this.equip(instanceId);
  }

  canEquipWeapon(instanceId: string, slot: WeaponEquipmentSlot): boolean {
    return this.clone().equipWeapon(instanceId, slot);
  }

  equipWeapon(instanceId: string, slot: WeaponEquipmentSlot): boolean {
    const item = this.items.get(instanceId);
    if (!item || !isWeaponItemId(item.itemId)) return false;
    const slotKey = slot === "primary" ? "primaryInstanceId" : "secondaryInstanceId";
    if (this.weaponEquipment[slotKey] === instanceId) { this.weaponEquipment.activeSlot = slot; this.bumpRevision(); return true; }
    const before = this.snapshot();
    const displacedId = this.weaponEquipment[slotKey];
    if (item.containerId !== null) this.clearOccupancy(item);
    if (this.weaponEquipment.primaryInstanceId === instanceId) delete this.weaponEquipment.primaryInstanceId;
    if (this.weaponEquipment.secondaryInstanceId === instanceId) delete this.weaponEquipment.secondaryInstanceId;
    item.containerId = null; item.x = 0; item.y = 0;
    if (displacedId && displacedId !== instanceId) {
      const displaced = this.items.get(displacedId); const location = displaced ? this.findFirstFit(displaced.itemId, displaced.rotation) : null;
      if (!displaced || !location) { this.restore(before); return false; }
      this.applyRotation(displaced, location.rotation ?? displaced.rotation);
      if (!this.place(displaced, location.containerId, location.x, location.y)) { this.restore(before); return false; }
    }
    this.weaponEquipment[slotKey] = instanceId; this.weaponEquipment.activeSlot = slot;
    this.bumpRevision(); return true;
  }

  unequipWeapon(slot: WeaponEquipmentSlot): boolean {
    const slotKey = slot === "primary" ? "primaryInstanceId" : "secondaryInstanceId";
    const instanceId = this.weaponEquipment[slotKey]; const item = instanceId ? this.items.get(instanceId) : undefined;
    if (!item) return false;
    const location = this.findFirstFit(item.itemId, item.rotation); if (!location) return false;
    const before = this.snapshot(); delete this.weaponEquipment[slotKey];
    this.applyRotation(item, location.rotation ?? item.rotation);
    if (!this.place(item, location.containerId, location.x, location.y)) { this.restore(before); return false; }
    if (this.weaponEquipment.activeSlot === slot) this.weaponEquipment.activeSlot = slot === "primary" && this.weaponEquipment.secondaryInstanceId ? "secondary" : "primary";
    this.bumpRevision(); return true;
  }

  setActiveWeaponSlot(slot: WeaponEquipmentSlot): boolean {
    const instanceId = slot === "primary" ? this.weaponEquipment.primaryInstanceId : this.weaponEquipment.secondaryInstanceId;
    if (!instanceId) return false; this.weaponEquipment.activeSlot = slot; this.bumpRevision(); return true;
  }

  migrateLegacyWeapons(equippedWeapon: string, ownedWeapons: readonly string[]): InventorySlot[] {
    if (this.weaponEquipment.primaryInstanceId || this.weaponEquipment.secondaryInstanceId) return [];
    const ordered = [...new Set([equippedWeapon, ...ownedWeapons])].filter(isWeaponItemId);
    const overflow: InventorySlot[] = [];
    for (const weaponId of ordered) {
      const target = !this.weaponEquipment.primaryInstanceId ? "primary" : !this.weaponEquipment.secondaryInstanceId ? "secondary" : null;
      const existing = [...this.items.values()].find((item) => item.itemId === weaponId && item.containerId !== null);
      const recoveredOverflow = this.legacyOverflow.find((slot) => slot.itemId === weaponId && slot.quantity > 0);
      if (target) {
        const instance = existing ?? this.createItem(weaponId, 1);
        if (this.equipWeapon(instance.instanceId, target)) { if (!existing && recoveredOverflow) recoveredOverflow.quantity -= 1; }
        else if (!existing) { this.items.delete(instance.instanceId); this.occupancyIds.delete(instance.instanceId); if (!recoveredOverflow) overflow.push({ itemId: weaponId, quantity: 1 }); }
      } else if (!existing) {
        if (this.add(weaponId, 1) === 1) { if (recoveredOverflow) recoveredOverflow.quantity -= 1; }
        else if (!recoveredOverflow) overflow.push({ itemId: weaponId, quantity: 1 });
      }
    }
    const active = (['primary', 'secondary'] as const).find((slot) => this.getWeaponInstance(slot)?.itemId === equippedWeapon);
    if (active) this.setActiveWeaponSlot(active);
    return overflow;
  }

  unequip(slot: StorageSlot): boolean {
    const instanceId = this.equipment[slot];
    if (!instanceId) return false;
    const item = this.items.get(instanceId);
    const container = this.containerForSlot(slot);
    if (!item || !container || !this.isContainerEmpty(container.id)) return false;
    const before = this.snapshot();
    this.containers.delete(container.id); delete this.equipment[slot];
    const location = this.findFirstFit(item.itemId);
    if (!location) { this.restore(before); return false; }
    this.applyRotation(item, location.rotation ?? 0);
    if (!this.place(item, location.containerId, location.x, location.y)) { this.restore(before); return false; }
    this.bumpRevision(); return true;
  }

  canUnequipItemToGrid(slot: StorageSlot, instanceId: string, target: InventoryMoveTarget): EquipmentMoveResult {
    const item = this.items.get(instanceId); if (!item || this.equipment[slot] !== instanceId) return { success: false, reason: "missing-instance" };
    const storage = getInventoryObjectDefinition(item.itemId).storageEquipment; if (!storage || storage.slot !== slot) return { success: false, reason: "invalid-slot" };
    const ownContainer = this.containerForSlot(slot); if (!ownContainer) return { success: false, reason: "missing-instance" };
    if (!this.isContainerEmpty(ownContainer.id)) return { success: false, reason: "storage-not-empty" };
    if (target.containerId === ownContainer.id) return { success: false, reason: "own-storage" };
    const targetContainer = this.containers.get(target.containerId); if (!targetContainer || !this.canStoreInContainer(item.itemId, targetContainer)) return { success: false, reason: "target-blocked" };
    const footprint = getEffectiveFootprint(getInventoryObjectDefinition(item.itemId), target.rotation ?? item.rotation);
    return this.cellsAreFree(targetContainer, target.x, target.y, footprint.width, footprint.height) ? { success: true } : { success: false, reason: "target-blocked" };
  }

  unequipItemToGrid(slot: StorageSlot, instanceId: string, target: InventoryMoveTarget): EquipmentMoveResult {
    const validation = this.canUnequipItemToGrid(slot, instanceId, target); if (!validation.success) return validation;
    const item = this.items.get(instanceId)!; const ownContainer = this.containerForSlot(slot)!; const before = this.snapshot();
    this.containers.delete(ownContainer.id); delete this.equipment[slot]; this.applyRotation(item, target.rotation ?? item.rotation);
    if (!this.place(item, target.containerId, target.x, target.y)) { this.restore(before); return { success: false, reason: "target-blocked" }; }
    this.bumpRevision(); return { success: true };
  }

  canUnequipWeaponToGrid(slot: WeaponEquipmentSlot, instanceId: string, target: InventoryMoveTarget): EquipmentMoveResult {
    const slotId = slot === "primary" ? this.weaponEquipment.primaryInstanceId : this.weaponEquipment.secondaryInstanceId; const item = this.items.get(instanceId);
    if (!item || slotId !== instanceId || !isWeaponItemId(item.itemId)) return { success: false, reason: "missing-instance" };
    const targetContainer = this.containers.get(target.containerId); if (!targetContainer) return { success: false, reason: "target-blocked" };
    const footprint = getEffectiveFootprint(getInventoryObjectDefinition(item.itemId), target.rotation ?? item.rotation);
    return this.cellsAreFree(targetContainer, target.x, target.y, footprint.width, footprint.height) ? { success: true } : { success: false, reason: "target-blocked" };
  }

  unequipWeaponToGrid(slot: WeaponEquipmentSlot, instanceId: string, target: InventoryMoveTarget): EquipmentMoveResult {
    const validation = this.canUnequipWeaponToGrid(slot, instanceId, target); if (!validation.success) return validation;
    const item = this.items.get(instanceId)!; const before = this.snapshot(); const slotKey = slot === "primary" ? "primaryInstanceId" : "secondaryInstanceId";
    delete this.weaponEquipment[slotKey]; this.applyRotation(item, target.rotation ?? item.rotation);
    if (!this.place(item, target.containerId, target.x, target.y)) { this.restore(before); return { success: false, reason: "target-blocked" }; }
    if (this.weaponEquipment.activeSlot === slot) this.weaponEquipment.activeSlot = slot === "primary" && this.weaponEquipment.secondaryInstanceId ? "secondary" : "primary";
    this.bumpRevision(); return { success: true };
  }

  dropInstance(instanceId: string, quantity = 1): InventorySlot | null {
    const item = this.items.get(instanceId);
    if (!item || item.containerId === null || quantity <= 0) return null;
    const removed = Math.min(quantity, item.quantity);
    const result = { itemId: item.itemId, quantity: removed, instanceId: item.instanceId };
    item.quantity -= removed;
    if (item.quantity === 0) this.deleteStoredItem(item);
    this.bumpRevision(); return result;
  }
  dropFromSlot(index: number, quantity = 1): InventorySlot | null {
    const slot = this.getSlots()[index]; return slot?.instanceId ? this.dropInstance(slot.instanceId, quantity) : null;
  }

  takeLegacyOverflow(): InventorySlot[] {
    const overflow = this.legacyOverflow.filter((slot) => slot.quantity > 0).map((slot) => ({ ...slot })); this.legacyOverflow.length = 0; return overflow;
  }

  snapshot(): GridInventorySnapshot {
    return { version: 4, nextInstanceId: this.nextInstanceId, items: [...this.items.values()].map(copyItem), equipment: { ...this.equipment }, weaponEquipment: { ...this.weaponEquipment } };
  }

  restore(snapshot: InventorySnapshot): void {
    if (Array.isArray(snapshot)) { this.reset(); this.createStartingEquipment(); this.migrateLegacy(snapshot); return; }
    this.reset(); this.nextInstanceId = Math.max(1, snapshot.nextInstanceId);
    for (const saved of snapshot.items) {
      const rotation: InventoryRotation = saved.rotation === 1 ? 1 : 0;
      const footprint = getEffectiveFootprint(getInventoryObjectDefinition(saved.itemId), rotation);
      const item = { ...saved, rotation, width: footprint.width, height: footprint.height };
      this.items.set(item.instanceId, item); this.occupancyIds.set(item.instanceId, this.nextOccupancyId++);
    }
    for (const slot of EQUIPMENT_SLOTS) {
      const instanceId = snapshot.equipment[slot];
      const item = instanceId ? this.items.get(instanceId) : undefined;
      if (!item || getInventoryObjectDefinition(item.itemId).storageEquipment?.slot !== slot) continue;
      item.containerId = null; this.equipment[slot] = instanceId; this.createEquipmentContainer(item);
    }
    const savedWeapons = snapshot.weaponEquipment;
    if (savedWeapons) {
      for (const slot of ["primary", "secondary"] as const) {
        const key = slot === "primary" ? "primaryInstanceId" : "secondaryInstanceId";
        const instanceId = savedWeapons[key]; const item = instanceId ? this.items.get(instanceId) : undefined;
        if (!item || !isWeaponItemId(item.itemId)) continue;
        item.containerId = null; this.weaponEquipment[key] = instanceId;
      }
      this.weaponEquipment.activeSlot = savedWeapons.activeSlot === "secondary" ? "secondary" : "primary";
      if (!this.getWeaponInstance(this.weaponEquipment.activeSlot)) this.weaponEquipment.activeSlot = this.weaponEquipment.primaryInstanceId ? "primary" : this.weaponEquipment.secondaryInstanceId ? "secondary" : "primary";
    }
    for (const item of [...this.items.values()]) {
      if (item.containerId === null) continue;
      if (!this.place(item, item.containerId, item.x, item.y)) {
        const fallback = this.findFirstFit(item.itemId, item.rotation, item.containerId);
        if (fallback) this.applyRotation(item, fallback.rotation ?? item.rotation);
        if (!fallback || !this.place(item, fallback.containerId, fallback.x, fallback.y)) {
          this.items.delete(item.instanceId); this.legacyOverflow.push({ itemId: item.itemId, quantity: item.quantity, instanceId: item.instanceId });
        }
      }
    }
    this.bumpRevision();
  }

  clone(): InventorySystem { return new InventorySystem(BALANCE.inventorySlots, this.snapshot()); }

  private createStartingEquipment(): void {
    for (const itemId of ["basic_tshirt", "work_pants"]) {
      const item = this.createItem(itemId, 1);
      const storage = getInventoryObjectDefinition(itemId).storageEquipment!;
      item.containerId = null; this.equipment[storage.slot] = item.instanceId; this.createEquipmentContainer(item);
    }
  }
  private migrateLegacy(slots: Array<InventorySlot | null>): void {
    for (const slot of slots) {
      if (!slot || slot.quantity <= 0) continue;
      const added = this.add(slot.itemId, slot.quantity);
      if (added < slot.quantity) this.legacyOverflow.push({ itemId: slot.itemId, quantity: slot.quantity - added });
    }
  }
  private reset(): void {
    this.containers.clear(); this.items.clear(); this.occupancyIds.clear(); this.legacyOverflow.length = 0;
    for (const slot of EQUIPMENT_SLOTS) delete this.equipment[slot];
    this.weaponEquipment = { activeSlot: "primary" };
    this.nextOccupancyId = 1; this.createContainer("pockets", "pockets", 4, 2, null);
  }
  private createItem(itemId: string, quantity: number): InventoryItemInstance {
    const footprint = getInventoryObjectDefinition(itemId).inventoryFootprint;
    const instanceId = `item-${this.nextInstanceId++}`;
    const item: InventoryItemInstance = { instanceId, itemId, quantity, containerId: null, x: 0, y: 0, width: footprint.width, height: footprint.height, rotation: 0 };
    this.items.set(instanceId, item); this.occupancyIds.set(instanceId, this.nextOccupancyId++); return item;
  }
  private createEquipmentContainer(item: InventoryItemInstance): void {
    const storage = getInventoryObjectDefinition(item.itemId).storageEquipment;
    if (storage) this.createContainer(`equipment:${storage.slot}:${item.instanceId}`, storage.slot, storage.containerWidth, storage.containerHeight, item.instanceId);
  }
  private createContainer(id: string, kind: InventoryContainerKind, width: number, height: number, sourceItemInstanceId: string | null): void {
    this.containers.set(id, { id, kind, width, height, sourceItemInstanceId, occupancy: new Int32Array(width * height) });
  }
  private containerForSlot(slot: StorageSlot): MutableContainer | undefined {
    return [...this.containers.values()].find((container) => container.kind === slot);
  }
  private sortedContainers(): MutableContainer[] {
    return [...this.containers.values()].sort((a, b) => CONTAINER_ORDER.indexOf(a.kind) - CONTAINER_ORDER.indexOf(b.kind));
  }
  private findFirstFit(itemId: string, preferredRotation: InventoryRotation = 0, preferredContainerId?: string): InventoryMoveTarget | null {
    const rotations: InventoryRotation[] = preferredRotation === 0 ? [0, 1] : [1, 0];
    const definition = getInventoryObjectDefinition(itemId);
    if (preferredContainerId) {
      const preferred = this.containers.get(preferredContainerId);
      if (preferred && this.canStoreInContainer(itemId, preferred)) for (const rotation of rotations) {
        const footprint = getEffectiveFootprint(definition, rotation); const fit = this.findFitInContainer(preferred, footprint.width, footprint.height);
        if (fit) return { ...fit, rotation };
      }
    }
    for (const rotation of rotations) {
      const footprint = getEffectiveFootprint(definition, rotation);
      for (const container of this.sortedContainers()) {
        if (container.id === preferredContainerId) continue;
        if (!this.canStoreInContainer(itemId, container)) continue;
        const fit = this.findFitInContainer(container, footprint.width, footprint.height);
        if (fit) return { ...fit, rotation };
      }
    }
    return null;
  }
  private canStoreInContainer(itemId: string, container: MutableContainer): boolean {
    return !(getInventoryObjectDefinition(itemId).storageEquipment?.slot === "backpack" && container.kind === "backpack");
  }
  private place(item: InventoryItemInstance, containerId: string, x: number, y: number): boolean {
    const container = this.containers.get(containerId);
    if (!container || !this.canStoreInContainer(item.itemId, container) || !this.cellsAreFree(container, x, y, item.width, item.height)) return false;
    const occupancyId = this.occupancyIds.get(item.instanceId); if (!occupancyId) return false;
    item.containerId = containerId; item.x = x; item.y = y;
    for (let row = y; row < y + item.height; row += 1) for (let column = x; column < x + item.width; column += 1) container.occupancy[row * container.width + column] = occupancyId;
    return true;
  }
  private cellsAreFree(container: MutableContainer, x: number, y: number, width: number, height: number): boolean {
    return this.cellsAreAvailable(container, x, y, width, height);
  }
  private findFitInContainer(container: MutableContainer, width: number, height: number): Omit<InventoryMoveTarget, "rotation"> | null {
    for (let y = 0; y <= container.height - height; y += 1) for (let x = 0; x <= container.width - width; x += 1) if (this.cellsAreFree(container, x, y, width, height)) return { containerId: container.id, x, y };
    return null;
  }
  private cellsAreAvailable(container: MutableContainer, x: number, y: number, width: number, height: number, allowedOccupancyId?: number): boolean {
    if (x < 0 || y < 0 || x + width > container.width || y + height > container.height) return false;
    for (let row = y; row < y + height; row += 1) for (let column = x; column < x + width; column += 1) {
      const occupied = container.occupancy[row * container.width + column];
      if (occupied !== 0 && occupied !== allowedOccupancyId) return false;
    }
    return true;
  }
  private applyRotation(item: InventoryItemInstance, rotation: InventoryRotation): void {
    const footprint = getEffectiveFootprint(getInventoryObjectDefinition(item.itemId), rotation);
    item.rotation = rotation; item.width = footprint.width; item.height = footprint.height;
  }
  private clearOccupancy(item: InventoryItemInstance): void {
    if (item.containerId === null) return;
    const container = this.containers.get(item.containerId); const occupancyId = this.occupancyIds.get(item.instanceId);
    if (!container || !occupancyId) return;
    for (let index = 0; index < container.occupancy.length; index += 1) if (container.occupancy[index] === occupancyId) container.occupancy[index] = 0;
  }
  private deleteStoredItem(item: InventoryItemInstance): void {
    this.clearOccupancy(item); this.items.delete(item.instanceId); this.occupancyIds.delete(item.instanceId);
  }
  private isContainerEmpty(containerId: string): boolean {
    const container = this.containers.get(containerId); return !!container && container.occupancy.every((value) => value === 0);
  }
  private bumpRevision(): void { this.revisionValue += 1; }
}
