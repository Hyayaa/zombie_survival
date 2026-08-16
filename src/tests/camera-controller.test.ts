import { describe, expect, it } from "vitest";
import { CAMERA, LOGICAL_HEIGHT, LOGICAL_WIDTH, WORLD_HEIGHT, WORLD_WIDTH } from "../config/game-config";
import { calculateCameraPadding, calculateCursorLedFocus, CameraController, clampCameraFocus, configurePaddedCameraBounds, stepCameraZoom, type CameraViewport } from "../systems/camera-controller";

describe("camera controller math", () => {
  it("starts from 1x and clamps wheel steps to 0.35x..2x", () => {
    expect(CAMERA.defaultZoom).toBe(1);
    expect(stepCameraZoom(1, -1)).toBe(1.2);
    expect(stepCameraZoom(1, 1)).toBe(0.85);
    let zoom: number = CAMERA.defaultZoom;
    for (let index = 0; index < 50; index += 1) zoom = stepCameraZoom(zoom, -1);
    expect(zoom).toBe(2);
    for (let index = 0; index < 100; index += 1) zoom = stepCameraZoom(zoom, 1);
    expect(zoom).toBe(0.35);
  });

  it("keeps pointer=player exact and applies a stable deadzone", () => {
    for (const zoom of CAMERA.zoomLevels) {
      expect(calculateCursorLedFocus({ playerX: 180, playerY: 180, pointerX: 180, pointerY: 180, pointerInsideGame: true }))
        .toEqual({ x: 180, y: 180 });
      expect(zoom).toBeGreaterThan(0);
    }
    expect(calculateCursorLedFocus({ playerX: 100, playerY: 100, pointerX: 105, pointerY: 100, pointerInsideGame: true }))
      .toEqual({ x: 100, y: 100 });
  });

  it("keeps lead symmetric and limits diagonal magnitude to 132px", () => {
    const right = calculateCursorLedFocus({ playerX: 400, playerY: 400, pointerX: 600, pointerY: 400, pointerInsideGame: true });
    const left = calculateCursorLedFocus({ playerX: 400, playerY: 400, pointerX: 200, pointerY: 400, pointerInsideGame: true });
    const up = calculateCursorLedFocus({ playerX: 400, playerY: 400, pointerX: 400, pointerY: 200, pointerInsideGame: true });
    const down = calculateCursorLedFocus({ playerX: 400, playerY: 400, pointerX: 400, pointerY: 600, pointerInsideGame: true });
    expect(right.x - 400).toBeCloseTo(400 - left.x);
    expect(400 - up.y).toBeCloseTo(down.y - 400);
    const diagonal = calculateCursorLedFocus({ playerX: 400, playerY: 400, pointerX: 1_000, pointerY: 1_000, pointerInsideGame: true });
    expect(Math.hypot(diagonal.x - 400, diagonal.y - 400)).toBeCloseTo(132, 5);
  });

  it("clamps focus only to the playable world instead of viewport half-size", () => {
    expect(clampCameraFocus({ x: -50, y: -50 }, LOGICAL_WIDTH, LOGICAL_HEIGHT, 0.35)).toEqual({ x: 0, y: 0 });
    expect(clampCameraFocus({ x: 5_000, y: 5_000 }, LOGICAL_WIDTH, LOGICAL_HEIGHT, 2)).toEqual({ x: WORLD_WIDTH, y: WORLD_HEIGHT });
    expect(clampCameraFocus({ x: 180, y: 180 }, LOGICAL_WIDTH, LOGICAL_HEIGHT, 0.35)).toEqual({ x: 180, y: 180 });
  });

  it("configures padded camera bounds from minimum zoom", () => {
    const calls: number[][] = [];
    const padding = configurePaddedCameraBounds({ setBounds: (...values: number[]) => { calls.push(values); } });
    expect(padding).toEqual(calculateCameraPadding());
    expect(padding.x).toBe(Math.ceil(LOGICAL_WIDTH / 0.35 / 2));
    expect(padding.y).toBe(Math.ceil(LOGICAL_HEIGHT / 0.35 / 2));
    expect(calls[0]).toEqual([-padding.x, -padding.y, WORLD_WIDTH + padding.x * 2, WORLD_HEIGHT + padding.y * 2]);
  });

  it("centers the 180,180 start exactly at 0.35x and removes listeners on destroy", () => {
    const listeners = new Map<string, EventListener>();
    const canvas = {
      matches: () => false,
      addEventListener: (name: string, listener: EventListener) => listeners.set(name, listener),
      removeEventListener: (name: string, listener: EventListener) => { if (listeners.get(name) === listener) listeners.delete(name); },
    } as unknown as HTMLCanvasElement;
    const centers: Array<{ x: number; y: number }> = [];
    const camera: CameraViewport = {
      width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT, zoom: 1,
      setZoom(zoom) { this.zoom = zoom; }, setScroll() {}, centerOn(x, y) { centers.push({ x, y }); },
    };
    const controller = new CameraController(camera, canvas, () => true);
    for (let index = 0; index < 10; index += 1) controller.handleWheel(1);
    expect(controller.getZoom()).toBe(0.35);
    controller.update({ playerX: 180, playerY: 180, pointerX: 180, pointerY: 180, pointerInsideGame: true }, 16);
    expect(centers.at(-1)).toEqual({ x: 180, y: 180 });
    let prevented = false;
    listeners.get("wheel")?.({ deltaY: -1, preventDefault: () => { prevented = true; } } as WheelEvent);
    expect(prevented).toBe(true);
    controller.destroy();
    expect(listeners.has("wheel")).toBe(false);
  });
});
