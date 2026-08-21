export type CraftingStationKind = "hand" | "makeshift" | "plank" | "technical";

export const CRAFTING_STATION_TIER: Readonly<Record<CraftingStationKind, number>> = Object.freeze({ hand: 0, makeshift: 1, plank: 2, technical: 3 });
export const CRAFTING_STATION_LABEL: Readonly<Record<CraftingStationKind, string>> = Object.freeze({ hand: "맨손", makeshift: "간이 제작대", plank: "판자 제작대", technical: "기술 제작대" });

export interface RecipeDefinition {
  id: string;
  name: string;
  resultItemId: string;
  resultQuantity: number;
  ingredients: Record<string, number>;
  craftTimeMs: number;
  noiseIntensity: number;
  requiredStation: CraftingStationKind;
}

export const RECIPE_DEFINITIONS: readonly RecipeDefinition[] = [
  { id: "bandage", name: "붕대", resultItemId: "bandage", resultQuantity: 1, ingredients: { cloth: 2 }, craftTimeMs: 1_200, noiseIntensity: 5, requiredStation: "hand" },
  { id: "torch", name: "횃불", resultItemId: "torch", resultQuantity: 1, ingredients: { wood: 1, cloth: 1, fuel: 1 }, craftTimeMs: 1_800, noiseIntensity: 12, requiredStation: "hand" },
  { id: "pistol_ammo", name: "권총탄 8발", resultItemId: "pistol_ammo", resultQuantity: 8, ingredients: { metal: 1, fuel: 1 }, craftTimeMs: 2_400, noiseIntensity: 18, requiredStation: "makeshift" },
  { id: "smg_ammo", name: "기관단총탄 12발", resultItemId: "smg_ammo", resultQuantity: 12, ingredients: { metal: 2, fuel: 1 }, craftTimeMs: 2_700, noiseIntensity: 20, requiredStation: "plank" },
  { id: "shotgun_shell", name: "산탄 4발", resultItemId: "shotgun_shell", resultQuantity: 4, ingredients: { metal: 2, cloth: 1 }, craftTimeMs: 2_800, noiseIntensity: 22, requiredStation: "makeshift" },
  { id: "rifle_ammo", name: "소총탄 5발", resultItemId: "rifle_ammo", resultQuantity: 5, ingredients: { metal: 2, fuel: 1 }, craftTimeMs: 3_000, noiseIntensity: 24, requiredStation: "plank" },
  { id: "barricade", name: "간이 바리케이드", resultItemId: "barricade", resultQuantity: 1, ingredients: { wood: 3, metal: 1 }, craftTimeMs: 3_000, noiseIntensity: 24, requiredStation: "hand" },
  { id: "molotov", name: "화염병", resultItemId: "molotov", resultQuantity: 1, ingredients: { water: 1, cloth: 1, fuel: 2 }, craftTimeMs: 2_000, noiseIntensity: 15, requiredStation: "hand" },
  { id: "makeshift_workbench_kit", name: "간이 제작대 키트", resultItemId: "makeshift_workbench_kit", resultQuantity: 1, ingredients: { wood: 4, cloth: 2, duct_tape: 1 }, craftTimeMs: 3_200, noiseIntensity: 22, requiredStation: "hand" },
  { id: "plank_workbench_kit", name: "판자 제작대 키트", resultItemId: "plank_workbench_kit", resultQuantity: 1, ingredients: { wood: 8, screws: 4, duct_tape: 2 }, craftTimeMs: 4_400, noiseIntensity: 28, requiredStation: "makeshift" },
  { id: "technical_workbench_kit", name: "기술 제작대 키트", resultItemId: "technical_workbench_kit", resultQuantity: 1, ingredients: { steel_plate: 4, screws: 8, circuit_board: 2, electric_motor: 1, duct_tape: 2 }, craftTimeMs: 6_500, noiseIntensity: 36, requiredStation: "plank" },
  { id: "turret_kit", name: "터렛 키트", resultItemId: "turret_kit", resultQuantity: 1, ingredients: { steel_plate: 2, screws: 6, circuit_board: 1, electric_motor: 1, duct_tape: 1 }, craftTimeMs: 5_000, noiseIntensity: 34, requiredStation: "technical" },
  { id: "solar_generator_kit", name: "태양광 발전기 키트", resultItemId: "solar_generator_kit", resultQuantity: 1, ingredients: { solar_panel: 2, steel_plate: 2, screws: 4, duct_tape: 1 }, craftTimeMs: 5_500, noiseIntensity: 30, requiredStation: "plank" },
  { id: "fuel_generator_kit", name: "연료 발전기 키트", resultItemId: "fuel_generator_kit", resultQuantity: 1, ingredients: { steel_plate: 3, screws: 6, electric_motor: 1, duct_tape: 1 }, craftTimeMs: 6_000, noiseIntensity: 38, requiredStation: "plank" },
  { id: "battery_bank_kit", name: "축전지 키트", resultItemId: "battery_bank_kit", resultQuantity: 1, ingredients: { steel_plate: 2, screws: 4, circuit_board: 1, duct_tape: 1 }, craftTimeMs: 5_000, noiseIntensity: 28, requiredStation: "plank" },
  { id: "generator_fuel", name: "발전기 연료", resultItemId: "generator_fuel", resultQuantity: 1, ingredients: { scrap_cache: 1, cloth: 1 }, craftTimeMs: 1_600, noiseIntensity: 10, requiredStation: "makeshift" },
];

