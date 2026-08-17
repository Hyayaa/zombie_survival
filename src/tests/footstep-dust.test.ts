import { describe, expect, it } from "vitest";
import { createFootstepDustPlan } from "../effects/footstep-dust";
import { FOOTSTEP_DUST_CAPACITY } from "../effects/pixel-effect-system";

describe("footstep dust",()=>{
  it("is deterministic, terrain aware, and fans backward",()=>{const walk=createFootstepDustPlan(3,0,false,"ground");expect(createFootstepDustPlan(3,0,false,"ground")).toEqual(walk);expect(walk.length).toBeGreaterThanOrEqual(1);expect(walk.length).toBeLessThanOrEqual(3);expect(walk.every(p=>p.velocityX<0)).toBe(true);expect(createFootstepDustPlan(3,0,false,"floor")).toEqual([]);expect(createFootstepDustPlan(3,0,false,"road").length).toBeLessThanOrEqual(walk.length);});
  it("makes running stronger while respecting lifetime, size and pool bounds",()=>{const run=createFootstepDustPlan(9,Math.PI/2,true,"ground");expect(run.length).toBeGreaterThanOrEqual(3);expect(run.length).toBeLessThanOrEqual(6);expect(run.every(p=>p.lifetimeMs>=240&&p.lifetimeMs<=420&&p.size>=1&&p.size<=3)).toBe(true);expect(FOOTSTEP_DUST_CAPACITY).toBe(96);});
});
