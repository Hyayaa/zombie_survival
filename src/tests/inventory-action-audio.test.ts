import { describe, expect, it } from "vitest";
import { AUDIO_CUES, type AudioCue } from "../data/audio-definitions";
import { getItemDefinition } from "../data/item-definitions";

describe("inventory action audio", () => {
  it("defines every requested UI and inventory cue using existing manifest assets", () => {
    const cues: AudioCue[] = ["ui-click", "ui-tab", "inventory-pickup", "inventory-drop", "inventory-invalid", "item-rotate", "equip-clothing", "unequip-clothing", "equip-backpack", "eat-crunch", "eat-soft", "drink"];
    expect(cues.every((cue) => AUDIO_CUES[cue].category === "ui" && AUDIO_CUES[cue].assets.length > 0)).toBe(true);
  });
  it("selects consumption sound from item data", () => {
    expect(getItemDefinition("water").useAudioId).toBe("drink"); expect(getItemDefinition("apple").useAudioId).toBe("eat-crunch"); expect(getItemDefinition("beef").useAudioId).toBe("eat-soft");
  });
});
