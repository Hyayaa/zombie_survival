import type { AudioCue } from "./audio-definitions";

export type ItemCategory = "food" | "medical" | "material" | "ammo" | "tool" | "quest" | "equipment";
export interface InventoryFootprint { width: number; height: number }
export type InventoryRotation = 0 | 1;
export function normalizeInventoryFootprint(footprint: InventoryFootprint): InventoryFootprint {
  return footprint.width >= footprint.height ? { ...footprint } : { width: footprint.height, height: footprint.width };
}
export function getEffectiveFootprint(definition: Pick<ItemDefinition, "inventoryFootprint">, rotation: InventoryRotation): InventoryFootprint {
  const footprint = normalizeInventoryFootprint(definition.inventoryFootprint);
  return rotation === 1 ? { width: footprint.height, height: footprint.width } : { ...footprint };
}
export type StorageSlot = "shirt" | "pants" | "belt" | "vest" | "backpack";
export interface StorageEquipmentDefinition { slot: StorageSlot; containerWidth: number; containerHeight: number }

export interface ConsumableEffect { hunger?: number; thirst?: number; health?: number; infection?: number; stamina?: number }

export interface ItemDefinition {
  id: string;
  name: string;
  category: ItemCategory;
  maxStack: number;
  iconColor: number;
  description: string;
  devGrantAmount?: number;
  consumableEffect?: ConsumableEffect;
  useAudioId?: AudioCue;
  inventoryFootprint: InventoryFootprint;
  storageEquipment?: StorageEquipmentDefinition;
}

type ItemSource = Omit<ItemDefinition, "inventoryFootprint">;
const ITEM_FOOTPRINTS: Readonly<Record<string, InventoryFootprint>> = Object.freeze({
  canned_food:{width:1,height:1},water:{width:1,height:2},cabbage:{width:1,height:1},carrot:{width:1,height:1},potato:{width:1,height:1},apple:{width:1,height:1},beef:{width:1,height:2},pork:{width:1,height:2},
  cloth:{width:1,height:1},wood:{width:2,height:1},metal:{width:1,height:1},screws:{width:1,height:1},steel_plate:{width:2,height:2},solar_panel:{width:2,height:2},duct_tape:{width:1,height:1},circuit_board:{width:1,height:1},electric_motor:{width:1,height:2},
  fuel:{width:1,height:2},medicine:{width:1,height:1},ammo:{width:1,height:1},pistol_ammo:{width:1,height:1},smg_ammo:{width:1,height:1},shotgun_shell:{width:1,height:1},rifle_ammo:{width:1,height:1},battery:{width:2,height:1},engine_part:{width:2,height:2},bandage:{width:1,height:1},torch:{width:1,height:2},barricade:{width:2,height:2},turret_kit:{width:3,height:2},solar_generator_kit:{width:2,height:2},fuel_generator_kit:{width:3,height:2},battery_bank_kit:{width:2,height:2},makeshift_workbench_kit:{width:2,height:2},plank_workbench_kit:{width:2,height:2},technical_workbench_kit:{width:3,height:2},generator_fuel:{width:1,height:1},molotov:{width:1,height:2},scrap_cache:{width:2,height:2},
  basic_tshirt:{width:2,height:2},work_pants:{width:2,height:2},utility_belt:{width:2,height:1},utility_vest:{width:2,height:3},school_backpack:{width:2,height:3},hiking_backpack:{width:3,height:3},military_backpack:{width:3,height:4},
});

