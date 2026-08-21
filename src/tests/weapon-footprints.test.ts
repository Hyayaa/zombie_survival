import { describe, expect, it } from "vitest";
import { getEffectiveFootprint } from "../data/item-definitions";
import { WEAPON_DEFINITIONS } from "../data/weapon-definitions";
import { InventorySystem } from "../systems/inventory-system";
import { getEquipmentItemPreviewGeometry } from "../ui/inventory-panel";

describe("weapon inventory footprints", () => {
  it("uses the requested base and rotated dimensions", () => {
    const expected = {
      knife: [{ width: 2, height: 1 }, { width: 1, height: 2 }],
      bat: [{ width: 4, height: 1 }, { width: 1, height: 4 }],
      hunting_rifle: [{ width: 4, height: 2 }, { width: 2, height: 4 }],
    } as const;
    for (const [id, [base, rotated]] of Object.entries(expected)) {
      const definition = WEAPON_DEFINITIONS[id as keyof typeof expected];
      expect(definition.inventoryFootprint).toEqual(base);
      expect(getEffectiveFootprint(definition, 1)).toEqual(rotated);
    }
    expect(Object.keys(WEAPON_DEFINITIONS).filter((id) => /rot|vertical|90/i.test(id))).toEqual([]);
  });

  it("uses the same real footprint in weapon-slot previews", () => {
    const base = getEquipmentItemPreviewGeometry("hunting_rifle", 0);
    const rotated = getEquipmentItemPreviewGeometry("hunting_rifle", 1);
    expect(base.effectiveWidthCells).toBe(4); expect(base.effectiveHeightCells).toBe(2);
    expect(rotated.effectiveWidthCells).toBe(2); expect(rotated.effectiveHeightCells).toBe(4);
  });

  it("repacks an invalid legacy rifle placement without changing its instance id", () => {
    const inventory = new InventorySystem();
    expect(inventory.add("hunting_rifle", 1)).toBe(1);
    const snapshot = inventory.snapshot();
    const rifle = snapshot.items.find((item) => item.itemId === "hunting_rifle")!;
    rifle.x = 2; rifle.y = 1; rifle.width = 4; rifle.height = 1;
    const restored = new InventorySystem(20, snapshot);
    expect(restored.getItem(rifle.instanceId)).toMatchObject({ instanceId: rifle.instanceId, width: 4, height: 2, containerId: "pockets", x: 0, y: 0 });
    expect(restored.takeLegacyOverflow()).toEqual([]);
  });
});
