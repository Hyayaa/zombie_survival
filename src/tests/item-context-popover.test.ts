import { describe, expect, it } from "vitest";
import { getItemContextActions, getPopoverPosition } from "../ui/inventory-panel";

describe("item context popover", () => {
  it("opens right when possible and falls back left within the viewport", () => {
    expect(getPopoverPosition({ left: 10, right: 50, top: 20, width: 40, height: 40 }, { width: 120, height: 80 }, 400, 300)).toEqual({ left: 58, top: 20 });
    expect(getPopoverPosition({ left: 350, right: 390, top: 280, width: 40, height: 40 }, { width: 120, height: 80 }, 400, 300)).toEqual({ left: 222, top: 212 });
  });

  it("offers equipment actions only for wearable items", () => {
    expect(getItemContextActions("bandage")).toEqual(["use", "drop", "quick"]);
    expect(getItemContextActions("utility_vest")).toEqual(["equip", "rotate", "drop"]);
  });
});
