import Phaser from "phaser";
import type { FogRenderMetrics } from "../rendering/fog-renderer";
import type { StaticChunkMetrics } from "../rendering/map-renderer";

const SAMPLE_COUNT = 120;
const OVERLAY_INTERVAL_MS = 750;
const SECTION_NAMES = ["world update", "player", "companion AI", "zombie AI", "projectiles", "fog", "map culling", "minimap", "world objects", "pixel effects"] as const;
export type RuntimePerformanceSection = typeof SECTION_NAMES[number];

interface RollingSamples { values: Float32Array; index: number; count: number; calls: number; targets: number }

export class PerformanceMonitor {
  private readonly available = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true;
  private enabled: boolean;
  private readonly frameTimes = new Float32Array(SAMPLE_COUNT);
  private readonly frameScratch = new Float32Array(SAMPLE_COUNT);
  private readonly sections = new Map<RuntimePerformanceSection, RollingSamples>();
  private readonly sectionOrder = SECTION_NAMES.map((_, index) => index);
  private overlay?: HTMLPreElement;
  private toggleKey?: Phaser.Input.Keyboard.Key;
  private frameIndex = 0;
  private frameCount = 0;
  private frameStartedAt = 0;
  private lastOverlayAt = 0;
  private fogCalculationMs = 0;
  private fogTextureMs = 0;
  private fogRecomputeCount = 0;
  private pathfindingWork = 0;
  private separationCandidates = 0;
  private cameraZoom = 1;
  private minimapOpen = false;
  private companionDistance = 0;
  private companionCatchUp = false;
  private companionStuckMs = 0;
  private companionRepathCount = 0;
  private staticMetrics: StaticChunkMetrics = { visibleChunks: 0, renderedChunks: 0, terrainChunks: 0, structureChunks: 0, decorationChunks: 0 };
  private fogMetrics: FogRenderMetrics = { visibleChunks: 0, dirtyChunks: 0, chunkWidthCells: 0, chunkHeightCells: 0 };
  private generatedWalls = 0;
  private generatedDoors = 0;
  private staticProps = 0;
  private interactiveFurniture = 0;
  private registryObjects = 0;
  private activeCompanions = 0;
  private activeProjectiles = 0;
  private worldWidthPixels = 0;
  private worldHeightPixels = 0;
  private fogWidthCells = 0;
  private fogHeightCells = 0;
  private readonly maximumTextureSize: number;

