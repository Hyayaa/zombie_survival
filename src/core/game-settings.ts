export const GAME_SETTINGS_KEY = "last-block-settings-v1";

export interface GameSettings {
  version: 1;
  developerMode: boolean;
  zombieSpawningEnabled: boolean;
}

export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  version: 1,
  developerMode: false,
  zombieSpawningEnabled: true,
};

export class GameSettingsStore {
  constructor(private readonly storage: SettingsStorage, private readonly key = GAME_SETTINGS_KEY) {}

  load(): GameSettings {
    try {
      const parsed = JSON.parse(this.storage.getItem(this.key) ?? "null") as Partial<GameSettings> | null;
      if (parsed?.version !== 1 || typeof parsed.developerMode !== "boolean") return { ...DEFAULT_GAME_SETTINGS };
      return { version: 1, developerMode: parsed.developerMode, zombieSpawningEnabled: parsed.zombieSpawningEnabled !== false };
    } catch {
      return { ...DEFAULT_GAME_SETTINGS };
    }
  }

  save(settings: GameSettings): boolean {
    try {
      this.storage.setItem(this.key, JSON.stringify(settings));
      return true;
    } catch {
      return false;
    }
  }

  setDeveloperMode(enabled: boolean): GameSettings {
    const settings: GameSettings = { ...this.load(), developerMode: enabled };
    this.save(settings);
    return settings;
  }

  setZombieSpawningEnabled(enabled: boolean): GameSettings {
    const settings: GameSettings = { ...this.load(), zombieSpawningEnabled: enabled };
    this.save(settings);
    return settings;
  }
}
