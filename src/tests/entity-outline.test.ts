import { describe, expect, it } from "vitest";
import { ENTITY_OUTLINE } from "../config/game-config";
import { entityOutlineColor } from "../rendering/entity-outline";

describe("entity outline states", () => {
  it("uses an exact black normal outline and white interaction outline", () => {
    expect(ENTITY_OUTLINE.normal).toBe(0x000000);
    expect(ENTITY_OUTLINE.interactable).toBe(0xffffff);
    expect(entityOutlineColor("normal")).toBe(0x000000);
    expect(entityOutlineColor("interactable")).toBe(0xffffff);
  });
});
