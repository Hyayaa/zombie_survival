import { effectRandom, effectSeed } from "./pixel-effect-math";

export type PixelDebrisKind = "wall" | "metal" | "wood" | "posture" | "bat-ground";
export interface PixelDebrisParticle { velocityX: number; velocityY: number; color: number; width: number; height: number; lifetimeMs: number }

const COLORS: Record<PixelDebrisKind, readonly number[]> = {
  wall: [0xaaa38e, 0x777468, 0x5e5b53], metal: [0xfff3bd, 0xe8d073, 0xa5a8a2],
  wood: [0xa37b50, 0x7a5c40, 0x594535], posture: [0xe8dfb2, 0xb3b09d, 0x77786f],
  "bat-ground": [0x847966, 0x6b6357, 0x9b8d74],
};

export function createPixelDebrisPlan(kind: PixelDebrisKind, sequence: number, angle: number, destroyed = false): PixelDebrisParticle[] {
  const seed = effectSeed(sequence, kind === "metal" ? "turret" : "bat", Math.round(angle * 100), destroyed ? 1 : 0);
  const count = kind === "posture" ? 7 : kind === "bat-ground" ? 6 : destroyed ? 11 : kind === "metal" ? 5 : 5;
  const palette = COLORS[kind];
  return Array.from({ length: count }, (_, index) => {
    const radial = kind === "posture" || kind === "bat-ground";
    const particleAngle = radial ? effectRandom(seed, index * 3) * Math.PI * 2 : angle + Math.PI + (effectRandom(seed, index * 3) - 0.5) * 1.45;
    const speed = (kind === "metal" ? 28 : 10) + effectRandom(seed, index * 3 + 1) * (destroyed ? 30 : kind === "posture" ? 26 : 20);
    return {
      velocityX: Math.cos(particleAngle) * speed, velocityY: Math.sin(particleAngle) * speed,
      color: palette[index % palette.length]!, width: index % 5 === 0 ? 2 : 1, height: kind === "metal" && index < 3 ? 1 : index % 7 === 0 ? 2 : 1,
      lifetimeMs: (kind === "metal" ? 75 : kind === "posture" ? 105 : 165) + effectRandom(seed, index * 3 + 2) * (kind === "metal" ? 45 : kind === "posture" ? 70 : 130),
    };
  });
}
