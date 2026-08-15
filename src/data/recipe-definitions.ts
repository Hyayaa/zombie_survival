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
  { id: "ammo", name: "권총탄 6발", resultItemId: "ammo", resultQuantity: 6, ingredients: { metal: 1, fuel: 1 }, craftTimeMs: 2_400, noiseIntensity: 18 },
  { id: "barricade", name: "간이 바리케이드", resultItemId: "barricade", resultQuantity: 1, ingredients: { wood: 3, metal: 1 }, craftTimeMs: 3_000, noiseIntensity: 24 },
  { id: "molotov", name: "화염병", resultItemId: "molotov", resultQuantity: 1, ingredients: { water: 1, cloth: 1, fuel: 2 }, craftTimeMs: 2_000, noiseIntensity: 15 },
];

