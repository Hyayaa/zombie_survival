import { describe, expect, it } from "vitest";
import { canRun, clampNeed, createSurvivalNeeds, createSurvivalRuntime, getRunSpeedMultiplier, restoreHunger, restoreThirst, SURVIVAL_BALANCE, updateSurvivalNeeds } from "../systems/survival-needs-system";

describe("survival needs", () => {
  it("starts full, clamps invalid values, and drains thirst faster than hunger", () => {
    expect(createSurvivalNeeds()).toEqual({ hunger: 100, thirst: 100, stamina: 100 });
    const runtime = createSurvivalRuntime();
    const result = updateSurvivalNeeds(createSurvivalNeeds(), runtime, { deltaSeconds: 10, nowMs: 10_000, actualRunning: false, lastAttackAt: -Infinity });
    expect(result.needs.hunger).toBeCloseTo(99.6);
    expect(result.needs.thirst).toBeCloseTo(99.375);
    expect(clampNeed(Number.NaN)).toBe(100);
    expect(createSurvivalNeeds({ hunger: -5, thirst: 130, stamina: Number.NaN })).toEqual({ hunger: 0, thirst: 100, stamina: 100 });
  });

  it("only charges successful running and observes recovery delay", () => {
    const runtime = createSurvivalRuntime(); let needs = createSurvivalNeeds();
    needs = updateSurvivalNeeds(needs, runtime, { deltaSeconds: 1, nowMs: 1_000, actualRunning: true, lastAttackAt: -Infinity }).needs;
    expect(needs.stamina).toBe(100 - SURVIVAL_BALANCE.staminaDrainPerSecond);
    const blocked = updateSurvivalNeeds(needs, runtime, { deltaSeconds: 0.5, nowMs: 1_300, actualRunning: false, lastAttackAt: -Infinity }).needs;
    expect(blocked.stamina).toBe(needs.stamina);
    const recovered = updateSurvivalNeeds(blocked, runtime, { deltaSeconds: 1, nowMs: 1_700, actualRunning: false, lastAttackAt: -Infinity }).needs;
    expect(recovered.stamina).toBeGreaterThan(blocked.stamina);
  });

  it("latches exhaustion until the resume threshold", () => {
    const runtime = createSurvivalRuntime(); let needs = createSurvivalNeeds({ stamina: 1 });
    needs = updateSurvivalNeeds(needs, runtime, { deltaSeconds: 1, nowMs: 1_000, actualRunning: true, lastAttackAt: -Infinity }).needs;
    expect(needs.stamina).toBe(0); expect(canRun(needs, runtime)).toBe(false);
    needs.stamina = SURVIVAL_BALANCE.resumeRunningAt - 0.1; expect(canRun(needs, runtime)).toBe(false);
    needs.stamina = SURVIVAL_BALANCE.resumeRunningAt; expect(canRun(needs, runtime)).toBe(true);
  });

  it("combines low-needs recovery and run speed penalties", () => {
    const runtime = createSurvivalRuntime();
    const normal = updateSurvivalNeeds(createSurvivalNeeds({ stamina: 20 }), runtime, { deltaSeconds: 1, nowMs: 2_000, actualRunning: false, lastAttackAt: -Infinity }).needs.stamina;
    const low = updateSurvivalNeeds(createSurvivalNeeds({ hunger: 20, thirst: 20, stamina: 20 }), createSurvivalRuntime(), { deltaSeconds: 1, nowMs: 2_000, actualRunning: false, lastAttackAt: -Infinity }).needs.stamina;
    expect(low).toBeLessThan(normal);
    expect(getRunSpeedMultiplier({ hunger: 20, thirst: 20, stamina: 100 })).toBeCloseTo(0.92 * 0.85);
  });

  it("applies timed starvation and dehydration damage in one result", () => {
    const runtime = createSurvivalRuntime(); let needs = createSurvivalNeeds({ hunger: 0, thirst: 0 });
    expect(updateSurvivalNeeds(needs, runtime, { deltaSeconds: 0, nowMs: 0, actualRunning: false, lastAttackAt: -Infinity }).damage).toBe(0);
    const first = updateSurvivalNeeds(needs, runtime, { deltaSeconds: 0, nowMs: 4_000, actualRunning: false, lastAttackAt: -Infinity });
    expect(first.damage).toBe(SURVIVAL_BALANCE.thirstDamage);
    const combined = updateSurvivalNeeds(needs, runtime, { deltaSeconds: 0, nowMs: 9_000, actualRunning: false, lastAttackAt: -Infinity });
    expect(combined.damage).toBe(SURVIVAL_BALANCE.hungerDamage + SURVIVAL_BALANCE.thirstDamage);
  });

  it("restores existing food and water needs without exceeding 100", () => {
    const needs = createSurvivalNeeds({ hunger: 70, thirst: 60 });
    expect(restoreHunger(needs).hunger).toBe(100);
    expect(restoreThirst(needs).thirst).toBe(100);
  });
});