const ITEM_SOURCES: ItemSource[] = [
  { id: "canned_food", name: "통조림", category: "food", maxStack: 5, iconColor: 0xb9a06d, description: "허기를 달래고 체력을 조금 회복한다.", consumableEffect: { hunger: 28, health: 10 }, useAudioId: "eat-soft" },
  { id: "water", name: "물", category: "food", maxStack: 5, iconColor: 0x77a9b4, description: "마시거나 빈 병을 화염병 재료로 쓴다.", consumableEffect: { thirst: 35, health: 5 }, useAudioId: "drink" },
  { id: "cabbage", name: "양배추", category: "food", maxStack: 6, iconColor: 0x75a65b, description: "수분이 남은 보존 채소.", consumableEffect: { hunger: 16, thirst: 5 }, useAudioId: "eat-crunch" },
  { id: "carrot", name: "당근", category: "food", maxStack: 8, iconColor: 0xd87935, description: "작지만 든든한 뿌리채소.", consumableEffect: { hunger: 12, thirst: 3 }, useAudioId: "eat-crunch" },
  { id: "potato", name: "감자", category: "food", maxStack: 8, iconColor: 0x9a7548, description: "오래 보관된 감자.", consumableEffect: { hunger: 20 }, useAudioId: "eat-soft" },
  { id: "apple", name: "사과", category: "food", maxStack: 6, iconColor: 0xb94b42, description: "허기와 갈증을 함께 달랜다.", consumableEffect: { hunger: 14, thirst: 10 }, useAudioId: "eat-crunch" },
  { id: "beef", name: "소고기", category: "food", maxStack: 4, iconColor: 0xa54842, description: "바로 먹을 수 있게 포장된 보존육.", consumableEffect: { hunger: 34, health: 3 }, useAudioId: "eat-soft" },
  { id: "pork", name: "돼지고기", category: "food", maxStack: 4, iconColor: 0xd17b78, description: "밀봉 포장된 보존육.", consumableEffect: { hunger: 30, health: 2 }, useAudioId: "eat-soft" },
  { id: "cloth", name: "천", category: "material", maxStack: 12, iconColor: 0xb4aaa0, description: "붕대와 광원 제작 재료." },
  { id: "wood", name: "목재", category: "material", maxStack: 12, iconColor: 0x9b744b, description: "횃불과 바리케이드 제작 재료." },
  { id: "metal", name: "금속", category: "material", maxStack: 12, iconColor: 0x899397, description: "탄약과 바리케이드 제작 재료." },
  { id: "screws", name: "나사", category: "material", maxStack: 40, iconColor: 0xaab3b2, description: "기계 구조물을 조립하는 작은 체결 부품." },
  { id: "steel_plate", name: "철판", category: "material", maxStack: 16, iconColor: 0x758184, description: "발전기와 터렛의 골격 재료." },
  { id: "solar_panel", name: "태양광 패널", category: "material", maxStack: 6, iconColor: 0x416e91, description: "낮의 빛을 전력으로 바꾸는 패널." },
  { id: "duct_tape", name: "테이프", category: "material", maxStack: 12, iconColor: 0x8b8a79, description: "배선과 외장을 임시 고정한다." },
  { id: "circuit_board", name: "회로 기판", category: "material", maxStack: 8, iconColor: 0x4f8b65, description: "전력 장치의 제어 회로." },
  { id: "electric_motor", name: "전동 모터", category: "material", maxStack: 6, iconColor: 0x8a735d, description: "터렛과 발전기에 쓰는 구동부." },
  { id: "fuel", name: "연료", category: "quest", maxStack: 6, iconColor: 0xd19b4a, description: "광원·화염 제작과 탈출 차량에 필요하다." },
  { id: "medicine", name: "약품", category: "medical", maxStack: 4, iconColor: 0x9ecf91, description: "감염도를 24 낮춘다." },
  { id: "ammo", name: "구형 권총탄", category: "ammo", maxStack: 36, iconColor: 0xd6c477, description: "이전 저장과 호환되는 권총탄." },
  { id: "pistol_ammo", name: "권총탄", category: "ammo", maxStack: 48, iconColor: 0xd6c477, description: "권총 예비 탄약." },
  { id: "smg_ammo", name: "기관단총탄", category: "ammo", maxStack: 72, iconColor: 0xd3b96d, description: "기관단총 예비 탄약." },
  { id: "shotgun_shell", name: "산탄", category: "ammo", maxStack: 30, iconColor: 0xb85e49, description: "산탄총용 셸." },
  { id: "rifle_ammo", name: "소총탄", category: "ammo", maxStack: 30, iconColor: 0xc4ab67, description: "사냥용 소총 예비 탄약." },
  { id: "battery", name: "차량 배터리", category: "quest", maxStack: 2, iconColor: 0x96b8cf, description: "손전등을 충전하거나 탈출 차량에 사용한다." },
  { id: "engine_part", name: "엔진 부품", category: "quest", maxStack: 1, iconColor: 0xb4b8ab, description: "탈출 차량 수리에 필요한 핵심 부품." },
  { id: "bandage", name: "붕대", category: "medical", maxStack: 5, iconColor: 0xe4ddd0, description: "체력을 28 회복한다." },
  { id: "torch", name: "횃불", category: "tool", maxStack: 3, iconColor: 0xe27d43, description: "90초 동안 주변 시야를 넓힌다." },
  { id: "barricade", name: "간이 바리케이드", category: "tool", maxStack: 2, iconColor: 0x8d6745, description: "조준한 통로에 임시 장애물을 설치한다." },
  { id: "turret_kit", name: "터렛 키트", category: "tool", maxStack: 3, iconColor: 0x71928f, description: "전력망에 연결할 자동 터렛." },
  { id: "solar_generator_kit", name: "태양광 발전기 키트", category: "tool", maxStack: 3, iconColor: 0x456c8a, description: "실외에서 낮 동안 발전한다." },
  { id: "fuel_generator_kit", name: "연료 발전기 키트", category: "tool", maxStack: 3, iconColor: 0x68745c, description: "발전기 연료로 안정적인 전력을 만든다." },
  { id: "battery_bank_kit", name: "축전지 키트", category: "tool", maxStack: 3, iconColor: 0x59656b, description: "전력망의 남는 전력을 저장한다." },
  { id: "makeshift_workbench_kit", name: "간이 제작대 키트", category: "tool", maxStack: 1, iconColor: 0x8d6f4a, description: "기초 탄약과 판자 제작대를 만들 수 있는 2×2 제작대." },
  { id: "plank_workbench_kit", name: "판자 제작대 키트", category: "tool", maxStack: 1, iconColor: 0xa07b4f, description: "정교한 탄약과 전력 설비를 만들 수 있는 2×2 제작대." },
  { id: "technical_workbench_kit", name: "기술 제작대 키트", category: "tool", maxStack: 1, iconColor: 0x557b78, description: "고급 기계 장비를 조립할 수 있는 3×2 제작대." },
  { id: "generator_fuel", name: "발전기 연료", category: "material", maxStack: 8, iconColor: 0xb37a3e, description: "연료 발전기 전용 연료. 탈출 연료와 별개다." },
  { id: "molotov", name: "화염병", category: "tool", maxStack: 2, iconColor: 0xcf5d42, description: "조준 지점에 짧은 범위 화염을 만든다." },
  { id: "scrap_cache", name: "잡동사니", category: "material", maxStack: 8, iconColor: 0x736d61, description: "분해해 쓸 수 있는 잡다한 생존 물자." },
  { id: "basic_tshirt", name: "기본 티셔츠", category: "equipment", maxStack: 1, iconColor: 0xa9aaa2, description: "작은 수납공간이 달린 기본 상의.", storageEquipment:{slot:"shirt",containerWidth:4,containerHeight:2} },
  { id: "work_pants", name: "작업 바지", category: "equipment", maxStack: 1, iconColor: 0x59685f, description: "튼튼한 주머니가 달린 작업 바지.", storageEquipment:{slot:"pants",containerWidth:4,containerHeight:2} },
  { id: "utility_belt", name: "공구 벨트", category: "equipment", maxStack: 1, iconColor: 0x8d6a43, description: "작은 도구를 빠르게 꺼내는 벨트.", storageEquipment:{slot:"belt",containerWidth:4,containerHeight:1} },
  { id: "utility_vest", name: "다용도 조끼", category: "equipment", maxStack: 1, iconColor: 0x687557, description: "여러 칸의 파우치가 달린 조끼.", storageEquipment:{slot:"vest",containerWidth:4,containerHeight:3} },
  { id: "school_backpack", name: "학생용 가방", category: "equipment", maxStack: 1, iconColor: 0x557b8d, description: "작고 다루기 쉬운 학생용 가방.", storageEquipment:{slot:"backpack",containerWidth:4,containerHeight:4} },
  { id: "hiking_backpack", name: "등산용 가방", category: "equipment", maxStack: 1, iconColor: 0x697852, description: "장거리 이동용 대형 등산 가방.", storageEquipment:{slot:"backpack",containerWidth:5,containerHeight:5} },
  { id: "military_backpack", name: "군용 가방", category: "equipment", maxStack: 1, iconColor: 0x4d5945, description: "가장 넓은 수납공간을 가진 군용 가방.", storageEquipment:{slot:"backpack",containerWidth:6,containerHeight:6} },
];

