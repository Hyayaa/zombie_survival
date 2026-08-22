import { describe, expect, it } from "vitest";
import { createPlacedSegment } from "../entities/placed-structure";
import { getDemolitionRefund, getRepairCost, StructureDurabilitySystem } from "../systems/structure-durability-system";

describe("structure durability", () => {
  it("applies material resistance and emits destruction only once", () => { const wood=createPlacedSegment("w","wood-wall",0,0,24,0); const metal=createPlacedSegment("m","metal-wall",0,24,24,24); const system=new StructureDurabilitySystem(); expect(system.damage(wood,100).appliedDamage).toBe(100); expect(system.damage(metal,100).appliedDamage).toBe(65); wood.health=1; expect(system.damage(wood,20).destroyedNow).toBe(true); expect(system.damage(wood,20).destroyedNow).toBe(false); });
  it("calculates proportional repair and health-scaled demolition", () => { const wall=createPlacedSegment("w","wood-wall",0,0,24,0); wall.health=120; expect(getRepairCost(wall)).toEqual([{itemId:"wood",quantity:2},{itemId:"screws",quantity:1}]); const high=getDemolitionRefund({...wall,health:240}); const low=getDemolitionRefund({...wall,health:60}); expect(high.reduce((s,c)=>s+c.quantity,0)).toBeGreaterThan(low.reduce((s,c)=>s+c.quantity,0)); });
});
