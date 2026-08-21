import { ITEM_DEFINITIONS, type InventoryFootprint, type StorageEquipmentDefinition } from "./item-definitions";
import { WEAPON_DEFINITIONS, type WeaponId } from "./weapon-definitions";

export interface InventoryObjectDefinition {
  id: string; name: string; description: string; maxStack: number; iconColor: number;
  inventoryFootprint: InventoryFootprint; storageEquipment?: StorageEquipmentDefinition;
}

export function isWeaponItemId(id: string): id is WeaponId { return id in WEAPON_DEFINITIONS; }

export function getInventoryObjectDefinition(id: string): InventoryObjectDefinition {
  const item = ITEM_DEFINITIONS[id];
  if (item) return item;
  const weapon = WEAPON_DEFINITIONS[id as WeaponId];
  if (!weapon) throw new Error(`Unknown inventory object: ${id}`);
  return {
    id: weapon.id, name: weapon.name, maxStack: 1, iconColor: weapon.kind === "ranged" ? 0x879395 : 0xa4815b,
    description: weapon.kind === "ranged" ? `사거리 ${weapon.range} · 피해 ${weapon.damage}` : `근접 사거리 ${weapon.range} · 피해 ${weapon.damage}`,
    inventoryFootprint: weapon.inventoryFootprint,
  };
}
