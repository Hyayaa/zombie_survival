export const ZOMBIE_RESTORE_BATCH_SIZE = 3;
export const ZOMBIE_RESTORE_INTERVAL_MS = 160;

export interface ZombieSpawnToggleState {
  enabled: boolean;
  nextRestoreAt: number;
}

export function createZombieSpawnToggleState(enabled = true): ZombieSpawnToggleState {
  return { enabled, nextRestoreAt: 0 };
}

export function setZombieSpawnToggle(state: ZombieSpawnToggleState, enabled: boolean, now: number): "enabled" | "disabled" | "unchanged" {
  if (state.enabled === enabled) return "unchanged";
  state.enabled = enabled;
  state.nextRestoreAt = enabled ? now : Number.POSITIVE_INFINITY;
  return enabled ? "enabled" : "disabled";
}

export function consumeZombieRestoreBatch(state: ZombieSpawnToggleState, now: number): number {
  if (!state.enabled || now < state.nextRestoreAt) return 0;
  state.nextRestoreAt = now + ZOMBIE_RESTORE_INTERVAL_MS;
  return ZOMBIE_RESTORE_BATCH_SIZE;
}

export function canSpawnZombies(state: Readonly<ZombieSpawnToggleState>): boolean {
  return state.enabled;
}
