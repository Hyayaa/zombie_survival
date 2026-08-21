import { MELEE_ATTACK_DEFINITIONS, MELEE_INPUT_BALANCE, type MeleeAttackMode, type MeleeWeaponId } from "../data/melee-attack-definitions";

export type MeleeActionPhase = "idle" | "charging" | "windup" | "active" | "recovery";

export interface MeleeActionState {
  phase: MeleeActionPhase;
  weapon?: MeleeWeaponId;
  mode?: MeleeAttackMode;
  pressedAt: number;
  phaseEndsAt: number;
  aimAngle: number;
  charge: number;
  sequence: number;
}

export interface MeleeAttackStarted {
  weapon: MeleeWeaponId;
  mode: MeleeAttackMode;
  aimAngle: number;
  charge: number;
  sequence: number;
}

export function createMeleeActionState(): MeleeActionState {
  return { phase: "idle", pressedAt: 0, phaseEndsAt: 0, aimAngle: 0, charge: 0, sequence: 0 };
}

export class MeleeActionController {
  readonly state = createMeleeActionState();

  pressPrimary(now: number, aimAngle: number, weapon: MeleeWeaponId): boolean {
    if (this.state.phase !== "idle") return false;
    Object.assign(this.state, { phase: "charging", weapon, mode: undefined, pressedAt: now, phaseEndsAt: 0, aimAngle, charge: 0 });
    return true;
  }

  releasePrimary(now: number, stamina: number): boolean {
    if (this.state.phase !== "charging" || !this.state.weapon) return false;
    const heldMs = Math.max(0, now - this.state.pressedAt);
    const mode: MeleeAttackMode = heldMs >= MELEE_INPUT_BALANCE.heavyThresholdMs ? "heavy" : "stab";
    const charge = mode === "heavy" ? Math.min(1, Math.max(0, heldMs - MELEE_INPUT_BALANCE.heavyThresholdMs) / (MELEE_INPUT_BALANCE.maximumChargeMs - MELEE_INPUT_BALANCE.heavyThresholdMs)) : 0;
    return this.begin(mode, now, stamina, charge);
  }

  pressSecondary(now: number, aimAngle: number, weapon: MeleeWeaponId, stamina: number): boolean {
    if (this.state.phase !== "idle") return false;
    Object.assign(this.state, { weapon, aimAngle, pressedAt: now });
    return this.begin("swing", now, stamina, 0);
  }

  update(now: number): MeleeAttackStarted | undefined {
    if (this.state.phase === "charging") {
      this.state.charge = Math.min(1, Math.max(0, now - this.state.pressedAt) / MELEE_INPUT_BALANCE.maximumChargeMs);
      return undefined;
    }
    if (!this.state.weapon || !this.state.mode || now < this.state.phaseEndsAt) return undefined;
    const definition = MELEE_ATTACK_DEFINITIONS[this.state.weapon][this.state.mode];
    if (this.state.phase === "windup") {
      this.state.phase = "active";
      this.state.phaseEndsAt = now + definition.activeMs;
      return { weapon: this.state.weapon, mode: this.state.mode, aimAngle: this.state.aimAngle, charge: this.state.charge, sequence: this.state.sequence };
    }
    if (this.state.phase === "active") {
      this.state.phase = "recovery";
      this.state.phaseEndsAt = now + definition.recoveryMs;
    } else if (this.state.phase === "recovery") this.reset();
    return undefined;
  }

  cancel(): void { this.reset(); }

  getMovementMultiplier(): number {
    if (this.state.phase === "idle") return 1;
    if (this.state.phase === "charging") return MELEE_INPUT_BALANCE.chargeMovementMultiplier;
    if (!this.state.weapon || !this.state.mode) return 1;
    return MELEE_ATTACK_DEFINITIONS[this.state.weapon][this.state.mode].movementMultiplier;
  }

  private begin(mode: MeleeAttackMode, now: number, stamina: number, charge: number): boolean {
    const weapon = this.state.weapon;
    if (!weapon) return false;
    const definition = MELEE_ATTACK_DEFINITIONS[weapon][mode];
    if (stamina < definition.staminaCost) { this.reset(); return false; }
    Object.assign(this.state, { phase: "windup", mode, phaseEndsAt: now + definition.windupMs, charge, sequence: this.state.sequence + 1 });
    return true;
  }

  private reset(): void {
    const sequence = this.state.sequence;
    Object.assign(this.state, createMeleeActionState(), { sequence });
  }
}
