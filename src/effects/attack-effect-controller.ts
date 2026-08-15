import type { WeaponDefinition } from "../data/weapon-definitions";
import type { AttackEffectEvent } from "./pixel-effect-definitions";

export interface AttackReadiness {
  now: number;
  lastAttackAt: number;
  reloadingUntil: number;
  magazine: number;
  blocked: boolean;
}

export type AttackBlockReason = "blocked" | "cooldown" | "reloading" | "empty";

export function getAttackBlockReason(state: AttackReadiness, weapon: WeaponDefinition): AttackBlockReason | null {
  if (state.blocked) return "blocked";
  if (state.now - state.lastAttackAt < weapon.cooldownMs) return "cooldown";
  if (state.reloadingUntil > 0) return "reloading";
  if (weapon.kind === "ranged" && state.magazine <= 0) return "empty";
  return null;
}

export interface AttackEffectSink {
  playAttack(event: AttackEffectEvent): void;
}

export class AttackEffectController {
  private sequence = 0;

  constructor(private readonly sink: AttackEffectSink) {}

  play(event: Omit<AttackEffectEvent, "sequence">): AttackEffectEvent {
    const sequenced = { ...event, sequence: ++this.sequence };
    this.sink.playAttack(sequenced);
    return sequenced;
  }

  get lastSequence(): number {
    return this.sequence;
  }
}
