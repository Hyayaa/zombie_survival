import type Phaser from "phaser";
import type { FirearmId } from "../data/weapon-definitions";
import { ProjectileRenderer, type ProjectileRenderItem } from "../rendering/projectile-renderer";
import type { Point } from "./zombie-ai-system";

export type ProjectileTeam = "player" | "ally" | "turret" | "zombie";
export type ProjectileWeaponId = FirearmId | "turret";
export const PROJECTILE_POOL_CAPACITY = 320;
const TARGET_BUCKET_SIZE = 48;

export interface ProjectileSpawn {
  shotSequence: number; pelletIndex: number; ownerId: string; team: ProjectileTeam; weaponId: ProjectileWeaponId;
  x: number; y: number; angle: number; speed: number; maximumDistance: number; damage: number; postureDamage: number;
  knockback: number; collisionRadius: number; visualLength: number; visualWidth: number; now: number;
}

export interface ProjectileTarget {
  id: string; position: Point; radius: number; alive: boolean; team: ProjectileTeam;
}

export interface ProjectileWorldHit { point: Point; amount: number; material?: "wall" | "metal" | "wood" }
export interface ProjectileImpact {
  type: "target" | "world";
  projectile: Readonly<ActiveProjectile>;
  point: Point;
  target?: ProjectileTarget;
  material?: ProjectileWorldHit["material"];
}

export interface ActiveProjectile extends ProjectileRenderItem {
  active: boolean; projectileId: number; spawnedAt: number; shotSequence: number; pelletIndex: number;
  ownerId: string; team: ProjectileTeam; weaponId: ProjectileWeaponId; previousX: number; previousY: number;
  travelledDistance: number; maximumDistance: number; damage: number; postureDamage: number; knockback: number; collisionRadius: number;
}

export interface ProjectileUpdateQuery {
  targets: readonly ProjectileTarget[];
  firstWorldHit: (from: Point, to: Point) => ProjectileWorldHit | null;
  onImpact: (impact: ProjectileImpact) => void;
}

export class ProjectileSystem {
  readonly capacity: number;
  private readonly slots: ActiveProjectile[];
  private readonly buckets = new Map<number, number[]>();
  private readonly usedBuckets: number[] = [];
  private readonly targetMarks = new Uint32Array(4096);
  private queryMark = 0;
  private nextProjectileId = 1;
  private renderer?: ProjectileRenderer;

  constructor(scene?: Phaser.Scene, isVisible: (x: number, y: number) => boolean = () => true, capacity = PROJECTILE_POOL_CAPACITY) {
    this.capacity = capacity;
    this.slots = Array.from({ length: capacity }, () => createEmptyProjectile());
    if (scene) this.renderer = new ProjectileRenderer(scene, isVisible);
  }

  spawn(input: ProjectileSpawn): number {
    let slot = this.slots.find((candidate) => !candidate.active);
    if (!slot) slot = this.slots.reduce((oldest, candidate) => candidate.spawnedAt < oldest.spawnedAt ? candidate : oldest);
    const id = this.nextProjectileId++;
    Object.assign(slot, input, {
      active: true, projectileId: id, spawnedAt: input.now, previousX: input.x, previousY: input.y,
      velocityX: Math.cos(input.angle) * input.speed, velocityY: Math.sin(input.angle) * input.speed,
      travelledDistance: 0,
    });
    return id;
  }

  update(deltaSeconds: number, query: ProjectileUpdateQuery): void {
    this.rebuildBuckets(query.targets);
    const delta = Math.max(0, Math.min(0.05, deltaSeconds));
    for (const projectile of this.slots) {
      if (!projectile.active) continue;
      const remaining = projectile.maximumDistance - projectile.travelledDistance;
      if (remaining <= 0) { projectile.active = false; continue; }
      const requestedDistance = Math.hypot(projectile.velocityX, projectile.velocityY) * delta;
      const stepDistance = Math.min(remaining, requestedDistance);
      if (stepDistance <= 0) continue;
      const speed = Math.max(1, Math.hypot(projectile.velocityX, projectile.velocityY));
      const from = { x: projectile.x, y: projectile.y };
      const to = { x: projectile.x + projectile.velocityX / speed * stepDistance, y: projectile.y + projectile.velocityY / speed * stepDistance };
      projectile.previousX = projectile.x; projectile.previousY = projectile.y;
      const worldHit = query.firstWorldHit(from, to);
      const targetHit = this.firstTargetHit(projectile, from, to, query.targets);
      if (worldHit && (!targetHit || worldHit.amount <= targetHit.amount)) {
        projectile.x = worldHit.point.x; projectile.y = worldHit.point.y;
        projectile.travelledDistance += stepDistance * worldHit.amount;
        query.onImpact({ type: "world", projectile, point: worldHit.point, material: worldHit.material });
        projectile.active = false;
      } else if (targetHit) {
        projectile.x = from.x + (to.x - from.x) * targetHit.amount;
        projectile.y = from.y + (to.y - from.y) * targetHit.amount;
        projectile.travelledDistance += stepDistance * targetHit.amount;
        query.onImpact({ type: "target", projectile, point: { x: projectile.x, y: projectile.y }, target: targetHit.target });
        projectile.active = false;
      } else {
        projectile.x = to.x; projectile.y = to.y; projectile.travelledDistance += stepDistance;
        if (projectile.travelledDistance >= projectile.maximumDistance - 0.001) projectile.active = false;
      }
    }
    this.renderer?.render(this.activeProjectiles());
  }

