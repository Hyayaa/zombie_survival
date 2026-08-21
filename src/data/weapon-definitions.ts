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
  projectileSpeed?: number;
  projectileRadius?: number;
  projectileVisualLength?: number;
  projectileVisualWidth?: number;
  movingSpreadRadians?: number;
  runningSpreadRadians?: number;
  shotBloomRadians?: number;
  maximumBloomRadians?: number;
  bloomRecoveryRadiansPerSecond?: number;
  inventoryFootprint: { width: number; height: number };
}

export const WEAPON_DEFINITIONS: Record<WeaponId, WeaponDefinition> = {
  knife: { id: "knife", name: "식칼", kind: "melee", damage: 24, range: 28, arcRadians: 0.9, cooldownMs: 330, noise: 15, knockback: 8, maxTargets: 1, inventoryFootprint:{width:2,height:1} },
  bat: { id: "bat", name: "야구방망이", kind: "melee", damage: 20, range: 38, arcRadians: 1.45, cooldownMs: 680, noise: 24, knockback: 28, maxTargets: 4, inventoryFootprint:{width:4,height:1} },
  pistol: { id: "pistol", name: "권총", kind: "ranged", damage: 34, range: 260, arcRadians: 0, cooldownMs: 260, noise: 90, knockback: 12, maxTargets: 1, magazineSize: 8, reloadMs: 1_050, ammoItemId: "pistol_ammo", fireMode: "semi", pelletCount: 1, spreadRadians: 0.012, projectileSpeed: 1100, projectileRadius: 1, projectileVisualLength: 6, projectileVisualWidth: 2, movingSpreadRadians: 0.035, runningSpreadRadians: 0.075, shotBloomRadians: 0.025, maximumBloomRadians: 0.12, bloomRecoveryRadiansPerSecond: 0.14, inventoryFootprint:{width:2,height:2} },
  smg: { id: "smg", name: "기관단총", kind: "ranged", damage: 17, range: 225, arcRadians: 0, cooldownMs: 105, noise: 82, knockback: 6, maxTargets: 1, magazineSize: 24, reloadMs: 1_400, ammoItemId: "smg_ammo", fireMode: "auto", pelletCount: 1, spreadRadians: 0.026, projectileSpeed: 1000, projectileRadius: 1, projectileVisualLength: 5, projectileVisualWidth: 1, movingSpreadRadians: 0.055, runningSpreadRadians: 0.095, shotBloomRadians: 0.018, maximumBloomRadians: 0.16, bloomRecoveryRadiansPerSecond: 0.18, inventoryFootprint:{width:3,height:1} },
  shotgun: { id: "shotgun", name: "산탄총", kind: "ranged", damage: 13, range: 175, arcRadians: 0, cooldownMs: 720, noise: 120, knockback: 19, maxTargets: 1, magazineSize: 6, reloadMs: 1_650, ammoItemId: "shotgun_shell", fireMode: "semi", pelletCount: 6, spreadRadians: 0.3, projectileSpeed: 900, projectileRadius: 1, projectileVisualLength: 4, projectileVisualWidth: 1, movingSpreadRadians: 0.045, runningSpreadRadians: 0.085, shotBloomRadians: 0.065, maximumBloomRadians: 0.18, bloomRecoveryRadiansPerSecond: 0.13, inventoryFootprint:{width:2,height:4} },
  hunting_rifle: { id: "hunting_rifle", name: "사냥용 소총", kind: "ranged", damage: 68, range: 430, arcRadians: 0, cooldownMs: 920, noise: 135, knockback: 22, maxTargets: 1, magazineSize: 5, reloadMs: 1_850, ammoItemId: "rifle_ammo", fireMode: "semi", pelletCount: 1, spreadRadians: 0.006, projectileSpeed: 1600, projectileRadius: 1, projectileVisualLength: 10, projectileVisualWidth: 2, movingSpreadRadians: 0.04, runningSpreadRadians: 0.08, shotBloomRadians: 0.055, maximumBloomRadians: 0.13, bloomRecoveryRadiansPerSecond: 0.11, inventoryFootprint:{width:4,height:2} },
};

export const FIREARM_IDS: readonly FirearmId[] = ["pistol", "smg", "shotgun", "hunting_rifle"];

export function isFirearmId(value: string): value is FirearmId {
  return (FIREARM_IDS as readonly string[]).includes(value);
}

