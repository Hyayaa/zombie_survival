export type FootstepDustTerrain = "ground" | "road" | "sidewalk" | "floor";
export interface FootstepDustParticlePlan { velocityX: number; velocityY: number; lifetimeMs: number; size: 1 | 2; color: number }

export function createFootstepDustPlan(sequence: number, movementAngle: number, running: boolean, terrain: FootstepDustTerrain): FootstepDustParticlePlan[] {
  if (terrain === "floor") return [];
  const seed = mix(sequence, running ? 31 : 7);
  const baseCount = running ? 3 + Math.floor(random(seed, 0) * 4) : 1 + Math.floor(random(seed, 0) * 3);
  const count = terrain === "ground" ? baseCount : Math.max(1, Math.ceil(baseCount * .45));
  const plans: FootstepDustParticlePlan[] = [];
  const backward = movementAngle + Math.PI;
  const colors = terrain === "ground" ? [0x706759, 0x827665, 0x5c554b] : terrain === "road" ? [0x505654, 0x626866] : [0x777b76, 0x8b8e87];
  for (let index = 0; index < count; index += 1) {
    const angle = backward + (random(seed, 1 + index * 4) - .5) * 1.05;
    const lifetimeMs = running ? 220 + random(seed, 2 + index * 4) * 140 : 160 + random(seed, 2 + index * 4) * 100;
    const travel = running ? 5 + random(seed, 3 + index * 4) * 8 : 2 + random(seed, 3 + index * 4) * 5;
    const speed = travel / (lifetimeMs / 1_000 * .7);
    const size = (1 + Math.floor(random(seed, 4 + index * 4) * 2)) as 1 | 2;
    plans.push({ velocityX: Math.cos(angle) * speed, velocityY: Math.sin(angle) * speed, lifetimeMs, size, color: colors[index % colors.length]! });
  }
  return plans;
}

function mix(sequence: number, salt: number): number { let value = (sequence ^ Math.imul(salt, 0x9e3779b1)) >>> 0; value ^= value >>> 16; return Math.imul(value, 0x7feb352d) >>> 0; }
function random(seed: number, salt: number): number { let value = (seed ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0; value ^= value >>> 13; value = Math.imul(value, 0xc2b2ae35); return ((value ^ (value >>> 16)) >>> 0) / 0x1_0000_0000; }