const ITEMS: ItemDefinition[] = ITEM_SOURCES.map((item) => {
  const inventoryFootprint = ITEM_FOOTPRINTS[item.id];
  if (!inventoryFootprint) throw new Error(`Missing inventory footprint: ${item.id}`);
  return { ...item, inventoryFootprint: normalizeInventoryFootprint(inventoryFootprint) };
});

export const ITEM_DEFINITIONS: Readonly<Record<string, ItemDefinition>> = Object.freeze(
  Object.fromEntries(ITEMS.map((item) => [item.id, item])),
);

export function getItemDevGrantAmount(item: ItemDefinition): number {
  return item.devGrantAmount ?? (item.category === "ammo" ? 20 : item.category === "material" ? 5 : 1);
}

export function getItemDefinition(id: string): ItemDefinition {
  const definition = ITEM_DEFINITIONS[id];
  if (!definition) throw new Error(`Unknown item: ${id}`);
  return definition;
}

export function getEquipmentStorageDescription(item: Pick<ItemDefinition, "inventoryFootprint" | "storageEquipment">): string | null {
  const storage = item.storageEquipment; if (!storage) return null;
  const slotLabel: Record<StorageSlot, string> = { shirt: "상의", pants: "바지", belt: "벨트", vest: "조끼", backpack: "가방" };
  return `아이템 크기 ${item.inventoryFootprint.width}×${item.inventoryFootprint.height} · 수납공간 ${storage.containerWidth}×${storage.containerHeight} · 총 ${storage.containerWidth * storage.containerHeight}칸 · 장착 위치 ${slotLabel[storage.slot]}`;
}

