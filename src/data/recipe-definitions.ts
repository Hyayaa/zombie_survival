export interface RecipeDefinition {
  id: string;
  name: string;
  resultItemId: string;
  resultQuantity: number;
  ingredients: Record<string, number>;
  craftTimeMs: number;
  noiseIntensity: number;
}

export const RECIPE_DEFINITIONS: readonly RecipeDefinition[] = [
  { id: "bandage", name: "붕대", resultItemId: "bandage", resultQuantity: 1, ingredients: { cloth: 2 }, craftTimeMs: 1_200, noiseIntensity: 5 },
  { id: "torch", name: "횃불", resultItemId: "torch", resultQuantity: 1, ingredients: { wood: 1, cloth: 1, fuel: 1 }, craftTimeMs: 1_800, noiseIntensity: 12 },
  { id: "pistol_ammo", name: "권총탄 8발", resultItemId: "pistol_ammo", resultQuantity: 8, ingredients: { metal: 1, fuel: 1 }, craftTimeMs: 2_400, noiseIntensity: 18 },
  { id: "smg_ammo", name: "기관단총탄 12발", resultItemId: "smg_ammo", resultQuantity: 12, ingredients: { metal: 2, fuel: 1 }, craftTimeMs: 2_700, noiseIntensity: 20 },
  { id: "shotgun_shell", name: "산탄 4발", resultItemId: "shotgun_shell", resultQuantity: 4, ingredients: { metal: 2, cloth: 1 }, craftTimeMs: 2_800, noiseIntensity: 22 },
  { id: "rifle_ammo", name: "소총탄 5발", resultItemId: "rifle_ammo", resultQuantity: 5, ingredients: { metal: 2, fuel: 1 }, craftTimeMs: 3_000, noiseIntensity: 24 },
  { id: "barricade", name: "간이 바리케이드", resultItemId: "barricade", resultQuantity: 1, ingredients: { wood: 3, metal: 1 }, craftTimeMs: 3_000, noiseIntensity: 24 },
  { id: "molotov", name: "화염병", resultItemId: "molotov", resultQuantity: 1, ingredients: { water: 1, cloth: 1, fuel: 2 }, craftTimeMs: 2_000, noiseIntensity: 15 },
  { id: "turret_kit", name: "터렛 키트", resultItemId: "turret_kit", resultQuantity: 1, ingredients: { metal: 5, scrap_cache: 2 }, craftTimeMs: 5_000, noiseIntensity: 34 },
  { id: "solar_generator_kit", name: "태양광 발전기 키트", resultItemId: "solar_generator_kit", resultQuantity: 1, ingredients: { metal: 4, scrap_cache: 2 }, craftTimeMs: 5_500, noiseIntensity: 30 },
  { id: "fuel_generator_kit", name: "연료 발전기 키트", resultItemId: "fuel_generator_kit", resultQuantity: 1, ingredients: { metal: 5, wood: 2, scrap_cache: 2 }, craftTimeMs: 6_000, noiseIntensity: 38 },
  { id: "battery_bank_kit", name: "축전지 키트", resultItemId: "battery_bank_kit", resultQuantity: 1, ingredients: { metal: 4, scrap_cache: 2 }, craftTimeMs: 5_000, noiseIntensity: 28 },
  { id: "generator_fuel", name: "발전기 연료", resultItemId: "generator_fuel", resultQuantity: 1, ingredients: { scrap_cache: 1, cloth: 1 }, craftTimeMs: 1_600, noiseIntensity: 10 },
];

