import type { Player } from "../entities/player";
import type { InventorySystem } from "./inventory-system";

export function initializeNewGameLoadout(
  inventory: Pick<InventorySystem, "add">,
  player: Pick<Player, "unlockWeapon">,
): void {
  inventory.add("bandage", 1);
  inventory.add("water", 1);
  inventory.add("pistol_ammo", 20);
  player.unlockWeapon("pistol");
}
