import { CAMERA, WORLD_SIZE } from "../config/game-config";
import type { Point } from "./zombie-ai-system";

export interface CameraViewport {
  width: number;
  height: number;
  zoom: number;
  setZoom(zoom: number): unknown;
  setScroll(x: number, y: number): unknown;
}

export interface CameraFocusInput {
  playerX: number;
  playerY: number;
  pointerX: number;
  pointerY: number;
  pointerInsideGame: boolean;
}

export function stepCameraZoom(currentZoom: number, wheelDeltaY: number): number {
  const levels = CAMERA.zoomLevels;
  let index = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let candidate = 0; candidate < levels.length; candidate += 1) {
    const candidateDistance = Math.abs(levels[candidate]! - currentZoom);
    if (candidateDistance < nearestDistance) {
      index = candidate;
      nearestDistance = candidateDistance;
    }
  }
  if (wheelDeltaY < 0) index = Math.min(levels.length - 1, index + 1);
  if (wheelDeltaY > 0) index = Math.max(0, index - 1);
  return levels[index]!;
}

export function calculateCursorLedFocus(input: CameraFocusInput, output: Point = { x: 0, y: 0 }): Point {
  if (!input.pointerInsideGame) {
    output.x = input.playerX;
    output.y = input.playerY;
    return output;
  }

  let leadX = (input.pointerX - input.playerX) * 0.5;
  let leadY = (input.pointerY - input.playerY) * 0.5;
  const leadLength = Math.hypot(leadX, leadY);
  if (leadLength > CAMERA.maxCursorLead) {
    const scale = CAMERA.maxCursorLead / leadLength;
    leadX *= scale;
    leadY *= scale;
  }
  output.x = input.playerX + leadX;
  output.y = input.playerY + leadY;
  return output;
}

export function clampCameraFocus(
  focus: Point,
  cameraWidth: number,
  cameraHeight: number,
  zoom: number,
  worldWidth = WORLD_SIZE,
  worldHeight = WORLD_SIZE,
  output: Point = { x: 0, y: 0 },
): Point {
  const halfWidth = Math.min(worldWidth / 2, cameraWidth / Math.max(0.01, zoom) / 2);
  const halfHeight = Math.min(worldHeight / 2, cameraHeight / Math.max(0.01, zoom) / 2);
  output.x = clamp(focus.x, halfWidth, worldWidth - halfWidth);
  output.y = clamp(focus.y, halfHeight, worldHeight - halfHeight);
  return output;
}

export class CameraController {
  private readonly target: Point = { x: 0, y: 0 };
  private readonly clampedTarget: Point = { x: 0, y: 0 };
  private readonly focus: Point = { x: 0, y: 0 };
  private initialized = false;
  private zoom: number = CAMERA.defaultZoom;
  private pointerInside = false;
  private readonly pointerEnterListener = (): void => { this.pointerInside = true; };
  private readonly pointerLeaveListener = (): void => { this.pointerInside = false; };
  private readonly wheelListener = (event: WheelEvent): void => {
    event.preventDefault();
    if (this.canZoom()) this.handleWheel(event.deltaY);
  };

  constructor(
    private readonly camera: CameraViewport,
    private readonly canvas: HTMLCanvasElement,
    private readonly canZoom: () => boolean,
    private readonly worldWidth = WORLD_SIZE,
    private readonly worldHeight = WORLD_SIZE,
  ) {
    this.camera.setZoom(this.zoom);
    this.pointerInside = this.canvas.matches(":hover");
    this.canvas.addEventListener("wheel", this.wheelListener, { passive: false });
    this.canvas.addEventListener("pointerenter", this.pointerEnterListener);
    this.canvas.addEventListener("pointerleave", this.pointerLeaveListener);
  }

  handleWheel(deltaY: number): void {
    if (deltaY === 0) return;
    const nextZoom = stepCameraZoom(this.zoom, deltaY);
    if (nextZoom === this.zoom) return;
    this.zoom = nextZoom;
    this.camera.setZoom(nextZoom);
  }

  update(input: CameraFocusInput, deltaMs: number): void {
    calculateCursorLedFocus(input, this.target);
    clampCameraFocus(
      this.target,
      this.camera.width,
      this.camera.height,
      this.zoom,
      this.worldWidth,
      this.worldHeight,
      this.clampedTarget,
    );

    if (!this.initialized) {
      this.focus.x = this.clampedTarget.x;
      this.focus.y = this.clampedTarget.y;
      this.initialized = true;
    } else {
      const smoothing = 1 - Math.pow(1 - CAMERA.followLerp, Math.max(0, deltaMs) / (1_000 / 60));
      this.focus.x += (this.clampedTarget.x - this.focus.x) * smoothing;
      this.focus.y += (this.clampedTarget.y - this.focus.y) * smoothing;
    }

    clampCameraFocus(
      this.focus,
      this.camera.width,
      this.camera.height,
      this.zoom,
      this.worldWidth,
      this.worldHeight,
      this.focus,
    );
    const pixelStep = 1 / this.zoom;
    const snappedX = Math.round(this.focus.x / pixelStep) * pixelStep;
    const snappedY = Math.round(this.focus.y / pixelStep) * pixelStep;
    const halfWidth = this.camera.width / this.zoom / 2;
    const halfHeight = this.camera.height / this.zoom / 2;
    this.camera.setScroll(snappedX - halfWidth, snappedY - halfHeight);
  }

  getZoom(): number {
    return this.zoom;
  }

  getFocusPoint(): Readonly<Point> {
    return this.focus;
  }

  isPointerInsideGame(): boolean {
    return this.pointerInside;
  }

  destroy(): void {
    this.canvas.removeEventListener("wheel", this.wheelListener);
    this.canvas.removeEventListener("pointerenter", this.pointerEnterListener);
    this.canvas.removeEventListener("pointerleave", this.pointerLeaveListener);
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
