import { describe,expect,it } from "vitest";
import { BloodDecalStore,createBloodDecalStamp,MAX_BLOOD_DECALS,type BloodDecal } from "../effects/blood-decal-layer";
import { aggregateProjectileDamage,createBloodEffectPlan,type BloodEffectPlan,type DamageImpactContext } from "../effects/blood-effect-math";

const impact=(overrides:Partial<DamageImpactContext>={}):DamageImpactContext=>({kind:"projectile",damage:34,hitX:10,hitY:20,directionX:1,directionY:0,weaponId:"pistol",sequence:4,...overrides});
const byRole=(plan:BloodEffectPlan,role:"impact"|"streak"|"droplet")=>plan.particles.filter((particle)=>particle.role===role);
const average=(values:number[])=>values.reduce((sum,value)=>sum+value,0)/values.length;
const angleDelta=(angle:number,center=0)=>Math.abs(Math.atan2(Math.sin(angle-center),Math.cos(angle-center)));

describe("radial blood effect math",()=>{
  it("creates deterministic impact branches, directional streaks, and wide droplets",()=>{const plan=createBloodEffectPlan(impact());expect(createBloodEffectPlan(impact())).toEqual(plan);expect(byRole(plan,"impact").length).toBeGreaterThanOrEqual(3);expect(byRole(plan,"streak").length).toBeGreaterThanOrEqual(4);expect(byRole(plan,"droplet").length).toBeGreaterThanOrEqual(5);expect(byRole(plan,"streak").every((particle)=>angleDelta(particle.angle)<.7)).toBe(true);expect(new Set(plan.particles.map((particle)=>particle.angle.toFixed(3))).size).toBeGreaterThan(8);expect(plan.decal.x).toBeGreaterThan(10);});

  it("fans left when the projectile travels left and handles zero direction without NaN or mutation",()=>{const left=createBloodEffectPlan(impact({directionX:-1}));expect(byRole(left,"streak").every((particle)=>angleDelta(particle.angle,Math.PI)<.7)).toBe(true);const input=impact({directionX:0,directionY:0,damage:999});const snapshot={...input};const zero=createBloodEffectPlan(input);expect(input).toEqual(snapshot);expect(zero.particles.every((particle)=>Number.isFinite(particle.velocityX)&&Number.isFinite(particle.velocityY))).toBe(true);expect(Math.max(...zero.particles.map((particle)=>particle.travelDistance))).toBeLessThanOrEqual(54);});

  it("scales count and average travel with damage while respecting caps",()=>{const low=createBloodEffectPlan(impact({damage:5}));const high=createBloodEffectPlan(impact({damage:100}));expect(high.particles.length).toBeGreaterThan(low.particles.length);expect(average(high.particles.map((particle)=>particle.travelDistance))).toBeGreaterThan(average(low.particles.map((particle)=>particle.travelDistance)));expect(high.particles.length).toBeLessThanOrEqual(36);expect(Math.max(...high.particles.map((particle)=>particle.travelDistance))).toBeLessThanOrEqual(54);});

  it("makes shotgun wider, rifle narrower and longer, and SMG events lighter",()=>{const shotgun=createBloodEffectPlan(impact({weaponId:"shotgun",damage:78}));const rifle=createBloodEffectPlan(impact({weaponId:"hunting_rifle",damage:68}));const smg=createBloodEffectPlan(impact({weaponId:"smg",damage:17}));const spread=(plan:BloodEffectPlan)=>Math.max(...byRole(plan,"streak").map((particle)=>angleDelta(particle.angle)));expect(spread(shotgun)).toBeGreaterThan(spread(rifle));expect(average(byRole(rifle,"streak").map((particle)=>particle.travelDistance))).toBeGreaterThan(average(byRole(shotgun,"streak").map((particle)=>particle.travelDistance)));expect(smg.particles.length).toBeLessThan(shotgun.particles.length);});

  it("keeps melee blood short, broad, and concentrated near the floor",()=>{const melee=createBloodEffectPlan(impact({kind:"melee",weaponId:"bat",damage:24}));const pistol=createBloodEffectPlan(impact());expect(melee.profile).toBe("melee");expect(Math.max(...melee.particles.map((particle)=>particle.travelDistance))).toBeLessThanOrEqual(11);expect(average(pistol.particles.map((particle)=>particle.travelDistance))).toBeGreaterThan(average(melee.particles.map((particle)=>particle.travelDistance)));expect(melee.decal.y).toBeGreaterThan(20);});

  it("aggregates shotgun pellet damage into one representative event",()=>{const combined=aggregateProjectileDamage([impact({damage:13,directionX:1}),impact({damage:13,directionX:.8})]);expect(combined).toMatchObject({damage:26,directionX:23.4});});

  it("builds irregular pixel decals without a single circular primitive",()=>{const decal:BloodDecal={...createBloodEffectPlan(impact()).decal,color:0x381817,createdAt:0};const pixels=createBloodDecalStamp(decal);expect(pixels.length).toBeGreaterThan(10);expect(new Set(pixels.map((pixel)=>`${pixel.x}:${pixel.y}`)).size).toBeGreaterThan(8);expect(pixels.some((pixel)=>pixel.width===1&&pixel.height===1)).toBe(true);expect(pixels.some((pixel)=>pixel.width>1||pixel.height>1)).toBe(true);});

  it("merges nearby fresh decals and keeps the batched store bounded",()=>{const store=new BloodDecalStore();const plan=createBloodEffectPlan(impact()).decal;store.add(plan,0);store.add({...plan,x:plan.x+1,y:plan.y+1},50);expect(store.count).toBe(1);for(let index=0;index<MAX_BLOOD_DECALS+20;index++)store.add({...plan,x:index*20,y:100,sequence:index},1_000+index*200);expect(store.count).toBeLessThanOrEqual(MAX_BLOOD_DECALS);});
});
