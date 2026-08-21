import { describe, expect, it } from "vitest";
import { getEquipmentStorageDescription, getItemDefinition } from "../data/item-definitions";
import { createCompendiumEntries } from "../systems/compendium-system";

describe("equipment storage descriptions", () => {
  it("uses the same dimensions and total cells for inventory and compendium text", () => {
    const description = getEquipmentStorageDescription(getItemDefinition("basic_tshirt"));
    expect(description).toBe("아이템 크기 2×2 · 수납공간 2×4 · 총 8칸 · 장착 위치 상의");
    expect(createCompendiumEntries().find((entry) => entry.id === "item:basic_tshirt")?.description).toContain(description);
    for (const id of ["work_pants", "utility_belt", "utility_vest", "school_backpack", "hiking_backpack", "military_backpack"]) expect(getEquipmentStorageDescription(getItemDefinition(id))).toMatch(/수납공간 \d×\d · 총 \d+칸/);
    expect(createCompendiumEntries().find((entry) => entry.id === "weapon:shotgun")?.description).not.toContain("수납공간");
  });
});
