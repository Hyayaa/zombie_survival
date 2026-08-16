import type { SavedBarricadeState, SavedDoorState } from "../core/save-state";
import type { DoorDefinition } from "../data/map-definitions";

export type DestructibleObstacleKind = "door" | "barricade";

export interface DestructibleObstacleState {
  id: string;
  kind: DestructibleObstacleKind;
  tileX: number;
  tileY: number;
  health: number;
  maxHealth: number;
  destroyed: boolean;
}

export interface DestructibleDamageResult {
  state: DestructibleObstacleState;
  damaged: boolean;
  destroyedNow: boolean;
}

export function getZombieStructureDamage(zombieDamage: number): number {
  return Math.max(4, Math.round(zombieDamage * 0.8));
}

export class DestructibleObstacleSystem {
  private readonly states = new Map<string, DestructibleObstacleState>();
  private readonly tileStates = new Map<number, DestructibleObstacleState>();

  constructor(private readonly doors: readonly DoorDefinition[], private readonly widthTiles: number) {
    for (const door of doors) {
      this.registerState(door);
    }
  }

  addBarricade(saved: SavedBarricadeState): DestructibleObstacleState {
    const state: DestructibleObstacleState = {
      id: saved.id,
      kind: "barricade",
      tileX: saved.tileX,
      tileY: saved.tileY,
      health: clampHealth(saved.health, saved.maxHealth),
      maxHealth: saved.maxHealth,
      destroyed: false,
    };
    this.registerState(state);
    return state;
  }

  removeBarricade(id: string): DestructibleObstacleState | undefined {
    const state = this.states.get(id);
    if (!state || state.kind !== "barricade") return undefined;
    this.states.delete(id);
    this.tileStates.delete(this.tileIndex(state.tileX, state.tileY));
    return state;
  }

  get(id: string): DestructibleObstacleState | undefined {
    return this.states.get(id);
  }

  getBlockingAtTile(tileX: number, tileY: number): DestructibleObstacleState | undefined {
    const state = this.tileStates.get(this.tileIndex(tileX, tileY));
    if (!state || state.destroyed) return undefined;
    if (state.kind === "door") {
      const door = state as DoorDefinition;
      if (!door || door.open || door.destroyed) return undefined;
    }
    return state;
  }

  damage(id: string, amount: number): DestructibleDamageResult | undefined {
    const state = this.states.get(id);
    if (!state || state.destroyed || state.health <= 0 || amount <= 0) return undefined;
    const previous = state.health;
    state.health = Math.max(0, state.health - amount);
    const destroyedNow = previous > 0 && state.health === 0;
    if (destroyedNow) state.destroyed = true;
    return { state, damaged: state.health !== previous, destroyedNow };
  }

  doorStates(): SavedDoorState[] {
    return this.doors.map((door) => ({ id: door.id, open: door.open, health: door.health, destroyed: door.destroyed }));
  }

  barricadeStates(): SavedBarricadeState[] {
    const saved: SavedBarricadeState[] = [];
    for (const state of this.states.values()) {
      if (state.kind !== "barricade" || state.destroyed) continue;
      saved.push({ id: state.id, tileX: state.tileX, tileY: state.tileY, health: state.health, maxHealth: state.maxHealth });
    }
    return saved;
  }

  private registerState(state: DestructibleObstacleState): void {
    this.states.set(state.id, state);
    if (!state.destroyed) this.tileStates.set(this.tileIndex(state.tileX, state.tileY), state);
  }

  private tileIndex(tileX: number, tileY: number): number {
    return tileY * this.widthTiles + tileX;
  }
}

function clampHealth(health: number, maximum: number): number {
  return Math.max(0, Math.min(maximum, health));
}
