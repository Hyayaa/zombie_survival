import type { InventorySystem } from "./inventory-system";

export function initializeNewGameLoadout(
  inventory: Pick<InventorySystem, "add" | "getStoredItems" | "equipWeapon" | "setActiveWeaponSlot">,
): void {
  inventory.add("bandage", 1);
  inventory.add("water", 1);
  inventory.add("pistol_ammo", 20);
  inventory.add("knife", 1);
  const knife = inventory.getStoredItems().find((item) => item.itemId === "knife");
  if (knife) inventory.equipWeapon(knife.instanceId, "primary");
  inventory.add("pistol", 1);
  const pistol = inventory.getStoredItems().find((item) => item.itemId === "pistol");
  if (pistol) inventory.equipWeapon(pistol.instanceId, "secondary");
  inventory.setActiveWeaponSlot("secondary");
}
