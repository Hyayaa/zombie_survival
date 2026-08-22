import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_SETTINGS, GameSettingsStore, type SettingsStorage } from "../core/game-settings";
import { canSpawnZombies, consumeZombieRestoreBatch, createZombieSpawnToggleState, setZombieSpawnToggle, ZOMBIE_RESTORE_BATCH_SIZE, ZOMBIE_RESTORE_INTERVAL_MS } from "../systems/zombie-spawn-toggle";

class MemoryStorage implements SettingsStorage { value: string | null = null; getItem(): string | null { return this.value; } setItem(_key: string, value: string): void { this.value = value; } }

describe("zombie spawn test toggle", () => {
  it("defaults to on", () => expect(DEFAULT_GAME_SETTINGS.zombieSpawningEnabled).toBe(true));
  it("creates an enabled gate by default", () => expect(canSpawnZombies(createZombieSpawnToggleState())).toBe(true));
  it("creates a disabled gate explicitly", () => expect(canSpawnZombies(createZombieSpawnToggleState(false))).toBe(false));
  it("reports disabled transition", () => expect(setZombieSpawnToggle(createZombieSpawnToggleState(), false, 10)).toBe("disabled"));
  it("reports enabled transition", () => expect(setZombieSpawnToggle(createZombieSpawnToggleState(false), true, 10)).toBe("enabled"));
  it("reports unchanged transitions", () => expect(setZombieSpawnToggle(createZombieSpawnToggleState(), true, 10)).toBe("unchanged"));
  it("blocks restore batches while off", () => expect(consumeZombieRestoreBatch(createZombieSpawnToggleState(false), 10_000)).toBe(0));
  it("restores a bounded batch immediately after enabling", () => { const state=createZombieSpawnToggleState(false);setZombieSpawnToggle(state,true,500);expect(consumeZombieRestoreBatch(state,500)).toBe(ZOMBIE_RESTORE_BATCH_SIZE); });
  it("does not restore twice inside one interval", () => { const state=createZombieSpawnToggleState();consumeZombieRestoreBatch(state,0);expect(consumeZombieRestoreBatch(state,ZOMBIE_RESTORE_INTERVAL_MS-1)).toBe(0); });
  it("restores again at the interval boundary", () => { const state=createZombieSpawnToggleState();consumeZombieRestoreBatch(state,0);expect(consumeZombieRestoreBatch(state,ZOMBIE_RESTORE_INTERVAL_MS)).toBe(ZOMBIE_RESTORE_BATCH_SIZE); });
  it("persists off independently", () => { const storage=new MemoryStorage();new GameSettingsStore(storage).setZombieSpawningEnabled(false);expect(new GameSettingsStore(storage).load().zombieSpawningEnabled).toBe(false); });
  it("preserves developer mode when zombie setting changes", () => { const storage=new MemoryStorage();const store=new GameSettingsStore(storage);store.setDeveloperMode(true);expect(store.setZombieSpawningEnabled(false).developerMode).toBe(true); });
  it("preserves zombie setting when developer mode changes", () => { const storage=new MemoryStorage();const store=new GameSettingsStore(storage);store.setZombieSpawningEnabled(false);expect(store.setDeveloperMode(true).zombieSpawningEnabled).toBe(false); });
  it("migrates legacy settings with the toggle on", () => { const storage=new MemoryStorage();storage.value=JSON.stringify({version:1,developerMode:true});expect(new GameSettingsStore(storage).load()).toEqual({version:1,developerMode:true,zombieSpawningEnabled:true}); });
});
