import { describe, expect, it } from "vitest";
import type Phaser from "phaser";
import { PixelEffectSystem } from "../effects/pixel-effect-system";
import { PixelSlotPool } from "../effects/pixel-effect-pool";

describe("PixelSlotPool", () => {
  it("reuses released slots without growing", () => {
    const pool = new PixelSlotPool(2);
    const first = pool.acquire(1, 0);
    const second = pool.acquire(1, 1);
    expect([first, second]).toEqual([0, 1]);
    pool.release(first);
    expect(pool.acquire(1, 2)).toBe(first);
    expect(pool.capacity).toBe(2);
    expect(pool.activeCount).toBe(2);
  });

  it("lets core effects replace older low-priority slots", () => {
    const pool = new PixelSlotPool(2);
    pool.acquire(1, 10);
    pool.acquire(1, 20);
    expect(pool.acquire(7, 30)).toBe(0);
    expect(pool.activeCount).toBe(2);
  });

  it("does not evict a core effect for lower-priority dust", () => {
    const pool = new PixelSlotPool(1);
    pool.acquire(7, 10);
    expect(pool.acquire(1, 20)).toBe(-1);
    expect(pool.activeCount).toBe(1);
  });

  it("clears every active slot and tolerates capacity pressure", () => {
    const pool = new PixelSlotPool(8);
    for (let attack = 0; attack < 100; attack += 1) {
      for (let pixel = 0; pixel < 16; pixel += 1) expect(() => pool.acquire(pixel % 7 + 1, attack * 16 + pixel)).not.toThrow();
    }
    expect(pool.capacity).toBe(8);
    expect(pool.activeCount).toBe(8);
    pool.clear();
    expect(pool.activeCount).toBe(0);
  });

  it("returns expired-style slots and stops allocating after destroy", () => {
    const pool = new PixelSlotPool(3);
    const slot = pool.acquire(2, 0);
    pool.release(slot);
    expect(pool.activeCount).toBe(0);
    pool.destroy();
    expect(pool.acquire(7, 100)).toBe(-1);
    expect(pool.activeCount).toBe(0);
  });
});

class FakeRectangle {
  x = 0;
  y = 0;
  visible = false;
  destroyed = false;
  setOrigin(): this { return this; }
  setVisible(value: boolean): this { this.visible = value; return this; }
  setDepth(): this { return this; }
  setPosition(x: number, y: number): this { this.x = x; this.y = y; return this; }
  setDisplaySize(): this { return this; }
  setFillStyle(): this { return this; }
  setBlendMode(): this { return this; }
  setAlpha(): this { return this; }
  destroy(): void { this.destroyed = true; }
}

describe("PixelEffectSystem pooling", () => {
  it("runs 100 attacks without creating more primitives and destroys every view", () => {
    const views: FakeRectangle[] = [];
    const scene = {
      add: {
        rectangle: () => {
          const view = new FakeRectangle();
          views.push(view);
          return view;
        },
      },
    } as unknown as Phaser.Scene;
    const effects = new PixelEffectSystem(scene, () => true);
    expect(views).toHaveLength(312);
    for (let attack = 0; attack < 100; attack += 1) {
      effects.playAttack({
        sequence: attack + 1,
        weapon: attack % 3 === 0 ? "pistol" : attack % 3 === 1 ? "knife" : "bat",
        originX: 100,
        originY: 100,
        angle: attack * 0.1,
        startedAt: attack * 300,
        endpointX: 180,
        endpointY: 100,
        impacts: [{ x: 180, y: 100, kind: attack % 2 === 0 ? "wall" : "zombie" }],
        alwaysShowCore: true,
      });
      effects.update(attack * 300 + 100, 0.016);
    }
    expect(views).toHaveLength(312);
    expect(effects.getStats().capacity).toBe(312);
    effects.clear();
    expect(effects.getStats()).toMatchObject({ particles: 0, swings: 0, muzzle: 0, tracers: 0 });
    effects.destroy();
    expect(views.every((view) => view.destroyed)).toBe(true);
  });
});
