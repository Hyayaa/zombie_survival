import { describe, expect, it } from "vitest";
import { MELEE_ATTACK_DEFINITIONS } from "../data/melee-attack-definitions";
import { MeleeActionController } from "../systems/melee-input-state";

describe("melee input state", () => {
  it("maps a short primary release to stab and a held release to heavy", () => {
    const short = new MeleeActionController();
    expect(short.pressPrimary(0, 0.2, "knife")).toBe(true);
    expect(short.releasePrimary(120, 100)).toBe(true);
    expect(short.state.mode).toBe("stab");
    expect(short.update(120 + MELEE_ATTACK_DEFINITIONS.knife.stab.windupMs)?.mode).toBe("stab");

    const held = new MeleeActionController();
    held.pressPrimary(0, 1, "bat");
    held.update(900);
    expect(held.releasePrimary(900, 100)).toBe(true);
    expect(held.state.mode).toBe("heavy");
    expect(held.state.charge).toBe(1);
  });

  it("starts right-click swing immediately, rejects it during charge, and cancels cleanly", () => {
    const controller = new MeleeActionController();
    controller.pressPrimary(10, 0, "knife");
    expect(controller.pressSecondary(20, 1, "knife", 100)).toBe(false);
    controller.cancel();
    expect(controller.pressSecondary(30, 1, "knife", 100)).toBe(true);
    expect(controller.state.mode).toBe("swing");
    controller.cancel();
    expect(controller.state.phase).toBe("idle");
  });

  it("does not spend an action when stamina is insufficient", () => {
    const controller = new MeleeActionController();
    controller.pressPrimary(0, 0, "bat");
    expect(controller.releasePrimary(500, 1)).toBe(false);
    expect(controller.state.phase).toBe("idle");
  });
});
