import type { GameClock } from "../core/game-clock";
import type { VisionSource } from "./fog-of-war-system";
import type { Point } from "./zombie-ai-system";

export interface ActiveFire extends Point {
  remaining: number;
}

export interface PlayerLightState extends Point {
  aimAngle: number;
  flashlightOn: boolean;
  torchRemaining: number;
}

export function buildVisionSources(player: PlayerLightState, clock: GameClock, fires: readonly ActiveFire[]): VisionSource[] {
  const sources: VisionSource[] = [{
    x: player.x,
    y: player.y,
    radius: clock.getBaseVisionRadius(),
    intensity: 1,
    sourceType: "player",
  }];
  if (player.torchRemaining > 0) {
    sources.push({ x: player.x, y: player.y, radius: 170, intensity: 1, sourceType: "torch" });
  }
  if (player.flashlightOn) {
    sources.push({ x: player.x, y: player.y, radius: 245, intensity: 1, sourceType: "flashlight", direction: player.aimAngle, coneAngle: Math.PI * 0.34 });
  }
  fires.filter((fire) => fire.remaining > 0).forEach((fire) => {
    sources.push({ x: fire.x, y: fire.y, radius: 76, intensity: 0.9, sourceType: "fire" });
  });
  return sources;
}

