import { describe, expect, it } from "vitest";
import { InventorySystem } from "../systems/inventory-system";
import { getStorageRows, STORAGE_ROW_ORDER } from "../ui/inventory-panel";

describe("inventory storage rows", () => {
  it("keeps the six equipment rows stable and leaves inactive rows without a grid", () => {
    const rows = getStorageRows(new InventorySystem().getContainers());
    expect(rows.map((row) => row.kind)).toEqual(STORAGE_ROW_ORDER);
    expect(rows.filter((row) => row.container).map((row) => row.kind)).toEqual(["pockets", "shirt", "pants"]);
    expect(rows.find((row) => row.kind === "backpack")?.container).toBeUndefined();
  });
});
