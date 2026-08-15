import Phaser from "phaser";
import { DEPTH } from "../config/game-config";

interface PooledParticle {
  view: Phaser.GameObjects.Rectangle;
  velocityX: number;
  velocityY: number;
  expiresAt: number;
}

export class ParticlePool {
  private readonly particles: PooledParticle[];

  constructor(scene: Phaser.Scene, size = 48) {
    this.particles = Array.from({ length: size }, () => ({
      view: scene.add.rectangle(0, 0, 2, 2, 0x8d3d36).setVisible(false).setDepth(DEPTH.propFront + 300),
      velocityX: 0,
      velocityY: 0,
      expiresAt: 0,
    }));
  }

  burst(x: number, y: number, color: number, count: number, now: number): void {
    const available = this.particles.filter((particle) => !particle.view.visible).slice(0, count);
    available.forEach((particle, index) => {
      const angle = (index / Math.max(1, available.length)) * Math.PI * 2 + (now % 100) / 100;
      const speed = 12 + (index % 3) * 8;
      particle.view.setPosition(Math.round(x), Math.round(y)).setFillStyle(color).setVisible(true).setAlpha(1);
      particle.velocityX = Math.cos(angle) * speed;
      particle.velocityY = Math.sin(angle) * speed;
      particle.expiresAt = now + 320 + (index % 4) * 35;
    });
  }

  update(now: number, deltaSeconds: number): void {
    this.particles.forEach((particle) => {
      if (!particle.view.visible) return;
      if (now >= particle.expiresAt) {
        particle.view.setVisible(false);
        return;
      }
      particle.view.x = Math.round(particle.view.x + particle.velocityX * deltaSeconds);
      particle.view.y = Math.round(particle.view.y + particle.velocityY * deltaSeconds);
      particle.view.setAlpha(Math.max(0, (particle.expiresAt - now) / 320));
    });
  }

  destroy(): void {
    this.particles.forEach((particle) => particle.view.destroy());
  }
}

