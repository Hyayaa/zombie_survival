import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_SETTINGS, GAME_SETTINGS_KEY, GameSettingsStore, type SettingsStorage } from "../core/game-settings";
import { pauseEscapeAction } from "../ui/pause-menu";

class MemorySettingsStorage implements SettingsStorage {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null { return this.data.get(key) ?? null; }
  setItem(key: string, value: string): void { this.data.set(key, value); }
}

describe("GameSettingsStore", () => {
  it("defaults developer mode to false and restores a persisted toggle", () => {
    const storage = new MemorySettingsStorage();
    const first = new GameSettingsStore(storage);
    expect(first.load()).toEqual(DEFAULT_GAME_SETTINGS);
    expect(first.setDeveloperMode(true)).toEqual({ ...DEFAULT_GAME_SETTINGS, developerMode: true });
    expect(storage.data.has(GAME_SETTINGS_KEY)).toBe(true);
    expect(new GameSettingsStore(storage).load()).toEqual({ ...DEFAULT_GAME_SETTINGS, developerMode: true });
  });

  it("recovers malformed or incompatible settings without touching game saves", () => {
    const storage = new MemorySettingsStorage();
    storage.data.set(GAME_SETTINGS_KEY, "not-json");
    storage.data.set("last-block-save-v1", "keep-me");
    expect(new GameSettingsStore(storage).load()).toEqual(DEFAULT_GAME_SETTINGS);
    expect(storage.data.get("last-block-save-v1")).toBe("keep-me");
    storage.data.set(GAME_SETTINGS_KEY, JSON.stringify({ version: 2, developerMode: true }));
    expect(new GameSettingsStore(storage).load()).toEqual(DEFAULT_GAME_SETTINGS);
  });

  it("returns from settings before resuming the main pause screen", () => {
    expect(pauseEscapeAction("settings")).toBe("back");
    expect(pauseEscapeAction("main")).toBe("resume");
  });
});
