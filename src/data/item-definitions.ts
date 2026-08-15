export type ItemCategory = "food" | "medical" | "material" | "ammo" | "tool" | "quest";

export interface ItemDefinition {
  id: string;
  name: string;
  category: ItemCategory;
  maxStack: number;
  iconColor: number;
  description: string;
}

const ITEMS: ItemDefinition[] = [
  { id: "canned_food", name: "통조림", category: "food", maxStack: 5, iconColor: 0xb9a06d, description: "허기를 달래고 체력을 조금 회복한다." },
  { id: "water", name: "물", category: "food", maxStack: 5, iconColor: 0x77a9b4, description: "마시거나 빈 병을 화염병 재료로 쓴다." },
  { id: "cloth", name: "천", category: "material", maxStack: 12, iconColor: 0xb4aaa0, description: "붕대와 광원 제작 재료." },
  { id: "wood", name: "목재", category: "material", maxStack: 12, iconColor: 0x9b744b, description: "횃불과 바리케이드 제작 재료." },
  { id: "metal", name: "금속", category: "material", maxStack: 12, iconColor: 0x899397, description: "탄약과 바리케이드 제작 재료." },
  { id: "fuel", name: "연료", category: "quest", maxStack: 6, iconColor: 0xd19b4a, description: "광원·화염 제작과 탈출 차량에 필요하다." },
  { id: "medicine", name: "약품", category: "medical", maxStack: 4, iconColor: 0x9ecf91, description: "감염도를 24 낮춘다." },
  { id: "ammo", name: "권총탄", category: "ammo", maxStack: 36, iconColor: 0xd6c477, description: "권총 예비 탄약." },
  { id: "battery", name: "차량 배터리", category: "quest", maxStack: 2, iconColor: 0x96b8cf, description: "손전등을 충전하거나 탈출 차량에 사용한다." },
  { id: "engine_part", name: "엔진 부품", category: "quest", maxStack: 1, iconColor: 0xb4b8ab, description: "탈출 차량 수리에 필요한 핵심 부품." },
  { id: "bandage", name: "붕대", category: "medical", maxStack: 5, iconColor: 0xe4ddd0, description: "체력을 28 회복한다." },
  { id: "torch", name: "횃불", category: "tool", maxStack: 3, iconColor: 0xe27d43, description: "90초 동안 주변 시야를 넓힌다." },
  { id: "barricade", name: "간이 바리케이드", category: "tool", maxStack: 2, iconColor: 0x8d6745, description: "조준한 통로에 임시 장애물을 설치한다." },
  { id: "molotov", name: "화염병", category: "tool", maxStack: 2, iconColor: 0xcf5d42, description: "조준 지점에 짧은 범위 화염을 만든다." },
  { id: "scrap_cache", name: "잡동사니", category: "material", maxStack: 8, iconColor: 0x736d61, description: "분해해 쓸 수 있는 잡다한 생존 물자." },
];

export const ITEM_DEFINITIONS: Readonly<Record<string, ItemDefinition>> = Object.freeze(
  Object.fromEntries(ITEMS.map((item) => [item.id, item])),
);

export function getItemDefinition(id: string): ItemDefinition {
  const definition = ITEM_DEFINITIONS[id];
  if (!definition) throw new Error(`Unknown item: ${id}`);
  return definition;
}