  clear(): void { for (const slot of this.slots) slot.active = false; this.renderer?.clear(); }
  destroy(): void { this.clear(); this.renderer?.destroy(); this.renderer = undefined; }
  get activeCount(): number { let count = 0; for (const slot of this.slots) if (slot.active) count += 1; return count; }
  *activeProjectiles(): IterableIterator<Readonly<ActiveProjectile>> { for (const slot of this.slots) if (slot.active) yield slot; }

  private rebuildBuckets(targets: readonly ProjectileTarget[]): void {
    for (const key of this.usedBuckets) this.buckets.get(key)!.length = 0;
    this.usedBuckets.length = 0;
    for (let index = 0; index < targets.length; index += 1) {
      const target = targets[index]!;
      if (!target.alive) continue;
      const cellX = Math.floor(target.position.x / TARGET_BUCKET_SIZE);
      const cellY = Math.floor(target.position.y / TARGET_BUCKET_SIZE);
      const key = bucketKey(cellX, cellY);
      let bucket = this.buckets.get(key);
      if (!bucket) { bucket = []; this.buckets.set(key, bucket); }
      if (bucket.length === 0) this.usedBuckets.push(key);
      bucket.push(index);
    }
  }

  private firstTargetHit(projectile: ActiveProjectile, from: Point, to: Point, targets: readonly ProjectileTarget[]): { target: ProjectileTarget; amount: number } | null {
    this.queryMark = (this.queryMark + 1) >>> 0 || 1;
    let best: { target: ProjectileTarget; amount: number } | null = null;
    const radius = projectile.collisionRadius + 8;
    const minX = Math.floor((Math.min(from.x, to.x) - radius) / TARGET_BUCKET_SIZE);
    const maxX = Math.floor((Math.max(from.x, to.x) + radius) / TARGET_BUCKET_SIZE);
    const minY = Math.floor((Math.min(from.y, to.y) - radius) / TARGET_BUCKET_SIZE);
    const maxY = Math.floor((Math.max(from.y, to.y) + radius) / TARGET_BUCKET_SIZE);
    for (let cellY = minY; cellY <= maxY; cellY += 1) for (let cellX = minX; cellX <= maxX; cellX += 1) {
      const bucket = this.buckets.get(bucketKey(cellX, cellY));
      if (!bucket) continue;
      for (const index of bucket) {
        if (index < this.targetMarks.length && this.targetMarks[index] === this.queryMark) continue;
        if (index < this.targetMarks.length) this.targetMarks[index] = this.queryMark;
        const target = targets[index]!;
        if (!target.alive || isFriendly(projectile.team, target.team)) continue;
        const amount = segmentCircleFirstAmount(from, to, target.position, target.radius + projectile.collisionRadius);
        if (amount !== null && (!best || amount < best.amount)) best = { target, amount };
      }
    }
    return best;
  }
}

export function segmentCircleFirstAmount(from: Point, to: Point, center: Point, radius: number): number | null {
  const dx = to.x - from.x; const dy = to.y - from.y;
  const fx = from.x - center.x; const fy = from.y - center.y;
  const a = dx * dx + dy * dy;
  if (a <= 0) return fx * fx + fy * fy <= radius * radius ? 0 : null;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const root = Math.sqrt(discriminant);
  const first = (-b - root) / (2 * a);
  const second = (-b + root) / (2 * a);
  if (first >= 0 && first <= 1) return first;
  if (second >= 0 && second <= 1) return second;
  return null;
}

function isFriendly(first: ProjectileTeam, second: ProjectileTeam): boolean {
  return first !== "zombie" && second !== "zombie" || first === "zombie" && second === "zombie";
}
function bucketKey(x: number, y: number): number { return ((y & 0xffff) << 16) ^ (x & 0xffff); }
function createEmptyProjectile(): ActiveProjectile {
  return { active: false, projectileId: 0, spawnedAt: 0, shotSequence: 0, pelletIndex: 0, ownerId: "", team: "player", weaponId: "pistol", x: 0, y: 0, previousX: 0, previousY: 0, velocityX: 0, velocityY: 0, travelledDistance: 0, maximumDistance: 0, damage: 0, postureDamage: 0, knockback: 0, collisionRadius: 1, visualLength: 1, visualWidth: 1 };
}