  constructor(private readonly scene: Phaser.Scene, parent: HTMLElement, enabled = false) {
    this.enabled = this.available && enabled;
    const gl = (scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).gl;
    this.maximumTextureSize = gl ? Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) : 0;
    for (const name of SECTION_NAMES) this.sections.set(name, { values: new Float32Array(SAMPLE_COUNT), index: 0, count: 0, calls: 0, targets: 0 });
    if (!this.available) return;
    this.overlay = document.createElement("pre");
    this.overlay.hidden = !this.enabled;
    Object.assign(this.overlay.style, {
      position: "absolute", top: "8px", right: "8px", zIndex: "1000", margin: "0", padding: "7px 9px",
      color: "#d7ece4", background: "rgba(4, 10, 12, 0.86)", border: "1px solid #45625a",
      font: "10px/1.35 monospace", pointerEvents: "none",
    });
    parent.append(this.overlay);
    this.toggleKey = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.F2);
  }

  setEnabled(enabled: boolean): void { this.enabled = this.available && enabled; if (!this.enabled && this.overlay) this.overlay.hidden = true; }

  beginFrame(frameTimeMs: number): void {
    if (!this.enabled) return;
    this.frameStartedAt = performance.now();
    this.frameTimes[this.frameIndex] = frameTimeMs;
    this.frameIndex = (this.frameIndex + 1) % SAMPLE_COUNT;
    this.frameCount = Math.min(SAMPLE_COUNT, this.frameCount + 1);
    this.pathfindingWork = 0;
    this.separationCandidates = 0;
  }

  endFrame(): void { if (this.enabled) this.recordSection("world update", performance.now() - this.frameStartedAt); }
  startSection(): number { return this.enabled ? performance.now() : 0; }
  endSection(name: RuntimePerformanceSection, startedAt: number, targets = 0): void { if (this.enabled) this.recordSection(name, performance.now() - startedAt, targets); }

  recordFog(calculationMs: number, textureMs: number): void {
    if (!this.enabled) return;
    this.fogCalculationMs = calculationMs; this.fogTextureMs = textureMs; this.fogRecomputeCount += 1;
  }
  recordPathfinding(): void { if (this.enabled) this.pathfindingWork += 1; }
  recordSeparationCandidates(count: number): void { if (this.enabled) this.separationCandidates = count; }
  recordCameraAndMinimap(zoom: number, minimapOpen: boolean): void { if (this.enabled) { this.cameraZoom = zoom; this.minimapOpen = minimapOpen; } }
  recordCompanion(distance: number, catchUp: boolean, stuckMs: number, repathCount: number): void {
    if (!this.enabled) return;
    this.companionDistance = distance; this.companionCatchUp = catchUp; this.companionStuckMs = stuckMs; this.companionRepathCount = repathCount;
  }
  recordWorldCounts(staticMetrics: StaticChunkMetrics, fogMetrics: FogRenderMetrics, generatedWalls: number, generatedDoors: number, staticProps: number, interactiveFurniture: number, registryObjects: number, activeCompanions: number, activeProjectiles: number, worldWidthPixels: number, worldHeightPixels: number, fogWidthCells: number, fogHeightCells: number): void {
    if (!this.enabled) return;
    this.staticMetrics = staticMetrics; this.fogMetrics = fogMetrics; this.generatedWalls = generatedWalls; this.generatedDoors = generatedDoors;
    this.staticProps = staticProps; this.interactiveFurniture = interactiveFurniture; this.registryObjects = registryObjects; this.activeCompanions = activeCompanions; this.activeProjectiles = activeProjectiles;
    this.worldWidthPixels = worldWidthPixels; this.worldHeightPixels = worldHeightPixels; this.fogWidthCells = fogWidthCells; this.fogHeightCells = fogHeightCells;
  }

  update(now: number, activeZombies: number): void {
    if (!this.available || !this.overlay) return;
    if (this.enabled && this.toggleKey && Phaser.Input.Keyboard.JustDown(this.toggleKey)) this.overlay.hidden = !this.overlay.hidden;
    if (!this.enabled || this.overlay.hidden || now < this.lastOverlayAt + OVERLAY_INTERVAL_MS || this.frameCount === 0) return;
    this.lastOverlayAt = now;
    const frame = summarize(this.frameTimes, this.frameCount, this.frameScratch);
    const displayObjects = this.scene.children.list;
    let visibleObjects = 0;
    for (const object of displayObjects) if ((object as Phaser.GameObjects.GameObject & { visible?: boolean }).visible !== false) visibleObjects += 1;
    const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
    const sectionRows = this.getTopSectionRows(5);
    this.overlay.textContent = [
      `FPS ${(1_000 / Math.max(0.01, frame.average)).toFixed(1)}`,
      `frame avg ${frame.average.toFixed(2)} ms`, `frame max ${frame.maximum.toFixed(2)} ms`, `frame p95 ${frame.p95.toFixed(2)} ms`,
      ...sectionRows,
      `fog calc ${this.fogCalculationMs.toFixed(2)} ms`, `fog texture ${this.fogTextureMs.toFixed(2)} ms`, `fog recomputes ${this.fogRecomputeCount}`,
      `chunks visible/rendered ${this.staticMetrics.visibleChunks}/${this.staticMetrics.renderedChunks}`,
      `terrain/structure/decor ${this.staticMetrics.terrainChunks}/${this.staticMetrics.structureChunks}/${this.staticMetrics.decorationChunks}`,
      `fog chunks visible/dirty ${this.fogMetrics.visibleChunks}/${this.fogMetrics.dirtyChunks} (${this.fogMetrics.chunkWidthCells}x${this.fogMetrics.chunkHeightCells})`,
      `world px ${this.worldWidthPixels}x${this.worldHeightPixels} fog cells ${this.fogWidthCells}x${this.fogHeightCells}`,
      `GPU max texture ${this.maximumTextureSize}`,
      `walls/doors/static props ${this.generatedWalls}/${this.generatedDoors}/${this.staticProps}`,
      `interactive furniture/registry ${this.interactiveFurniture}/${this.registryObjects}`, `GameObjects total/visible ${displayObjects.length}/${visibleObjects}`,
      `textures ${this.scene.textures.getTextureKeys().length} heap ${memory ? (memory.usedJSHeapSize / 1_048_576).toFixed(1) + " MiB" : "n/a"}`,
      `actors z/c/p ${activeZombies}/${this.activeCompanions}/${this.activeProjectiles}`,
      `path requests/frame ${this.pathfindingWork}`, `separation candidates ${this.separationCandidates}`,
      `camera zoom ${this.cameraZoom.toFixed(2)}`, `minimap ${this.minimapOpen ? "open" : "closed"}`,
      `companion distance ${this.companionDistance.toFixed(1)}`, `companion catch-up ${this.companionCatchUp ? "yes" : "no"}`,
      `companion stuck ${this.companionStuckMs.toFixed(0)} ms`, `companion repaths ${this.companionRepathCount}`,
    ].join("\n");
  }

  destroy(): void { this.overlay?.remove(); this.overlay = undefined; }

  private recordSection(name: RuntimePerformanceSection, value: number, targets = 0): void {
    const samples = this.sections.get(name)!;
    samples.values[samples.index] = value;
    samples.index = (samples.index + 1) % SAMPLE_COUNT;
    samples.count = Math.min(SAMPLE_COUNT, samples.count + 1);
    samples.calls += 1;
    samples.targets = targets;
  }

  private getTopSectionRows(limit: number): string[] {
    for (let index = 0; index < this.sectionOrder.length; index += 1) this.sectionOrder[index] = index;
    this.sectionOrder.sort((a, b) => averageOf(this.sections.get(SECTION_NAMES[b]!)!) - averageOf(this.sections.get(SECTION_NAMES[a]!)!));
    const rows: string[] = [];
    for (let rank = 0; rank < Math.min(limit, this.sectionOrder.length); rank += 1) {
      const name = SECTION_NAMES[this.sectionOrder[rank]!]!;
      const samples = this.sections.get(name)!;
      if (samples.count === 0) continue;
      const summary = summarize(samples.values, samples.count, this.frameScratch);
      rows.push(`${rank + 1}. ${name} ${summary.average.toFixed(2)}/${summary.maximum.toFixed(2)}/${summary.p95.toFixed(2)} ms n=${samples.targets}`);
    }
    return rows;
  }
}

function averageOf(samples: RollingSamples): number {
  if (samples.count === 0) return 0;
  let total = 0; for (let index = 0; index < samples.count; index += 1) total += samples.values[index]!; return total / samples.count;
}

function summarize(values: Float32Array, count: number, scratch: Float32Array): { average: number; maximum: number; p95: number } {
  let total = 0; let maximum = 0;
  for (let index = 0; index < count; index += 1) { const value = values[index]!; scratch[index] = value; total += value; if (value > maximum) maximum = value; }
  const sorted = scratch.subarray(0, count); sorted.sort();
  return { average: total / Math.max(1, count), maximum, p95: sorted[Math.max(0, Math.ceil(count * 0.95) - 1)] ?? 0 };
}
