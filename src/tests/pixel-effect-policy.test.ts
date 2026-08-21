import type Phaser from "phaser";
import { describe, expect, it } from "vitest";
import { createCrescentTrailGeometry } from "../effects/melee-trail-geometry";
import { drawPixelRing, getPixelRingCells } from "../effects/pixel-ring-geometry";
import { PixelEffectSystem } from "../effects/pixel-effect-system";

class FakeRectangle {
  x = 0;
  y = 0;
  visible = false;
  setOrigin(): this { return this; }
  setVisible(value: boolean): this { this.visible = value; return this; }
  setDepth(): this { return this; }
  setPosition(x: number, y: number): this { this.x = x; this.y = y; return this; }
  setDisplaySize(): this { return this; }
  setFillStyle(): this { return this; }
  setBlendMode(): this { return this; }
  setAlpha(): this { return this; }
  destroy(): void {}
}

class FakeGraphics {
  readonly rects: Array<{ x: number; y: number; width: number; height: number }> = [];
  setDepth(): this { return this; }
  fillStyle(): this { return this; }
  fillRect(x: number, y: number, width: number, height: number): this { this.rects.push({ x, y, width, height }); return this; }
  clear(): this { this.rects.length = 0; return this; }
  destroy(): void {}
}

describe("pixel-only world effect policy", () => {
  it("represents crescents and telegraph rings only as integer pixel cells", () => {
    const crescent = createCrescentTrailGeometry({ originX: 3.4, originY: 7.6, aimAngle: 0.2, sweepDirection: 1, innerRadius: 13, outerRadius: 28, arcRadians: Math.PI / 2, maximumThickness: 6 });
    const ring = getPixelRingCells(11);
    for (const cell of [...crescent.frame.cells, ...crescent.frame.edgeCells, ...ring]) {
      expect(Number.isInteger(cell.x) && Number.isInteger(cell.y)).toBe(true);
    }
    const graphics = new FakeGraphics();
    drawPixelRing(graphics as unknown as Phaser.GameObjects.Graphics, 4.2, 5.8, 11, 0xffffff, 1, 2);
    expect(graphics.rects.length).toBeGreaterThan(0);
    expect(graphics.rects.every((rect) => Number.isInteger(rect.x) && Number.isInteger(rect.y) && rect.width === 1 && rect.height === 1)).toBe(true);
  });

  it("renders muzzle, blood, dust, fire, and melee through pixel rectangles and bounded shared pools", () => {
    const rectangles: FakeRectangle[] = [];
    const graphics: FakeGraphics[] = [];
    const scene = {
      add: {
        rectangle: () => { const rectangle = new FakeRectangle(); rectangles.push(rectangle); return rectangle; },
        graphics: () => { const value = new FakeGraphics(); graphics.push(value); return value; },
        circle: () => { throw new Error("world effect circle is forbidden"); },
        ellipse: () => { throw new Error("world effect ellipse is forbidden"); },
      },
    } as unknown as Phaser.Scene;
    const effects = new PixelEffectSystem(scene, () => true);
    effects.playAttack({ sequence: 1, weapon: "knife", meleeMode: "swing", originX: 10, originY: 10, angle: 0, startedAt: 0, impacts: [] });
    effects.playAttack({ sequence: 2, weapon: "pistol", originX: 10, originY: 10, angle: 0, startedAt: 0, impacts: [] });
    effects.emitDirectionalBlood({ kind: "projectile", damage: 20, hitX: 30, hitY: 10, directionX: 1, directionY: 0, weaponId: "pistol", sequence: 3 }, 0);
    effects.emitFootstepDust(10, 10, 0, true, "ground", 4, 0);
    effects.emitFireBurst(20, 20, 5, 0);
    effects.update(30, 0.016);
    expect(rectangles).toHaveLength(312);
    expect(graphics).toHaveLength(3);
    expect(rectangles.every((view) => Number.isInteger(view.x) && Number.isInteger(view.y))).toBe(true);
    expect(graphics.flatMap((view) => view.rects).every((rect) => Number.isInteger(rect.x) && Number.isInteger(rect.y))).toBe(true);
    expect(effects.getStats().capacity).toBe(536);
  });
});
