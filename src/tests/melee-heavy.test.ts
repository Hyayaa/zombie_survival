import { describe, expect, it } from "vitest";
import { getChargedMeleeDefinition, MELEE_ATTACK_DEFINITIONS, MELEE_INPUT_BALANCE } from "../data/melee-attack-definitions";
import { HitStopSystem, MAX_HIT_STOP_MS } from "../systems/hit-stop-system";

describe("charged heavy melee", () => {
  it("scales to a bounded full charge and remains costly", () => {
    const low = getChargedMeleeDefinition("bat", 0);
    const full = getChargedMeleeDefinition("bat", 3);
    expect(full.damage).toBe(MELEE_ATTACK_DEFINITIONS.bat.heavy.damage);
    expect(full.postureDamage).toBeGreaterThan(low.postureDamage);
    expect(full.staminaCost).toBeGreaterThan(MELEE_ATTACK_DEFINITIONS.bat.swing.staminaCost);
    expect(MELEE_INPUT_BALANCE.postureBrokenDamageBonus).toBeGreaterThan(1);
  });

  it("does not guarantee a fresh walker posture break", () => {
    expect(MELEE_ATTACK_DEFINITIONS.bat.heavy.postureDamage).toBeLessThan(100);
  });

  it("keeps only the strongest bounded hit-stop without freezing input state", () => {
    const hitStop = new HitStopSystem();
    hitStop.request(20); hitStop.request(999);
    expect(hitStop.consume(16)).toBe(0);
    expect(hitStop.consume(MAX_HIT_STOP_MS)).toBe(16);
  });
});
