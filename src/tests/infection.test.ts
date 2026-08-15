import { describe, expect, it } from "vitest";
import { InfectionSystem, type VitalState } from "../systems/infection-system";

describe("InfectionSystem", () => {
  const system = new InfectionSystem();
  const healthy = (): VitalState => ({ health: 100, maxHealth: 100, infection: 0 });

  it("makes bites more infectious than scratches", () => {
    const scratch = system.applyAttack(healthy(), "scratch", 5, 12);
    const bite = system.applyAttack(healthy(), "bite", 5, 12);
    expect(bite.infection).toBeGreaterThan(scratch.infection);
  });

  it("reduces infection with medicine and clamps values", () => {
    const medicated = system.useMedicine({ ...healthy(), infection: 15 }, 24);
    expect(medicated.infection).toBe(0);
    expect(system.applyAttack(healthy(), "bite", 200, 150)).toMatchObject({ health: 0, infection: 100 });
  });

  it("ends the game at full infection", () => {
    expect(system.isGameOver({ ...healthy(), infection: 100 })).toBe(true);
    expect(system.isGameOver(healthy())).toBe(false);
  });
});

