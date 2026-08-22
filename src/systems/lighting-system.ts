import type { GameClock } from "../core/game-clock";
import { VISION } from "../config/game-config";
import type { VisionSource } from "./fog-of-war-system";
import type { Point } from "./zombie-ai-system";

export interface ActiveFire extends Point {
  id?: string;
  remaining: number;
}

export interface PlayerLightState extends Point {
  aimAngle: number;
  flashlightOn: boolean;
  torchRemaining: number;
}

export interface CompanionLightState {
  id: string;
  position: Point;
  rescued: boolean;
  alive: boolean;
}

export interface VisionProfile {
  darknessFactor: number;
  ambientRadius: number;
  flashlightFactor: number;
  effectiveFlashlightRadius: number;
}

export function getVisionProfile(clock: Pick<GameClock, "getDarknessFactor">): VisionProfile {
  const darknessFactor = clock.getDarknessFactor();
  const ambientRadius = lerp(VISION.playerDayOmniRadius, VISION.playerNightOmniRadius, darknessFactor);
  const flashlightFactor = smoothstepRange(0.15, 0.75, darknessFactor);
  return {
    darknessFactor,
    ambientRadius,
    flashlightFactor,
    effectiveFlashlightRadius: VISION.flashlightRadius * flashlightFactor,
  };
}

export function shouldConsumeFlashlightCharge(flashlightOn: boolean, flashlightCharge: number, clock: Pick<GameClock, "getDarknessFactor">): boolean {
  return flashlightOn && flashlightCharge > 0 && getVisionProfile(clock).flashlightFactor > 0;
}

export function buildVisionSources(
  player: PlayerLightState,
  clock: GameClock,
  fires: readonly ActiveFire[],
  companions: readonly CompanionLightState[] = [],
  output: VisionSource[] = [],
): VisionSource[] {
  const profile = getVisionProfile(clock);
  output.length = 0;
  output.push({
    id: "player-proximity",
    x: player.x,
    y: player.y,
    radius: VISION.proximityRadius,
    intensity: 1,
    sourceType: "proximity",
  }, {
    id: "player:ambient",
    x: player.x,
    y: player.y,
    radius: profile.ambientRadius,
    intensity: 1,
    sourceType: "player",
  });
  if (player.torchRemaining > 0) {
    output.push({ id: "player-torch", x: player.x, y: player.y, radius: VISION.torchRadius, intensity: 1, sourceType: "torch" });
  }
  if (player.flashlightOn && profile.flashlightFactor > 0) {
    output.push({ id: "player-flashlight", x: player.x, y: player.y, radius: profile.effectiveFlashlightRadius, intensity: 1, sourceType: "flashlight", direction: player.aimAngle, coneAngle: VISION.flashlightConeAngle });
  }
  for (const fire of fires) {
    if (fire.remaining > 0) output.push({ id: `fire:${"id" in fire ? String(fire.id) : `${Math.round(fire.x)}:${Math.round(fire.y)}`}`, x: fire.x, y: fire.y, radius: VISION.fireRadius, intensity: VISION.fireIntensity, sourceType: "fire" });
  }
  for (const companion of companions) {
    if (!companion.rescued || !companion.alive) continue;
    output.push({ id: `companion:${companion.id}`, x: companion.position.x, y: companion.position.y, radius: VISION.companionOmniRadius, intensity: 1, sourceType: "companion" });
  }
  return output;
}

export function getCompanionVisionSignature(companions: readonly CompanionLightState[], cellSize: number, widthCells: number): number {
  let signature = 0x811c9dc5;
  for (const companion of companions) {
    if (!companion.rescued || !companion.alive) continue;
    const cellX = Math.floor(companion.position.x / cellSize);
    const cellY = Math.floor(companion.position.y / cellSize);
    signature ^= cellY * widthCells + cellX;
    signature = Math.imul(signature, 0x01000193);
    for (let index = 0; index < companion.id.length; index += 1) {
      signature ^= companion.id.charCodeAt(index);
      signature = Math.imul(signature, 0x01000193);
    }
  }
  return signature >>> 0;
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function smoothstepRange(edge0: number, edge1: number, value: number): number {
  const amount = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return amount * amount * (3 - 2 * amount);
}
