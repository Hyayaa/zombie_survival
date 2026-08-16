export const GAME_SETTINGS_KEY = "last-block-settings-v1";

export interface GameSettings {
  version: 1;
  developerMode: boolean;
}

export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  version: 1,
  developerMode: false,
};

export class GameSettingsStore {
  constructor(private readonly storage: SettingsStorage, private readonly key = GAME_SETTINGS_KEY) {}

  load(): GameSettings {
    try {
      const parsed = JSON.parse(this.storage.getItem(this.key) ?? "null") as Partial<GameSettings> | null;
      if (parsed?.version !== 1 || typeof parsed.developerMode !== "boolean") return { ...DEFAULT_GAME_SETTINGS };
      return { version: 1, developerMode: parsed.developerMode };
    } catch {
      return { ...DEFAULT_GAME_SETTINGS };
    }
  }

  save(settings: GameSettings): boolean {
    try {
      this.storage.setItem(this.key, JSON.stringify({ version: 1, developerMode: settings.developerMode }));
      return true;
    } catch {
      return false;
    }
  }

  setDeveloperMode(enabled: boolean): GameSettings {
    const settings: GameSettings = { version: 1, developerMode: enabled };
    this.save(settings);
    return settings;
  }
}
