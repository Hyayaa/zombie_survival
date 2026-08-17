import { describe, expect, it } from "vitest";
import { createZombieMind, updateZombieMind, VISUAL_AGGRO_RELEASE_DISTANCE, VISUAL_AGGRO_RELEASE_GRACE_MS, ZOMBIE_CHASE_MULTIPLIER } from "../systems/zombie-ai-system";

describe("persistent visual zombie aggro", () => {
  it("does not turn sound investigation into a visual lock", () => {
    const mind=updateZombieMind(createZombieMind(),{canSeeTarget:false,heardNoise:{x:4,y:5,perceivedIntensity:20,distance:6,intensity:20,radius:80,category:"gunshot",createdAt:0}});
    expect(mind.state).toBe("InvestigateNoise"); expect(mind.visualLock).toBe(false);
  });
  it("locks a directly seen target and ignores smaller noise after LOS loss", () => {
    const seen=updateZombieMind(createZombieMind(),{canSeeTarget:true,targetId:"player",targetPosition:{x:10,y:0},nowMs:100});
    const lost=updateZombieMind(seen,{canSeeTarget:false,targetAlive:true,targetDistance:200,targetPosition:{x:30,y:0},nowMs:900,heardNoise:{x:-9,y:0,perceivedIntensity:2,distance:9,intensity:2,radius:8,category:"walk",createdAt:800}});
    expect(lost).toMatchObject({state:"Chase",visualLock:true,currentTargetId:"player",lastSeenTargetPosition:{x:30,y:0}});
  });
  it("uses a grace period outside release range and clears dead targets", () => {
    const seen=updateZombieMind(createZombieMind(),{canSeeTarget:true,targetId:"companion-0",targetPosition:{x:1,y:1},nowMs:0});
    const outside=updateZombieMind(seen,{canSeeTarget:false,targetAlive:true,targetDistance:VISUAL_AGGRO_RELEASE_DISTANCE+1,nowMs:100});
    expect(outside.visualLock).toBe(true);
    const released=updateZombieMind(outside,{canSeeTarget:false,targetAlive:true,targetDistance:VISUAL_AGGRO_RELEASE_DISTANCE+1,nowMs:100+VISUAL_AGGRO_RELEASE_GRACE_MS});
    expect(released.visualLock).toBe(false); expect(updateZombieMind(seen,{canSeeTarget:false,targetAlive:false,nowMs:200}).visualLock).toBe(false);
  });
  it("raises chase speed without changing base definitions", () => { expect(ZOMBIE_CHASE_MULTIPLIER.walker).toBe(1.24); expect(ZOMBIE_CHASE_MULTIPLIER.runner).toBe(1.14); });
});
