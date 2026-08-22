import { describe, expect, it } from "vitest";
import { COMPANION_TARGET_MEMORY_MS, COMPANION_TARGET_SCORE_HYSTERESIS, createCompanionTargetCommitmentState, updateCompanionTargetCommitment } from "../systems/companion-target-commitment";

const origin = { x: 0, y: 0 };
const alpha = { id: "alpha", position: { x: 80, y: 0 }, alive: true };
const beta = { id: "beta", position: { x: 70, y: 0 }, alive: true };
function update(state: ReturnType<typeof createCompanionTargetCommitmentState>, now: number, candidates = [alpha, beta], current = alpha) {
  return updateCompanionTargetCommitment(state, { actorId: "ally-1", now, origin, command: "follow", candidates, currentTarget: current, maximumDistance: 260, immediateThreatDistance: 36 });
}

describe("companion target commitment", () => {
  it("locks the first automatic target and ignores a slightly closer candidate", () => {
    const state = createCompanionTargetCommitmentState();
    expect(update(state, 0)).toBe("beta"); expect(state.lockedUntil).toBeGreaterThanOrEqual(900); expect(state.lockedUntil).toBeLessThanOrEqual(1_500);
    const currentBeta = beta; const slightlyCloser = { id: "gamma", position: { x: 66, y: 0 }, alive: true };
    expect(updateCompanionTargetCommitment(state, { actorId: "ally-1", now: 500, origin, command: "follow", candidates: [currentBeta, slightlyCloser], currentTarget: currentBeta, maximumDistance: 260, immediateThreatDistance: 36 })).toBe("beta");
    expect(COMPANION_TARGET_SCORE_HYSTERESIS).toBe(1.3);
  });

  it("requires a significantly better candidate to remain valid through pending time", () => {
    const state = createCompanionTargetCommitmentState();
    updateCompanionTargetCommitment(state, { actorId: "ally-1", now: 0, origin, command: "follow", candidates: [alpha], maximumDistance: 260, immediateThreatDistance: 36 });
    const superior = { id: "superior", position: { x: 45, y: 0 }, alive: true };
    const afterLock = state.lockedUntil + 1;
    expect(updateCompanionTargetCommitment(state, { actorId: "ally-1", now: afterLock, origin, command: "follow", candidates: [alpha, superior], currentTarget: alpha, maximumDistance: 260, immediateThreatDistance: 36 })).toBe("alpha");
    expect(state.pendingTargetId).toBe("superior");
    const readyAt = state.pendingTargetReadyAt;
    expect(updateCompanionTargetCommitment(state, { actorId: "ally-1", now: readyAt - 1, origin, command: "follow", candidates: [alpha, superior], currentTarget: alpha, maximumDistance: 260, immediateThreatDistance: 36 })).toBe("alpha");
    expect(updateCompanionTargetCommitment(state, { actorId: "ally-1", now: readyAt, origin, command: "follow", candidates: [alpha, superior], currentTarget: alpha, maximumDistance: 260, immediateThreatDistance: 36 })).toBe("superior");
  });

  it("cancels pending candidates, remembers brief visibility loss, and releases leash violations", () => {
    const state = createCompanionTargetCommitmentState(); update(state, 0, [alpha], undefined);
    expect(updateCompanionTargetCommitment(state, { actorId: "ally-1", now: 500, origin, command: "follow", candidates: [], currentTarget: alpha, maximumDistance: 260, immediateThreatDistance: 36 })).toBe("alpha");
    expect(updateCompanionTargetCommitment(state, { actorId: "ally-1", now: COMPANION_TARGET_MEMORY_MS + 1, origin, command: "follow", candidates: [], currentTarget: alpha, maximumDistance: 260, immediateThreatDistance: 36 })).toBeUndefined();
    const far = { id: "far", position: { x: 400, y: 0 }, alive: true }; state.currentTargetId = "far"; state.lastVisibleAt = 2_000;
    expect(updateCompanionTargetCommitment(state, { actorId: "ally-1", now: 2_001, origin, command: "hold", candidates: [far], currentTarget: far, maximumDistance: 260, immediateThreatDistance: 36 })).toBeUndefined();
  });

  it("uses a short pending replacement for death and lets focus override immediately", () => {
    const state = createCompanionTargetCommitmentState(); update(state, 0, [alpha], undefined);
    expect(updateCompanionTargetCommitment(state, { actorId: "ally-1", now: 100, origin, command: "follow", candidates: [beta], maximumDistance: 260, immediateThreatDistance: 36 })).toBeUndefined();
    expect(state.pendingTargetReadyAt - 100).toBeGreaterThanOrEqual(80); expect(state.pendingTargetReadyAt - 100).toBeLessThanOrEqual(180);
    const focus = { id: "focus", position: { x: 500, y: 0 }, alive: true };
    expect(updateCompanionTargetCommitment(state, { actorId: "ally-1", now: 110, origin, command: "focus", candidates: [], focusTarget: focus, maximumDistance: Infinity, immediateThreatDistance: 36 })).toBe("focus");
  });

  it("is deterministic and scans candidates without sorting them", () => {
    const first = createCompanionTargetCommitmentState(); const second = createCompanionTargetCommitmentState();
    expect(update(first, 0)).toBe(update(second, 0)); expect(first).toEqual(second);
    expect(update(first, 100, [alpha], beta)).toBe("beta");
  });
});
