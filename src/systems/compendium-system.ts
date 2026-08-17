import { getItemDevGrantAmount, ITEM_DEFINITIONS, type ItemCategory } from "../data/item-definitions";
import { WEAPON_DEFINITIONS, type WeaponId } from "../data/weapon-definitions";

export type CompendiumCategory = ItemCategory | "weapon";
export interface CompendiumEntry { id: string; sourceId: string; kind: "item" | "weapon"; name: string; description: string; category: CompendiumCategory; maxStack?: number; devGrantAmount: number; color: number }

export function createCompendiumEntries(): CompendiumEntry[] {
  const entries: CompendiumEntry[] = [];
  for (const item of Object.values(ITEM_DEFINITIONS)) entries.push({ id: `item:${item.id}`, sourceId: item.id, kind: "item", name: item.name, description: item.description, category: item.category, maxStack: item.maxStack, devGrantAmount: getItemDevGrantAmount(item), color: item.iconColor });
  for (const weapon of Object.values(WEAPON_DEFINITIONS)) entries.push({ id: `weapon:${weapon.id}`, sourceId: weapon.id, kind: "weapon", name: weapon.name, description: weapon.kind === "ranged" ? `사거리 ${weapon.range} · 피해 ${weapon.damage}` : `근접 사거리 ${weapon.range} · 피해 ${weapon.damage}`, category: "weapon", devGrantAmount: 1, color: weapon.kind === "ranged" ? 0x8d9693 : 0xa4815b });
  return entries.sort((a, b) => a.name.localeCompare(b.name, "ko") || a.id.localeCompare(b.id));
}

export function filterCompendiumEntries(entries: readonly CompendiumEntry[], query: string, category: CompendiumCategory | "all"): CompendiumEntry[] {
  const normalized = query.trim().toLocaleLowerCase("ko");
  return entries.filter((entry) => (category === "all" || entry.category === category) && (!normalized || entry.name.toLocaleLowerCase("ko").includes(normalized) || entry.description.toLocaleLowerCase("ko").includes(normalized)));
}

export interface CompendiumGrantAccess { developerMode: boolean; canAdd(itemId: string, amount: number): boolean; add(itemId: string, amount: number): number; hasWeapon(id: WeaponId): boolean; unlockWeapon(id: WeaponId): void; syncObjectives(): void }
export interface CompendiumGrantResult { success: boolean; reason?: "developer-mode-off" | "inventory-full" | "already-unlocked"; amount: number; entry: CompendiumEntry }

export function grantCompendiumEntry(entry: CompendiumEntry, access: CompendiumGrantAccess): CompendiumGrantResult {
  if (!access.developerMode) return { success: false, reason: "developer-mode-off", amount: 0, entry };
  if (entry.kind === "weapon") {
    const weaponId = entry.sourceId as WeaponId;
    if (access.hasWeapon(weaponId)) return { success: false, reason: "already-unlocked", amount: 0, entry };
    access.unlockWeapon(weaponId); return { success: true, amount: 1, entry };
  }
  if (!access.canAdd(entry.sourceId, entry.devGrantAmount)) return { success: false, reason: "inventory-full", amount: 0, entry };
  const amount = access.add(entry.sourceId, entry.devGrantAmount);
  if (amount > 0) access.syncObjectives();
  return { success: amount === entry.devGrantAmount, amount, entry, reason: amount ? undefined : "inventory-full" };
}
