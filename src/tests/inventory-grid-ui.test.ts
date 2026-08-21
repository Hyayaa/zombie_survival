import { describe, expect, it } from "vitest";
import { InventorySystem } from "../systems/inventory-system";
import { getItemGridStyle } from "../ui/inventory-panel";

describe("inventory grid UI model", () => {
  it("maps every item instance to one positioned rectangle", () => {
    const inventory = new InventorySystem();
    inventory.add("water", 2);
    inventory.add("bandage", 1);
    const styles = inventory.getStoredItems().map(getItemGridStyle);
    expect(styles).toHaveLength(inventory.getStoredItems().length);
    expect(new Set(styles).size).toBe(styles.length);
    expect(styles.some((style) => style.includes("--item-w:1;--item-h:2"))).toBe(true);
  });
});
