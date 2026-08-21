import { MELEE_INPUT_BALANCE, type MeleeAttackDefinition } from "../data/melee-attack-definitions";
import type { Point } from "./zombie-ai-system";

export interface MeleeTarget { id: string; position: Point; alive: boolean }
export interface MeleeHit { target: MeleeTarget; distanceSquared: number; multiplier: number }

export function collectMeleeTargets(origin: Point, angle: number, attack: MeleeAttackDefinition, targets: readonly MeleeTarget[], hasLineOfSight: (origin: Point, target: Point) => boolean, output: MeleeHit[]): MeleeHit[] {
  output.length = 0;
  const directionX = Math.cos(angle), directionY = Math.sin(angle);
  const targetRadius = 7;
  const rangeWithTarget = attack.range + targetRadius;
  const rangeSquared = rangeWithTarget * rangeWithTarget;
  for (const target of targets) {
    if (!target.alive) continue;
    const dx = target.position.x - origin.x, dy = target.position.y - origin.y;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared > rangeSquared || !hasLineOfSight(origin, target.position)) continue;
    let inside = false;
    if (attack.geometry === "capsule") {
      const forward = dx * directionX + dy * directionY;
      if (forward >= 0 && forward <= rangeWithTarget) {
        const side = Math.abs(dx * directionY - dy * directionX);
        inside = side <= attack.width + targetRadius;
      }
    } else {
      const targetAngle = Math.atan2(dy, dx);
      const difference = Math.abs(Math.atan2(Math.sin(targetAngle - angle), Math.cos(targetAngle - angle)));
      inside = difference <= attack.arcRadians * 0.5;
    }
    if (!inside) continue;
    let index = output.length;
    while (index > 0 && output[index - 1]!.distanceSquared > distanceSquared) index -= 1;
    output.splice(index, 0, { target, distanceSquared, multiplier: 1 });
    if (output.length > attack.maxTargets) output.length = attack.maxTargets;
  }
  for (let index = 0; index < output.length; index += 1) output[index]!.multiplier = MELEE_INPUT_BALANCE.targetDamageAttenuation[Math.min(index, 2)]!;
  return output;
}

export class MeleeHitTracker {
  private sequence = -1;
  private readonly hitIds = new Set<string>();
  begin(sequence: number): void { if (sequence !== this.sequence) { this.sequence = sequence; this.hitIds.clear(); } }
  tryHit(targetId: string): boolean { if (this.hitIds.has(targetId)) return false; this.hitIds.add(targetId); return true; }
}
