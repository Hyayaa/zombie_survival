import { describe, expect, it } from "vitest";
import { CAMERA, LOGICAL_HEIGHT, LOGICAL_WIDTH, WORLD_SIZE } from "../config/game-config";
import { calculateCursorLedFocus, CameraController, clampCameraFocus, stepCameraZoom, type CameraViewport } from "../systems/camera-controller";

describe("camera controller math", () => {
  it("starts from the configured 1x zoom and moves one wheel step at a time", () => {
    expect(CAMERA.defaultZoom).toBe(1);
    expect(stepCameraZoom(1, -1)).toBe(1.2);
    expect(stepCameraZoom(1, 1)).toBe(0.85);
  });

  it("clamps repeated wheel input to the minimum and maximum levels", () => {
    let zoom: number = CAMERA.defaultZoom;
    for (let index = 0; index < 50; index += 1) zoom = stepCameraZoom(zoom, -1);
    expect(zoom).toBe(2);
    for (let index = 0; index < 100; index += 1) zoom = stepCameraZoom(zoom, 1);
    expect(zoom).toBe(0.55);
  });

  it("places focus between the player and cursor", () => {
    const centered = calculateCursorLedFocus({ playerX: 100, playerY: 100, pointerX: 100, pointerY: 100, pointerInsideGame: true });
    const right = calculateCursorLedFocus({ playerX: 100, playerY: 100, pointerX: 180, pointerY: 100, pointerInsideGame: true });
    const left = calculateCursorLedFocus({ playerX: 100, playerY: 100, pointerX: 20, pointerY: 100, pointerInsideGame: true });
    expect(centered).toEqual({ x: 100, y: 100 });
    expect(right.x).toBeGreaterThan(100);
    expect(right.x).toBeLessThan(180);
    expect(left.x).toBeLessThan(100);
    expect(left.x).toBeGreaterThan(20);
  });

  it("never exceeds the 132px cursor lead", () => {
    const focus = calculateCursorLedFocus({ playerX: 400, playerY: 400, pointerX: 1_000, pointerY: 1_000, pointerInsideGame: true });
    expect(Math.hypot(focus.x - 400, focus.y - 400)).toBeCloseTo(132, 5);
  });

  it("returns focus to the player when the pointer leaves the game", () => {
    expect(calculateCursorLedFocus({ playerX: 120, playerY: 220, pointerX: 900, pointerY: 900, pointerInsideGame: false }))
      .toEqual({ x: 120, y: 220 });
  });

  it("clamps every world edge using the current zoom", () => {
    const minimumZoom = clampCameraFocus({ x: -50, y: -50 }, LOGICAL_WIDTH, LOGICAL_HEIGHT, 0.55);
    expect(minimumZoom.x).toBeCloseTo(LOGICAL_WIDTH / 0.55 / 2);
    expect(minimumZoom.y).toBeCloseTo(LOGICAL_HEIGHT / 0.55 / 2);
    const maximumZoom = clampCameraFocus({ x: 2_000, y: 2_000 }, LOGICAL_WIDTH, LOGICAL_HEIGHT, 2);
    expect(maximumZoom.x).toBeCloseTo(WORLD_SIZE - LOGICAL_WIDTH / 2 / 2);
    expect(maximumZoom.y).toBeCloseTo(WORLD_SIZE - LOGICAL_HEIGHT / 2 / 2);
  });

  it("reuses one wheel listener, prevents page scroll and removes it on destroy", () => {
    const listeners = new Map<string, EventListener>();
    const canvas = {
      matches: () => false,
      addEventListener: (name: string, listener: EventListener) => listeners.set(name, listener),
      removeEventListener: (name: string, listener: EventListener) => {
        if (listeners.get(name) === listener) listeners.delete(name);
      },
    } as unknown as HTMLCanvasElement;
    const camera: CameraViewport = {
      width: LOGICAL_WIDTH,
      height: LOGICAL_HEIGHT,
      zoom: 1,
      setZoom(zoom) { this.zoom = zoom; },
      setScroll() {},
    };
    const controller = new CameraController(camera, canvas, () => true);
    let prevented = false;
    listeners.get("wheel")?.({ deltaY: -1, preventDefault: () => { prevented = true; } } as WheelEvent);
    expect(prevented).toBe(true);
    expect(controller.getZoom()).toBe(1.2);
    controller.update({ playerX: 300, playerY: 300, pointerX: 500, pointerY: 300, pointerInsideGame: true }, 16);
    const firstFocus = controller.getFocusPoint().x;
    for (let frame = 0; frame < 120; frame += 1) {
      controller.update({ playerX: 300, playerY: 300, pointerX: 500, pointerY: 300, pointerInsideGame: true }, 16);
    }
    expect(controller.getFocusPoint().x).toBeGreaterThanOrEqual(firstFocus);
    expect(controller.getFocusPoint().x).toBeLessThanOrEqual(400);
    controller.destroy();
    expect(listeners.has("wheel")).toBe(false);
  });
});
