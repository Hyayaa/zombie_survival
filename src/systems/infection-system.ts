export interface VitalState {
  health: number;
  maxHealth: number;
  infection: number;
}

export type ZombieAttackType = "scratch" | "bite";

export class InfectionSystem {
  applyAttack(state: VitalState, type: ZombieAttackType, damage: number, infection: number): VitalState {
    const biteMultiplier = type === "bite" ? 1 : 0.35;
    return this.clamp({
      ...state,
      health: state.health - damage,
      infection: state.infection + infection * biteMultiplier,
    });
  }

  heal(state: VitalState, amount: number): VitalState {
    return this.clamp({ ...state, health: state.health + amount });
  }

  useMedicine(state: VitalState, amount = 24): VitalState {
    return this.clamp({ ...state, infection: state.infection - amount });
  }

  getMovementMultiplier(infection: number): number {
    return infection >= 70 ? 0.82 : 1;
  }

  isGameOver(state: VitalState): boolean {
    return state.health <= 0 || state.infection >= 100;
  }

  clamp(state: VitalState): VitalState {
    return {
      ...state,
      health: Math.min(state.maxHealth, Math.max(0, state.health)),
      infection: Math.min(100, Math.max(0, state.infection)),
    };
  }
}

