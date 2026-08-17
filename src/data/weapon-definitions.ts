export type WeaponId = "knife" | "bat" | FirearmId;
export type FirearmId = "pistol" | "smg" | "shotgun" | "hunting_rifle";
export type FireMode = "semi" | "auto";

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  kind: "melee" | "ranged";
  damage: number;
  range: number;
  arcRadians: number;
  cooldownMs: number;
  noise: number;
  knockback: number;
  maxTargets: number;
  magazineSize?: number;
  reloadMs?: number;
  ammoItemId?: string;
  fireMode?: FireMode;
  pelletCount?: number;
  spreadRadians?: number;
  inventoryFootprint: { width: number; height: number };
}

export const WEAPON_DEFINITIONS: Record<WeaponId, WeaponDefinition> = {
  knife: { id: "knife", name: "식칼", kind: "melee", damage: 24, range: 28, arcRadians: 0.9, cooldownMs: 330, noise: 15, knockback: 8, maxTargets: 1, inventoryFootprint:{width:2,height:1} },
  bat: { id: "bat", name: "야구방망이", kind: "melee", damage: 20, range: 38, arcRadians: 1.45, cooldownMs: 680, noise: 24, knockback: 28, maxTargets: 4, inventoryFootprint:{width:3,height:1} },
  pistol: { id: "pistol", name: "권총", kind: "ranged", damage: 34, range: 260, arcRadians: 0, cooldownMs: 260, noise: 90, knockback: 12, maxTargets: 1, magazineSize: 8, reloadMs: 1_050, ammoItemId: "pistol_ammo", fireMode: "semi", pelletCount: 1, spreadRadians: 0, inventoryFootprint:{width:2,height:1} },
  smg: { id: "smg", name: "기관단총", kind: "ranged", damage: 17, range: 225, arcRadians: 0, cooldownMs: 105, noise: 82, knockback: 6, maxTargets: 1, magazineSize: 24, reloadMs: 1_400, ammoItemId: "smg_ammo", fireMode: "auto", pelletCount: 1, spreadRadians: 0.045, inventoryFootprint:{width:3,height:1} },
  shotgun: { id: "shotgun", name: "산탄총", kind: "ranged", damage: 13, range: 175, arcRadians: 0, cooldownMs: 720, noise: 120, knockback: 19, maxTargets: 1, magazineSize: 6, reloadMs: 1_650, ammoItemId: "shotgun_shell", fireMode: "semi", pelletCount: 6, spreadRadians: 0.3, inventoryFootprint:{width:4,height:1} },
  hunting_rifle: { id: "hunting_rifle", name: "사냥용 소총", kind: "ranged", damage: 68, range: 430, arcRadians: 0, cooldownMs: 920, noise: 135, knockback: 22, maxTargets: 1, magazineSize: 5, reloadMs: 1_850, ammoItemId: "rifle_ammo", fireMode: "semi", pelletCount: 1, spreadRadians: 0.012, inventoryFootprint:{width:4,height:1} },
};

export const FIREARM_IDS: readonly FirearmId[] = ["pistol", "smg", "shotgun", "hunting_rifle"];

export function isFirearmId(value: string): value is FirearmId {
  return (FIREARM_IDS as readonly string[]).includes(value);
}

