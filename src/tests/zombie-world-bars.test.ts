import type Phaser from "phaser";
import { describe, expect, it } from "vitest";
import { Zombie } from "../entities/zombie";

class FakeShape {
  x = 0;
  y = 0;
  rotation = 0;
  visible = true;
  setFillStyle(): this { return this; }
  setStrokeStyle(): this { return this; }
  setOrigin(): this { return this; }
  setVisible(value: boolean): this { this.visible = value; return this; }
  setPosition(x: number, y: number): this { this.x = x; this.y = y; return this; }
  setDisplaySize(): this { return this; }
  setDepth(): this { return this; }
  setAlpha(): this { return this; }
  destroy(): void {}
}

class FakeContainer extends FakeShape {
  readonly children: unknown[] = [];
  add(children: unknown | unknown[]): this { this.children.push(...(Array.isArray(children) ? children : [children])); return this; }
  destroy(): void {}
}

function createScene() {
  const rectangles: FakeShape[] = [];
  return {
    rectangles,
    scene: {
      add: {
        container: () => new FakeContainer(),
        ellipse: () => new FakeShape(),
        circle: () => new FakeShape(),
        rectangle: () => { const shape = new FakeShape(); rectangles.push(shape); return shape; },
      },
    } as unknown as Phaser.Scene,
  };
}

describe("zombie world bars", () => {
  it("creates no zombie health or posture bar GameObjects", () => {
    const runtime = createScene();
    const zombie = new Zombie(runtime.scene, "z-1", "walker", { x: 10, y: 20 });
    expect(runtime.rectangles).toHaveLength(1);
    expect("setPosture" in zombie.view).toBe(false);
    zombie.updateView(100, true);
    expect(runtime.rectangles).toHaveLength(1);
  });

  it("does not create or update bars after health and posture damage", () => {
    const runtime = createScene();
    const zombie = new Zombie(runtime.scene, "z-2", "walker", { x: 0, y: 0 });
    zombie.damage(10, { x: 0, y: 0 }, 100);
    const result = zombie.damagePosture(101, 100);
    zombie.updateView(120, true);
    expect(runtime.rectangles).toHaveLength(1);
    expect(zombie.health).toBe(zombie.definition.health - 10);
    expect(zombie.posture.maximum).toBe(zombie.definition.postureMaximum);
    expect(result.broken).toBe(true);
    expect(zombie.staggerUntil).toBeGreaterThan(100);
    expect(() => zombie.view.destroy()).not.toThrow();
  });
});
