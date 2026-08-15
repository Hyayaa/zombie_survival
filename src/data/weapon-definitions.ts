export type WeaponId = "knife" | "bat" | "pistol";

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
}

export const WEAPON_DEFINITIONS: Record<WeaponId, WeaponDefinition> = {
  knife: { id: "knife", name: "식칼", kind: "melee", damage: 24, range: 28, arcRadians: 0.9, cooldownMs: 330, noise: 15, knockback: 8, maxTargets: 1 },
  bat: { id: "bat", name: "야구방망이", kind: "melee", damage: 20, range: 38, arcRadians: 1.45, cooldownMs: 680, noise: 24, knockback: 28, maxTargets: 4 },
  pistol: { id: "pistol", name: "권총", kind: "ranged", damage: 34, range: 260, arcRadians: 0, cooldownMs: 260, noise: 90, knockback: 12, maxTargets: 1, magazineSize: 8, reloadMs: 1_050 },
};

