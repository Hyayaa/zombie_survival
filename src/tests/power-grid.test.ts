import { describe, expect, it } from "vitest";
import { createPlacedStructure, type PlacedStructureState } from "../entities/placed-structure";
import { MAX_GENERATOR_FUEL_SECONDS, PowerGridSystem } from "../systems/power-grid-system";

const position = (state: PlacedStructureState) => ({ x: state.tileX, y: state.tileY });
const node = (id: string, kind: PlacedStructureState["kind"], x: number, energy = 0) => Object.assign(createPlacedStructure(id, kind, x, 0), { storedEnergy: energy });

describe("power grid", () => {
  it("connects in range without turret relay and keeps revision stable between rebuilds", () => {
    const generator = node("g", "solar-generator", 0); const near = node("t1", "turret", 160); const relay = node("t2", "turret", 320);
    const grid = new PowerGridSystem(); grid.rebuild([generator, near, relay], position);
    expect(grid.getEdges()).toEqual([{ fromId: "g", toId: "t1" }]);
    const revision = grid.revision; grid.tick(0.1, true); expect(grid.revision).toBe(revision);
  });

  it("adds generator output, charges storage and discharges batteries", () => {
    const solar = node("s", "solar-generator", 0); const fuel = node("f", "fuel-generator", 20); fuel.fuelSeconds = 90;
    const battery = node("b", "battery-bank", 40); const turret = node("t", "turret", 60);
    const grid = new PowerGridSystem(); grid.rebuild([solar, fuel, battery, turret], position); grid.tick(1, true);
    expect(turret.powered).toBe(true); expect(solar.storedEnergy + fuel.storedEnergy + battery.storedEnergy).toBeCloseTo(16); expect(fuel.fuelSeconds).toBe(89);
    solar.storedEnergy = 0; fuel.storedEnergy = 0; fuel.fuelSeconds = 0; battery.storedEnergy = 4; grid.tick(1, false);
    expect(turret.powered).toBe(true); expect(battery.storedEnergy).toBe(0);
    grid.tick(1, false); expect(turret.powered).toBe(false);
  });

  it("stops fuel when no demand or storage room and allocates by stable id", () => {
    const fuel = node("f", "fuel-generator", 0, 60); fuel.fuelSeconds = MAX_GENERATOR_FUEL_SECONDS;
    const battery = node("b", "battery-bank", 20, 240); const grid = new PowerGridSystem(); grid.rebuild([fuel, battery], position); grid.tick(1, false);
    expect(fuel.fuelSeconds).toBe(MAX_GENERATOR_FUEL_SECONDS);
    const t2=node("t2","turret",30), t1=node("t1","turret",40); battery.storedEnergy=4; fuel.storedEnergy=0; fuel.fuelSeconds=0; grid.rebuild([fuel,battery,t2,t1],position); grid.tick(1,false);
    expect(t1.powered).toBe(true); expect(t2.powered).toBe(false);
  });
});
