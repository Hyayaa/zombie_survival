import { describe, expect, it } from "vitest";
import { BloodDecalStore, MAX_BLOOD_DECALS } from "../effects/blood-decal-layer";
import { aggregateProjectileDamage, createBloodEffectPlan, type DamageImpactContext } from "../effects/blood-effect-math";

const impact = (overrides: Partial<DamageImpactContext> = {}): DamageImpactContext => ({ kind: "projectile", damage: 20, hitX: 10, hitY: 20, directionX: 1, directionY: 0, sequence: 4, ...overrides });

describe("directional blood effects", () => {
  it("is deterministic and sends projectile blood onward from the attacker", () => {
    const first = createBloodEffectPlan(impact()); expect(createBloodEffectPlan(impact())).toEqual(first);
    expect(first.profile).toBe("projectile"); expect(first.decal.x).toBeGreaterThan(10);
    expect(first.particles.filter((particle) => particle.velocityX > 0)).toHaveLength(first.particles.length);
    const left=createBloodEffectPlan(impact({directionX:-1}));expect(left.decal.x).toBeLessThan(10);expect(left.particles.filter((particle)=>particle.velocityX<0)).toHaveLength(left.particles.length);
  });

  it("scales projectile travel with damage while melee stays short", () => {
    const low = createBloodEffectPlan(impact({ damage: 1 })); const high = createBloodEffectPlan(impact({ damage: 100 }));
    const speed = (plan: typeof low) => Math.max(...plan.particles.map((particle) => Math.hypot(particle.velocityX, particle.velocityY)));
    expect(speed(high)).toBeGreaterThan(speed(low)); expect(speed(createBloodEffectPlan(impact({ kind: "melee", damage: 100 })))).toBeLessThan(speed(high));
  });

  it("aggregates shotgun pellet damage into one representative event", () => {
    const combined = aggregateProjectileDamage([impact({ damage: 13, directionX: 1 }), impact({ damage: 13, directionX: .8 })]);
    expect(combined).toMatchObject({ damage: 26, directionX: 23.4 });
  });

  it("handles zero direction without NaN and does not mutate input",()=>{const input=impact({directionX:0,directionY:0,damage:999});const snapshot={...input};const plan=createBloodEffectPlan(input);expect(input).toEqual(snapshot);expect(plan.particles.every((particle)=>Number.isFinite(particle.velocityX)&&Number.isFinite(particle.velocityY))).toBe(true);expect(plan.decal.x-10).toBeLessThanOrEqual(44);});

  it("merges nearby fresh decals and keeps the batched store bounded", () => {
    const store = new BloodDecalStore(); store.add(0, 0, 2, 0); store.add(1, 1, 2, 50); expect(store.count).toBe(1);
    for (let index = 0; index < MAX_BLOOD_DECALS + 20; index += 1) store.add(index * 20, 100, 2, 1_000 + index * 200);
    expect(store.count).toBeLessThanOrEqual(MAX_BLOOD_DECALS);
  });
});
