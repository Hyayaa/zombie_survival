import { describe, expect, it } from "vitest";
import { InventorySystem } from "../systems/inventory-system";
import { getInventoryContainerDisplayName, getStorageRows, getTemporaryEquipmentDropSlot } from "../ui/inventory-panel";

describe("equipped storage rows", () => {
  it("shows underwear and equipped storage only", () => {
    const inventory = new InventorySystem();
    expect(getStorageRows(inventory.getContainers()).map((row) => row.kind)).toEqual(["pockets", "shirt", "pants"]);
    expect(getInventoryContainerDisplayName("pockets")).toBe("속옷");
    expect(inventory.getContainers().find((container) => container.kind === "pockets")?.id).toBe("pockets");
  });

  it("removes an unequipped row from the view model instead of hiding it", () => {
    const inventory = new InventorySystem();
    expect(inventory.unequip("shirt")).toBe(true);
    const kinds = getStorageRows(inventory.getContainers()).map((row) => row.kind);
    expect(kinds).toEqual(["pockets", "pants"]);
    expect(kinds).not.toContain("shirt");
    expect(kinds).not.toEqual(expect.arrayContaining(["belt", "vest", "backpack"]));
  });

  it("offers only a compatible empty equipment target during a container drag", () => {
    expect(getTemporaryEquipmentDropSlot("basic_tshirt", {})).toBe("shirt");
    expect(getTemporaryEquipmentDropSlot("basic_tshirt", { shirt: "item-1" })).toBeNull();
    expect(getTemporaryEquipmentDropSlot("school_backpack", {})).toBe("backpack");
    expect(getTemporaryEquipmentDropSlot("knife", {})).toBeNull();
  });
});
