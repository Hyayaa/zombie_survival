import { BALANCE } from "../config/game-config";
import { getItemDefinition } from "../data/item-definitions";

export interface InventorySlot {
  itemId: string;
  quantity: number;
}

export class InventorySystem {
  private slots: Array<InventorySlot | null>;

  constructor(slotCount: number = BALANCE.inventorySlots, initial?: Array<InventorySlot | null>) {
    this.slots = Array.from({ length: slotCount }, (_, index) => {
      const slot = initial?.[index];
      return slot ? { ...slot } : null;
    });
  }

  getSlots(): ReadonlyArray<InventorySlot | null> {
    return this.slots;
  }

  count(itemId: string): number {
    return this.slots.reduce((total, slot) => total + (slot?.itemId === itemId ? slot.quantity : 0), 0);
  }

  has(requirements: Record<string, number>): boolean {
    return Object.entries(requirements).every(([itemId, quantity]) => this.count(itemId) >= quantity);
  }

  canAdd(itemId: string, quantity: number): boolean {
    const clone = this.clone();
    return clone.add(itemId, quantity) === quantity;
  }

  add(itemId: string, quantity: number): number {
    if (quantity <= 0) return 0;
    const definition = getItemDefinition(itemId);
    let remaining = quantity;

    for (const slot of this.slots) {
      if (!slot || slot.itemId !== itemId || slot.quantity >= definition.maxStack) continue;
      const moved = Math.min(remaining, definition.maxStack - slot.quantity);
      slot.quantity += moved;
      remaining -= moved;
      if (remaining === 0) return quantity;
    }

    for (let index = 0; index < this.slots.length && remaining > 0; index += 1) {
      if (this.slots[index]) continue;
      const moved = Math.min(remaining, definition.maxStack);
      this.slots[index] = { itemId, quantity: moved };
      remaining -= moved;
    }
    return quantity - remaining;
  }

  remove(itemId: string, quantity: number): boolean {
    if (quantity <= 0) return true;
    if (this.count(itemId) < quantity) return false;
    let remaining = quantity;
    for (let index = this.slots.length - 1; index >= 0 && remaining > 0; index -= 1) {
      const slot = this.slots[index];
      if (!slot || slot.itemId !== itemId) continue;
      const removed = Math.min(slot.quantity, remaining);
      slot.quantity -= removed;
      remaining -= removed;
      if (slot.quantity === 0) this.slots[index] = null;
    }
    return true;
  }

  dropFromSlot(index: number, quantity = 1): InventorySlot | null {
    const slot = this.slots[index];
    if (!slot || quantity <= 0) return null;
    const removed = Math.min(quantity, slot.quantity);
    const result = { itemId: slot.itemId, quantity: removed };
    slot.quantity -= removed;
    if (slot.quantity === 0) this.slots[index] = null;
    return result;
  }

  snapshot(): Array<InventorySlot | null> {
    return this.slots.map((slot) => (slot ? { ...slot } : null));
  }

  restore(snapshot: Array<InventorySlot | null>): void {
    this.slots = Array.from({ length: this.slots.length }, (_, index) => {
      const slot = snapshot[index];
      return slot ? { ...slot } : null;
    });
  }

  clone(): InventorySystem {
    return new InventorySystem(this.slots.length, this.snapshot());
  }
}
