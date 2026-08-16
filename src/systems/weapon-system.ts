import { FIREARM_IDS, WEAPON_DEFINITIONS, type FirearmId, type WeaponDefinition } from "../data/weapon-definitions";

export type WeaponMagazines = Record<FirearmId, number>;

export function createWeaponMagazines(initial?: Partial<Record<FirearmId, number>>): WeaponMagazines {
  return Object.fromEntries(FIREARM_IDS.map((id) => [id, clampMagazine(id, initial?.[id] ?? 0)])) as WeaponMagazines;
}

export function clampMagazine(id: FirearmId, rounds: number): number {
  return Math.max(0, Math.min(WEAPON_DEFINITIONS[id].magazineSize ?? 0, Math.floor(rounds)));
}

export function getAmmoItemId(weapon: WeaponDefinition): string | undefined {
  return weapon.kind === "ranged" ? weapon.ammoItemId : undefined;
}

export function createPelletAngles(baseAngle: number, weapon: WeaponDefinition, random: () => number): number[] {
  const count = weapon.kind === "ranged" ? weapon.pelletCount ?? 1 : 0;
  const spread = weapon.spreadRadians ?? 0;
  const angles = new Array<number>(count);
  for (let index = 0; index < count; index += 1) angles[index] = baseAngle + (random() * 2 - 1) * spread;
  return angles;
}
