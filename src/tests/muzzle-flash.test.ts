import { describe, expect, it } from "vitest";
import { getMuzzlePosition, MUZZLE_FLASH_PROFILES } from "../effects/pixel-effect-math";
import { AttackEffectController } from "../effects/attack-effect-controller";

describe("muzzle flash profiles",()=>{
  it("differentiates firearm size, lifetime and forward muzzle offset",()=>{expect(MUZZLE_FLASH_PROFILES.shotgun.length).toBeGreaterThan(MUZZLE_FLASH_PROFILES.pistol.length);expect(MUZZLE_FLASH_PROFILES.hunting_rifle.length).toBeGreaterThan(MUZZLE_FLASH_PROFILES.pistol.length);expect(MUZZLE_FLASH_PROFILES.smg.lifetimeMs).toBeLessThan(MUZZLE_FLASH_PROFILES.pistol.lifetimeMs);expect(getMuzzlePosition(10,20,0,MUZZLE_FLASH_PROFILES.hunting_rifle.muzzleOffset).x).toBeGreaterThan(10);});
  it("emits one sequenced event per controller play",()=>{const events:number[]=[];const controller=new AttackEffectController({playAttack:event=>events.push(event.sequence)});controller.play({weapon:"shotgun",originX:0,originY:0,angle:0,startedAt:0,impacts:[]});expect(events).toEqual([1]);});
});
