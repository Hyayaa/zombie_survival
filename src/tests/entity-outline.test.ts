import { describe, expect, it } from "vitest";
import { ENTITY_OUTLINE } from "../config/game-config";
import { EntityOutlineController, entityOutlineColor } from "../rendering/entity-outline";

describe("entity outline states", () => {
  it("uses an exact black normal outline and white interaction outline", () => {
    expect(ENTITY_OUTLINE.normal).toBe(0x000000);
    expect(ENTITY_OUTLINE.interactable).toBe(0xffffff);
    expect(entityOutlineColor("normal")).toBe(0x000000);
    expect(entityOutlineColor("interactable")).toBe(0xffffff);
  });

  it("applies outline colors only when the shared state changes", () => {
    const applied: number[] = [];
    const controller = new EntityOutlineController((color) => applied.push(color));
    expect(controller.setState("normal")).toBe(false);
    expect(controller.setState("interactable")).toBe(true);
    expect(controller.setState("interactable")).toBe(false);
    expect(controller.setState("normal")).toBe(true);
    expect(applied).toEqual([0xffffff, 0x000000]);
  });
});
