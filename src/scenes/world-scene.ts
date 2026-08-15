import Phaser from "phaser";
import { BALANCE, DEPTH, FOG_CELL_SIZE, LOGICAL_HEIGHT, LOGICAL_WIDTH, SAVE_KEY, SAVE_VERSION, TILE_SIZE, WORLD_SIZE } from "../config/game-config";
import { GameClock } from "../core/game-clock";
import type { SaveGame } from "../core/save-state";
import { SeededRng } from "../core/seeded-rng";
import { createCityBlockMap, type ContainerDefinition, type DoorDefinition, type WorldObstacle } from "../data/map-definitions";
import { getItemDefinition } from "../data/item-definitions";
import { RECIPE_DEFINITIONS } from "../data/recipe-definitions";
import { WEAPON_DEFINITIONS, type WeaponId } from "../data/weapon-definitions";
import type { ZombieKind } from "../data/zombie-definitions";
import { PerformanceMonitor } from "../debug/performance-monitor";
import { AttackEffectController, getAttackBlockReason } from "../effects/attack-effect-controller";
import type { AttackEffectImpact } from "../effects/pixel-effect-definitions";
import { PixelEffectSystem } from "../effects/pixel-effect-system";
import { Companion, type CompanionCommand } from "../entities/companion";
import { ItemDrop } from "../entities/item-drop";
import { Player } from "../entities/player";
import { Zombie } from "../entities/zombie";
import { FogRenderer } from "../rendering/fog-renderer";
import { createMapRendering, updateDoorView, type MapViews } from "../rendering/map-renderer";
import { AudioSystem } from "../systems/audio-system";
import { CollisionSystem } from "../systems/collision-system";
import { distance, firstTargetOnLine, targetsInMeleeArc } from "../systems/combat-system";
import { createFormationState, getFormationSlot, updateFormationDirection, type FormationState } from "../systems/companion-system";
import { CraftingSystem } from "../systems/crafting-system";
import { FogOfWarSystem, VisibilityState } from "../systems/fog-of-war-system";
import { InfectionSystem } from "../systems/infection-system";
import { InventorySystem } from "../systems/inventory-system";
import { buildVisionSources, type ActiveFire } from "../systems/lighting-system";
import { NoiseSystem, NOISE_LEVELS } from "../systems/noise-system";
import { findTilePath } from "../systems/pathfinding-system";
import { SaveSystem } from "../systems/save-system";
import { updateZombieMind, type Point } from "../systems/zombie-ai-system";
import { CompanionCommandPanel } from "../ui/companion-command-panel";
import { Hud } from "../ui/hud";
import { InventoryPanel, type InventoryPanelState } from "../ui/inventory-panel";
import { PauseMenu } from "../ui/pause-menu";

interface WorldSceneData {
  load?: boolean;
}

interface WorldKeys {
  up: Phaser.Input.Keyboard.Key;
  down: Phaser.Input.Keyboard.Key;
  left: Phaser.Input.Keyboard.Key;
  right: Phaser.Input.Keyboard.Key;
  run: Phaser.Input.Keyboard.Key;
  interact: Phaser.Input.Keyboard.Key;
  reload: Phaser.Input.Keyboard.Key;
  flashlight: Phaser.Input.Keyboard.Key;
  command: Phaser.Input.Keyboard.Key;
  inventory: Phaser.Input.Keyboard.Key;
  pause: Phaser.Input.Keyboard.Key;
  quick1: Phaser.Input.Keyboard.Key;
  quick2: Phaser.Input.Keyboard.Key;
  quick3: Phaser.Input.Keyboard.Key;
  quick4: Phaser.Input.Keyboard.Key;
  quick5: Phaser.Input.Keyboard.Key;
}

interface FireRuntime extends ActiveFire {
  id: string;
  view: Phaser.GameObjects.Graphics;
  nextDamageAt: number;
}

interface Interaction {
  distance: number;
  prompt: string;
  run: () => void;
}

interface AttackableTarget {
  id: string;
  position: Point;
  alive: boolean;
  kind: "player" | "companion";
}

const MAX_PATHFINDING_PER_FRAME = 4;
const SEPARATION_CELL_SIZE = 12;
const SEPARATION_BUCKET_COLUMNS = Math.ceil(WORLD_SIZE / SEPARATION_CELL_SIZE);

export class WorldScene extends Phaser.Scene {
  private loadRequested = false;
  private map = createCityBlockMap();
  private collision!: CollisionSystem;
  private clock!: GameClock;
  private fog!: FogOfWarSystem;
  private fogRenderer!: FogRenderer;
  private mapViews!: MapViews;
  private player!: Player;
  private companion!: Companion;
  private zombies: Zombie[] = [];
  private drops: ItemDrop[] = [];
  private inventory!: InventorySystem;
  private crafting = new CraftingSystem(RECIPE_DEFINITIONS);
  private infection = new InfectionSystem();
  private noise = new NoiseSystem();
  private saveSystem!: SaveSystem;
  private rng!: SeededRng;
  private seed = 0;
  private quickslots: Array<string | null> = ["bandage", "medicine", "torch", "molotov", "barricade"];
  private collectedParts = new Set<string>();
  private searchedContainers = new Set<string>();
  private effects!: PixelEffectSystem;
  private attackEffects!: AttackEffectController;
  private audio = new AudioSystem();
  private keys!: WorldKeys;
  private uiRoot!: HTMLDivElement;
  private hud!: Hud;
  private inventoryPanel!: InventoryPanel;
  private commandPanel!: CompanionCommandPanel;
  private pauseMenu!: PauseMenu;
  private tintOverlay!: Phaser.GameObjects.Rectangle;
  private telegraphGraphics!: Phaser.GameObjects.Graphics;
  private performanceMonitor!: PerformanceMonitor;
  private fires: FireRuntime[] = [];
  private formation: FormationState = createFormationState();
  private pendingCompanionCommand?: "move" | "focus";
  private simulationTime = 0;
  private nextFootstepAt = 0;
  private nextHudAt = 0;
  private nextFogAt = 0;
  private nextNightSpawnAt = 0;
  private nextDefenseSpawnAt = 0;
  private dropCounter = 0;
  private ambientEffectSequence = 1_000_000;
  private defenseActive = false;
  private defenseRemaining: number = BALANCE.defenseSeconds;
  private gameEnded = false;
  private wasInSafehouse = true;
  private activeZombieCount = 0;
  private pathfindingWorkThisFrame = 0;
  private readonly separationBuckets: number[][] = [];
  private readonly separationUsedBuckets: number[] = [];
  private lastTintAlpha = Number.NaN;
  private lastFogPlayerCell = -1;
  private lastFogAimBucket = -1;
  private lastFogVisionRevision = -1;

  constructor() {
    super("world");
  }

  init(data: WorldSceneData = {}): void {
    this.loadRequested = Boolean(data.load);
  }

  create(): void {
    this.resetRuntimeCollections();
    this.saveSystem = new SaveSystem(window.localStorage, SAVE_KEY);
    const saved = this.loadRequested ? this.saveSystem.load() : null;
    this.seed = saved?.seed ?? ((Date.now() ^ 0x5f3759df) >>> 0);
    this.rng = new SeededRng(saved?.rngState ?? this.seed);
    this.map = createCityBlockMap();
    if (saved) {
      const opened = new Set(saved.openedDoors);
      this.map.doors.forEach((door) => { door.open = opened.has(door.id); });
    }
    this.collision = new CollisionSystem(this.map.obstacles, this.map.doors);
    this.clock = new GameClock();
    if (saved) this.clock.restore(saved.clock);
    this.mapViews = createMapRendering(this, this.map);

    this.inventory = new InventorySystem(BALANCE.inventorySlots, saved?.inventory);
    if (!saved) {
      this.inventory.add("bandage", 1);
      this.inventory.add("water", 1);
      this.inventory.add("ammo", 6);
    }
    this.quickslots = saved?.quickslots.slice(0, 5) ?? ["bandage", "medicine", "torch", "molotov", "barricade"];
    while (this.quickslots.length < 5) this.quickslots.push(null);
    this.collectedParts = new Set(saved?.collectedParts ?? []);
    this.syncCollectedParts();
    this.searchedContainers = new Set(saved?.searchedContainers ?? []);
    this.defenseActive = saved?.extraction.active ?? false;
    this.defenseRemaining = saved?.extraction.remainingSeconds ?? BALANCE.defenseSeconds;

    const playerPosition = saved?.player ?? this.map.playerSpawn;
    this.player = new Player(this, playerPosition);
    if (saved) this.restorePlayer(saved);
    this.companion = new Companion(this, saved?.companion ?? this.map.survivorSpawn);
    if (saved) this.restoreCompanion(saved);
    this.mapViews.survivorMarker.setVisible(!this.companion.rescued && this.companion.alive);

    this.createZombies(saved);
    this.createGroundItems();
    this.applySearchedContainerViews();

    this.fog = new FogOfWarSystem(WORLD_SIZE, WORLD_SIZE, FOG_CELL_SIZE, this.seed);
    if (saved) this.fog.importExplored(saved.exploredFog);
    this.fogRenderer = new FogRenderer(this, this.fog);
    this.effects = new PixelEffectSystem(this, (x, y) => this.fog.getStateAtWorld(x, y) === VisibilityState.Visible);
    this.attackEffects = new AttackEffectController(this.effects);
    this.tintOverlay = this.add.rectangle(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, LOGICAL_WIDTH, LOGICAL_HEIGHT, 0x101b2c, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.tint);
    this.telegraphGraphics = this.add.graphics().setDepth(DEPTH.propFront + 500);

    this.configureCamera();
    this.configureInput();
    this.createUi();
    this.performanceMonitor = new PerformanceMonitor(this, this.uiRoot);
    this.recomputeFog(true);
    this.updateHud();
    this.wasInSafehouse = this.isInsideSafehouse(this.player.position);
    this.hud.showMessage(saved ? "저장된 생존 기록을 불러왔습니다." : "해가 지기 전에 탈출 부품 3개와 생존자를 찾으세요.", 4_000);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdownUi());
  }

  update(time: number, rawDelta: number): void {
    if (this.gameEnded) return;
    this.performanceMonitor.beginFrame(rawDelta);
    this.pathfindingWorkThisFrame = 0;
    this.handlePanelKeys();
    if (this.inventoryPanel.isOpen() || this.pauseMenu.isOpen()) {
      this.player.updateView(this.simulationTime);
      this.performanceMonitor.update(time, this.activeZombieCount);
      return;
    }

    const timeScale = this.commandPanel.isOpen() ? 0.25 : 1;
    const deltaMs = Math.min(rawDelta, 50) * timeScale;
    const deltaSeconds = deltaMs / 1_000;
    this.simulationTime += deltaMs;
    this.clock.update(deltaSeconds);
    this.telegraphGraphics.clear();

    this.updatePlayer(deltaSeconds);
    this.updateFires(deltaSeconds);
    this.updateCompanion(time, deltaSeconds);
    this.updateZombies(time, deltaSeconds);
    this.performanceMonitor.recordSeparationCandidates(this.applyZombieSeparation());
    this.updateSpawning();
    this.updateExtraction(deltaSeconds);
    this.effects.update(this.simulationTime, deltaSeconds);
    this.noise.prune(this.simulationTime);
    this.updateWorldTint();
    this.recomputeFog(false);
    this.updateInteractionPrompt();

    if (this.simulationTime >= this.nextHudAt) {
      this.nextHudAt = this.simulationTime + 160;
      this.updateHud();
    }
    if (this.infection.isGameOver(this.player.vitals)) {
      this.finishGame(false, this.player.vitals.infection >= 100 ? "감염이 전신으로 퍼졌습니다." : "도시에서 쓰러졌습니다.");
    }
    this.performanceMonitor.update(time, this.activeZombieCount);
  }

  private resetRuntimeCollections(): void {
    this.zombies = [];
    this.drops = [];
    this.fires = [];
    this.formation = createFormationState();
    this.pendingCompanionCommand = undefined;
    this.simulationTime = 0;
    this.nextFootstepAt = 0;
    this.nextHudAt = 0;
    this.nextFogAt = 0;
    this.nextNightSpawnAt = 0;
    this.nextDefenseSpawnAt = 0;
    this.dropCounter = 0;
    this.ambientEffectSequence = 1_000_000;
    this.gameEnded = false;
    this.activeZombieCount = 0;
    this.pathfindingWorkThisFrame = 0;
    this.separationUsedBuckets.length = 0;
    this.lastTintAlpha = Number.NaN;
    this.lastFogPlayerCell = -1;
    this.lastFogAimBucket = -1;
    this.lastFogVisionRevision = -1;
  }

  private configureCamera(): void {
    const camera = this.cameras.main;
    camera.setBounds(0, 0, WORLD_SIZE, WORLD_SIZE);
    camera.setRoundPixels(true);
    camera.startFollow(this.player.view.container, true, 0.16, 0.16);
    camera.setBackgroundColor(0x080b0d);
  }

  private configureInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error("Keyboard input unavailable");
    this.keys = keyboard.addKeys({
      up: "W", down: "S", left: "A", right: "D", run: "SHIFT",
      interact: "E", reload: "R", flashlight: "F", command: "Q",
      inventory: "TAB", pause: "ESC",
      quick1: "ONE", quick2: "TWO", quick3: "THREE", quick4: "FOUR", quick5: "FIVE",
    }) as unknown as WorldKeys;
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button !== 0 || this.inventoryPanel?.isOpen() || this.pauseMenu?.isOpen()) return;
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      if (this.pendingCompanionCommand) {
        this.applyPendingCompanionCommand(world);
        return;
      }
      if (!this.commandPanel?.isOpen()) this.tryPlayerAttack();
    });
  }

  private createUi(): void {
    const parent = document.querySelector<HTMLElement>("#app");
    if (!parent) throw new Error("Game root missing");
    this.uiRoot = document.createElement("div");
    this.uiRoot.className = "game-ui-root";
    parent.append(this.uiRoot);
    this.hud = new Hud(this.uiRoot);
    this.inventoryPanel = new InventoryPanel(this.uiRoot, {
      onClose: () => this.inventoryPanel.hide(),
      onCraft: (recipeId) => this.craft(recipeId),
      onUseSlot: (index) => this.useInventorySlot(index),
      onDropSlot: (index) => this.dropInventorySlot(index),
      onAssignQuickslot: (index, quickslot) => this.assignQuickslot(index, quickslot),
      onEquipWeapon: (weaponId) => this.equipWeapon(weaponId),
    });
    this.commandPanel = new CompanionCommandPanel(this.uiRoot, (command) => this.chooseCompanionCommand(command));
    this.pauseMenu = new PauseMenu(this.uiRoot, {
      onResume: () => this.pauseMenu.hide(),
      onSave: () => this.saveGame(true),
      onRestart: () => {
        this.saveSystem.clear();
        this.scene.start("world", { load: false });
      },
    });
  }

  private handlePanelKeys(): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.inventory) && !this.pauseMenu.isOpen()) {
      if (this.inventoryPanel.isOpen()) this.inventoryPanel.hide();
      else {
        this.commandPanel.hide();
        this.pendingCompanionCommand = undefined;
        this.inventoryPanel.show(this.getInventoryPanelState());
      }
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.pause) && !this.inventoryPanel.isOpen()) {
      this.commandPanel.hide();
      this.pendingCompanionCommand = undefined;
      this.pauseMenu.toggle();
    }
    if (this.inventoryPanel.isOpen() || this.pauseMenu.isOpen()) return;
    if (Phaser.Input.Keyboard.JustDown(this.keys.command)) {
      if (!this.companion.rescued || !this.companion.alive) this.hud.showMessage("먼저 생존자를 구조해야 합니다.");
      else {
        this.pendingCompanionCommand = undefined;
        this.commandPanel.toggle();
      }
    }
  }

  private updatePlayer(deltaSeconds: number): void {
    const pointer = this.input.activePointer;
    const worldPointer = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.player.aimAngle = Math.atan2(worldPointer.y - this.player.position.y, worldPointer.x - this.player.position.x);

    if (this.player.reloadingUntil > 0 && this.simulationTime >= this.player.reloadingUntil) this.finishReload();
    if (Phaser.Input.Keyboard.JustDown(this.keys.reload)) this.startReload();
    if (Phaser.Input.Keyboard.JustDown(this.keys.flashlight)) this.toggleFlashlight();
    if (Phaser.Input.Keyboard.JustDown(this.keys.interact)) this.getNearestInteraction()?.run();
    const quickKeys = [this.keys.quick1, this.keys.quick2, this.keys.quick3, this.keys.quick4, this.keys.quick5];
    quickKeys.forEach((key, index) => {
      if (Phaser.Input.Keyboard.JustDown(key)) this.useQuickslot(index);
    });

    let moveX = Number(this.keys.right.isDown) - Number(this.keys.left.isDown);
    let moveY = Number(this.keys.down.isDown) - Number(this.keys.up.isDown);
    const length = Math.hypot(moveX, moveY);
    if (length > 0) { moveX /= length; moveY /= length; }
    const running = this.keys.run.isDown && length > 0;
    let speed = running ? BALANCE.playerRunSpeed : BALANCE.playerWalkSpeed;
    speed *= this.infection.getMovementMultiplier(this.player.vitals.infection);
    if (this.simulationTime - this.player.lastAttackAt < 170) speed *= 0.62;
    this.player.movement = { x: moveX, y: moveY };
    const next = this.collision.moveCircle(this.player.position, moveX * speed * deltaSeconds, moveY * speed * deltaSeconds, BALANCE.playerRadius);
    this.player.position = next;

    if (length > 0 && this.simulationTime >= this.nextFootstepAt) {
      const category = running ? "run" : "walk";
      this.noise.emit({ x: next.x, y: next.y, intensity: NOISE_LEVELS[category], category, createdAt: this.simulationTime });
      this.nextFootstepAt = this.simulationTime + (running ? 290 : 580);
    }
    if (this.player.flashlightOn) {
      this.player.flashlightCharge = Math.max(0, this.player.flashlightCharge - deltaSeconds);
      if (this.player.flashlightCharge === 0) {
        this.player.flashlightOn = false;
        this.hud.showMessage("손전등 배터리가 소진됐습니다.");
      }
    }
    this.player.torchRemaining = Math.max(0, this.player.torchRemaining - deltaSeconds);
    this.player.updateView(this.simulationTime);

    const insideSafehouse = this.isInsideSafehouse(this.player.position);
    if (insideSafehouse && !this.wasInSafehouse) this.saveGame(false);
    this.wasInSafehouse = insideSafehouse;
  }

  private tryPlayerAttack(): void {
    const weapon = WEAPON_DEFINITIONS[this.player.equippedWeapon];
    const blockReason = getAttackBlockReason({
      now: this.simulationTime,
      lastAttackAt: this.player.lastAttackAt,
      reloadingUntil: this.player.reloadingUntil,
      magazine: this.player.magazine,
      blocked: this.gameEnded || this.inventoryPanel.isOpen() || this.pauseMenu.isOpen() || this.commandPanel.isOpen(),
    }, weapon);
    if (blockReason) {
      if (blockReason === "empty") this.hud.showMessage("탄창이 비었습니다. R로 재장전하세요.");
      return;
    }
    if (weapon.kind === "ranged") this.player.magazine -= 1;
    this.player.lastAttackAt = this.simulationTime;
    this.noise.emit({ x: this.player.position.x, y: this.player.position.y, intensity: weapon.noise, category: weapon.kind === "ranged" ? "gunshot" : "melee", createdAt: this.simulationTime });
    const impacts: AttackEffectImpact[] = [];
    let endpointX: number | undefined;
    let endpointY: number | undefined;

    if (weapon.kind === "melee") {
      const targets = targetsInMeleeArc(this.player.position, this.player.aimAngle, weapon, this.zombies
        .filter((zombie) => this.collision.hasLineOfSight(this.player.position, zombie.position))
        .map((zombie) => ({ id: zombie.id, position: zombie.position, alive: zombie.isAlive() })));
      targets.forEach((target) => {
        const zombie = this.zombies.find((candidate) => candidate.id === target.id);
        if (!zombie) return;
        impacts.push({ x: zombie.position.x, y: zombie.position.y, kind: "zombie" });
        const direction = normalize({ x: zombie.position.x - this.player.position.x, y: zombie.position.y - this.player.position.y });
        this.damageZombie(zombie, weapon.damage, { x: direction.x * weapon.knockback, y: direction.y * weapon.knockback });
      });
      this.audio.play("hit");
    } else {
      const rawEnd = {
        x: this.player.position.x + Math.cos(this.player.aimAngle) * weapon.range,
        y: this.player.position.y + Math.sin(this.player.aimAngle) * weapon.range,
      };
      const wallHit = this.collision.firstProjectileCollision(this.player.position, rawEnd);
      const end = wallHit ?? rawEnd;
      const hit = firstTargetOnLine(this.player.position, end, this.zombies.map((zombie) => ({ id: zombie.id, position: zombie.position, alive: zombie.isAlive() })), 8);
      const tracerEnd = hit ? this.zombies.find((zombie) => zombie.id === hit.target.id)?.position ?? end : end;
      endpointX = tracerEnd.x;
      endpointY = tracerEnd.y;
      if (hit) {
        const zombie = this.zombies.find((candidate) => candidate.id === hit.target.id);
        if (zombie) {
          impacts.push({ x: zombie.position.x, y: zombie.position.y, kind: "zombie" });
          const direction = normalize({ x: Math.cos(this.player.aimAngle), y: Math.sin(this.player.aimAngle) });
          this.damageZombie(zombie, weapon.damage, { x: direction.x * weapon.knockback, y: direction.y * weapon.knockback });
        }
      } else if (wallHit) impacts.push({ x: wallHit.x, y: wallHit.y, kind: "wall" });
      this.audio.play("shot");
      this.cameras.main.shake(80, 0.0025);
    }
    this.player.beginAttack(this.simulationTime);
    this.attackEffects.play({
      weapon: weapon.id,
      originX: this.player.position.x,
      originY: this.player.position.y,
      angle: this.player.aimAngle,
      startedAt: this.simulationTime,
      endpointX,
      endpointY,
      impacts,
      alwaysShowCore: true,
    });
  }

  private damageZombie(zombie: Zombie, damage: number, knockback: Point): void {
    const killed = zombie.damage(damage, knockback, this.simulationTime);
    if (killed && this.rng.chance(0.28)) {
      const itemId = this.rng.chance(0.45) ? "ammo" : "cloth";
      this.spawnDrop(itemId, 1, zombie.position.x, zombie.position.y);
    }
  }

  private startReload(): void {
    if (this.player.equippedWeapon !== "pistol" || this.player.reloadingUntil > 0) return;
    const weapon = WEAPON_DEFINITIONS.pistol;
    if (this.player.magazine >= (weapon.magazineSize ?? 8) || this.inventory.count("ammo") <= 0) {
      this.hud.showMessage(this.inventory.count("ammo") <= 0 ? "예비 탄약이 없습니다." : "탄창이 이미 가득 찼습니다.");
      return;
    }
    this.player.reloadingUntil = this.simulationTime + (weapon.reloadMs ?? 1_000);
    this.hud.showMessage("재장전 중…", 1_100);
  }

  private finishReload(): void {
    const capacity = (WEAPON_DEFINITIONS.pistol.magazineSize ?? 8) - this.player.magazine;
    const amount = Math.min(capacity, this.inventory.count("ammo"));
    this.inventory.remove("ammo", amount);
    this.player.magazine += amount;
    this.player.reloadingUntil = 0;
  }

  private toggleFlashlight(): void {
    if (this.player.flashlightCharge <= 0) {
      this.hud.showMessage("손전등 배터리가 없습니다.");
      return;
    }
    this.player.flashlightOn = !this.player.flashlightOn;
    this.nextFogAt = 0;
  }

  private createZombies(saved: SaveGame | null): void {
    if (saved) {
      this.zombies = saved.zombies.map((state) => {
        const zombie = new Zombie(this, state.id, state.kind, state, state.state);
        zombie.health = state.health;
        return zombie;
      });
    } else {
      this.zombies = this.map.zombieSpawns.map((spawn) => new Zombie(
        this,
        spawn.id,
        spawn.kind,
        { x: tileCenter(spawn.tileX), y: tileCenter(spawn.tileY) },
      ));
    }
    this.activeZombieCount = 0;
    for (const zombie of this.zombies) if (zombie.isAlive()) this.activeZombieCount += 1;
  }

  private updateZombies(time: number, deltaSeconds: number): void {
    const targets = this.getZombieTargets();
    this.activeZombieCount = 0;
    this.zombies.forEach((zombie, index) => {
      if (!zombie.isAlive()) {
        zombie.updateView(time, this.fog.getStateAtWorld(zombie.position.x, zombie.position.y) === VisibilityState.Visible);
        return;
      }
      this.activeZombieCount += 1;
      if (zombie.mind.state === "Stagger" && this.simulationTime >= zombie.staggerUntil) {
        zombie.mind = { ...zombie.mind, state: "Chase" };
      }
      let perceivedTarget = targets.find((target) => target.id === zombie.mind.currentTargetId);
      if (this.simulationTime >= zombie.nextThinkAt && zombie.mind.state !== "Stagger") {
        const farFromPlayer = distance(zombie.position, this.player.position) > 360;
        zombie.nextThinkAt = this.simulationTime + 220 + (index % 5) * 47 + (farFromPlayer ? 380 : 0);
        const sightTarget = this.findVisibleZombieTarget(zombie, targets);
        const heardNoise = sightTarget ? undefined : this.noise.loudestHeard(zombie.position.x, zombie.position.y, zombie.definition.hearingMultiplier, this.simulationTime);
        const previousState = zombie.mind.state;
        zombie.mind = updateZombieMind(zombie.mind, {
          canSeeTarget: Boolean(sightTarget),
          targetPosition: sightTarget?.position,
          targetId: sightTarget?.id,
          inAttackRange: sightTarget ? distance(zombie.position, sightTarget.position) <= 17 : false,
          heardNoise,
        });
        perceivedTarget = sightTarget ?? targets.find((target) => target.id === zombie.mind.currentTargetId);
        if (zombie.kind === "runner" && sightTarget && previousState !== "Chase" && previousState !== "Attack") {
          zombie.chargeReadyAt = this.simulationTime + 360;
        }
      }

      const attackTarget = perceivedTarget ?? targets.find((target) => target.id === zombie.mind.currentTargetId);
      if (zombie.mind.state === "Attack" && attackTarget) this.updateZombieAttack(zombie, attackTarget);
      else {
        zombie.biteCompletesAt = 0;
        const goal = this.getZombieGoal(zombie, attackTarget);
        if (goal && this.simulationTime >= zombie.chargeReadyAt && zombie.mind.state !== "Stagger") {
          this.moveZombieToward(zombie, goal, deltaSeconds, index);
        }
      }
      if (zombie.chargeReadyAt > this.simulationTime) {
        this.telegraphGraphics.lineStyle(2, 0xb74f43, 0.85).strokeCircle(zombie.position.x, zombie.position.y, 11);
      }
      zombie.aimAngle = attackTarget ? Math.atan2(attackTarget.position.y - zombie.position.y, attackTarget.position.x - zombie.position.x) : zombie.aimAngle;
      zombie.updateView(time, this.fog.getStateAtWorld(zombie.position.x, zombie.position.y) === VisibilityState.Visible);
    });
  }

  private getZombieTargets(): AttackableTarget[] {
    const targets: AttackableTarget[] = [{ id: this.player.id, position: this.player.position, alive: this.player.vitals.health > 0, kind: "player" }];
    if (this.companion.rescued && this.companion.alive) targets.push({ id: this.companion.id, position: this.companion.position, alive: true, kind: "companion" });
    return targets;
  }

  private findVisibleZombieTarget(zombie: Zombie, targets: readonly AttackableTarget[]): AttackableTarget | undefined {
    let best: AttackableTarget | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const target of targets) {
      if (!target.alive) continue;
      let sight = zombie.definition.sightRadius * this.clock.getZombieActivityMultiplier();
      if (target.kind === "player" && this.player.torchRemaining > 0) sight *= 1.45;
      if (target.kind === "player" && this.player.flashlightOn) {
        const towardZombie = Math.atan2(zombie.position.y - this.player.position.y, zombie.position.x - this.player.position.x);
        if (Math.abs(angleDelta(towardZombie, this.player.aimAngle)) < Math.PI * 0.23) sight *= 1.28;
      }
      const targetDistance = distance(zombie.position, target.position);
      if (targetDistance > sight || targetDistance >= bestDistance || !this.collision.hasLineOfSight(zombie.position, target.position)) continue;
      best = target;
      bestDistance = targetDistance;
    }
    return best;
  }

  private getZombieGoal(zombie: Zombie, target?: AttackableTarget): Point | undefined {
    if (zombie.mind.state === "Chase" && target) return target.position;
    if (zombie.mind.state === "InvestigateNoise") return zombie.mind.lastHeardNoisePosition;
    if (zombie.mind.state === "SearchLastKnownPosition") return zombie.mind.lastSeenTargetPosition ?? zombie.mind.lastHeardNoisePosition;
    if (zombie.mind.state === "Wander" || zombie.mind.state === "Idle") {
      if (!zombie.wanderTarget || distance(zombie.position, zombie.wanderTarget) < 10) {
        for (let attempt = 0; attempt < 6; attempt += 1) {
          const tileX = Math.floor(zombie.position.x / TILE_SIZE) + this.rng.integer(-5, 5);
          const tileY = Math.floor(zombie.position.y / TILE_SIZE) + this.rng.integer(-5, 5);
          if (!this.collision.isTileBlocked(tileX, tileY)) {
            zombie.wanderTarget = { x: tileCenter(tileX), y: tileCenter(tileY) };
            break;
          }
        }
      }
      return zombie.wanderTarget;
    }
    return undefined;
  }

  private moveZombieToward(zombie: Zombie, goal: Point, deltaSeconds: number, zombieIndex: number): void {
    if (this.simulationTime >= zombie.nextPathAt) {
      const farFromPlayer = distance(zombie.position, this.player.position) > 360;
      const nextPath = this.tryFindPath(zombie.position, goal, 650);
      if (nextPath) {
        zombie.nextPathAt = this.simulationTime + 650 + (zombieIndex % 5) * 65 + (farFromPlayer ? 500 : 0);
        zombie.path = nextPath;
        zombie.pathIndex = 0;
      } else {
        zombie.nextPathAt = this.simulationTime + 80 + (zombieIndex % 4) * 20;
      }
    }
    const waypoint = zombie.path[zombie.pathIndex] ?? goal;
    if (distance(zombie.position, waypoint) < 7 && zombie.pathIndex < zombie.path.length - 1) zombie.pathIndex += 1;
    const currentTarget = zombie.path[zombie.pathIndex] ?? goal;
    const direction = normalize({ x: currentTarget.x - zombie.position.x, y: currentTarget.y - zombie.position.y });
    const speed = zombie.definition.speed * this.clock.getZombieActivityMultiplier();
    zombie.position = this.collision.moveCircle(zombie.position, direction.x * speed * deltaSeconds, direction.y * speed * deltaSeconds, BALANCE.zombieRadius);
    zombie.aimAngle = Math.atan2(direction.y, direction.x);
    if (distance(zombie.position, goal) < 10 && (zombie.mind.state === "InvestigateNoise" || zombie.mind.state === "SearchLastKnownPosition")) {
      zombie.mind = updateZombieMind(zombie.mind, { canSeeTarget: false, reachedDestination: true });
      zombie.path = [];
    }
  }

  private tryFindPath(start: Point, goal: Point, maxVisited: number): Point[] | undefined {
    if (this.pathfindingWorkThisFrame >= MAX_PATHFINDING_PER_FRAME) return undefined;
    this.pathfindingWorkThisFrame += 1;
    this.performanceMonitor.recordPathfinding();
    return findTilePath(start, goal, (x, y) => this.collision.isTileBlocked(x, y), maxVisited);
  }

  private updateZombieAttack(zombie: Zombie, target: AttackableTarget): void {
    const targetDistance = distance(zombie.position, target.position);
    if (targetDistance > 20) {
      zombie.mind = { ...zombie.mind, state: "Chase" };
      zombie.biteCompletesAt = 0;
      return;
    }
    if (this.simulationTime < zombie.nextAttackAt) return;
    if (zombie.biteCompletesAt === 0) zombie.biteCompletesAt = this.simulationTime + zombie.definition.biteWindupMs;
    const progress = 1 - (zombie.biteCompletesAt - this.simulationTime) / zombie.definition.biteWindupMs;
    this.telegraphGraphics.lineStyle(2, 0xc84f43, 0.9).strokeCircle(zombie.position.x, zombie.position.y, 7 + Math.max(0, progress) * 6);
    if (this.simulationTime < zombie.biteCompletesAt) return;
    const isBite = this.rng.chance(0.32);
    if (target.kind === "player" && this.simulationTime >= this.player.invulnerableUntil) {
      this.player.vitals = this.infection.applyAttack(
        this.player.vitals,
        isBite ? "bite" : "scratch",
        zombie.definition.damage + (isBite ? 4 : 0),
        isBite ? zombie.definition.infectionBite : zombie.definition.infectionScratch,
      );
      this.player.invulnerableUntil = this.simulationTime + 350;
      this.player.view.flashHit(this.simulationTime);
      this.audio.play("hurt");
      this.cameras.main.shake(110, 0.003);
    } else if (target.kind === "companion") {
      const died = this.companion.damage(zombie.definition.damage + (isBite ? 3 : 0), this.simulationTime);
      if (died) this.hud.showMessage("동료가 쓰러졌습니다.", 3_500);
    }
    zombie.biteCompletesAt = 0;
    zombie.nextAttackAt = this.simulationTime + zombie.definition.attackCooldownMs;
  }

  private applyZombieSeparation(): number {
    for (const bucketIndex of this.separationUsedBuckets) this.separationBuckets[bucketIndex]!.length = 0;
    this.separationUsedBuckets.length = 0;

    for (let index = 0; index < this.zombies.length; index += 1) {
      const zombie = this.zombies[index];
      if (!zombie?.isAlive()) continue;
      const bucketX = Math.floor(zombie.position.x / SEPARATION_CELL_SIZE);
      const bucketY = Math.floor(zombie.position.y / SEPARATION_CELL_SIZE);
      const bucketIndex = bucketY * SEPARATION_BUCKET_COLUMNS + bucketX;
      let bucket = this.separationBuckets[bucketIndex];
      if (!bucket) {
        bucket = [];
        this.separationBuckets[bucketIndex] = bucket;
      }
      if (bucket.length === 0) this.separationUsedBuckets.push(bucketIndex);
      bucket.push(index);
    }

    let candidateComparisons = 0;
    for (let index = 0; index < this.zombies.length; index += 1) {
      const first = this.zombies[index];
      if (!first?.isAlive()) continue;
      const bucketX = Math.floor(first.position.x / SEPARATION_CELL_SIZE);
      const bucketY = Math.floor(first.position.y / SEPARATION_CELL_SIZE);
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const bucket = this.separationBuckets[(bucketY + offsetY) * SEPARATION_BUCKET_COLUMNS + bucketX + offsetX];
          if (!bucket) continue;
          for (const otherIndex of bucket) {
            if (otherIndex <= index) continue;
            const second = this.zombies[otherIndex];
            if (!second?.isAlive()) continue;
            candidateComparisons += 1;
            const deltaX = first.position.x - second.position.x;
            const deltaY = first.position.y - second.position.y;
            const spacingSquared = deltaX * deltaX + deltaY * deltaY;
            if (spacingSquared <= 0 || spacingSquared >= 81) continue;
            const spacing = Math.sqrt(spacingSquared);
            const push = (9 - spacing) * 0.12 / spacing;
            first.position = this.collision.moveCircle(first.position, deltaX * push, deltaY * push, BALANCE.zombieRadius);
            second.position = this.collision.moveCircle(second.position, -deltaX * push, -deltaY * push, BALANCE.zombieRadius);
          }
        }
      }
    }
    return candidateComparisons;
  }

  private updateCompanion(time: number, deltaSeconds: number): void {
    if (!this.companion.alive) {
      this.companion.updateView(time, this.fog.getStateAtWorld(this.companion.position.x, this.companion.position.y) === VisibilityState.Visible, false);
      return;
    }
    if (!this.companion.rescued) {
      this.companion.updateView(time, this.fog.getStateAtWorld(this.companion.position.x, this.companion.position.y) === VisibilityState.Visible, false);
      return;
    }
    this.formation = updateFormationDirection(this.formation, this.player.movement, deltaSeconds * 1_000);
    let combatTarget = this.companion.focusTargetId ? this.zombies.find((zombie) => zombie.id === this.companion.focusTargetId && zombie.isAlive()) : undefined;
    if (!combatTarget) {
      let nearestDistanceSquared = 105 * 105;
      for (const zombie of this.zombies) {
        if (!zombie.isAlive()) continue;
        const candidateDistance = squaredDistance(this.companion.position, zombie.position);
        if (candidateDistance > nearestDistanceSquared) continue;
        nearestDistanceSquared = candidateDistance;
        combatTarget = zombie;
      }
    }
    if (this.companion.command === "focus" && this.companion.focusTargetId && !this.zombies.some((zombie) => zombie.id === this.companion.focusTargetId && zombie.isAlive())) {
      this.companion.command = "follow";
      this.companion.focusTargetId = undefined;
    }

    if (combatTarget && this.collision.hasLineOfSight(this.companion.position, combatTarget.position) && distance(this.companion.position, combatTarget.position) <= 88) {
      this.companion.aimAngle = Math.atan2(combatTarget.position.y - this.companion.position.y, combatTarget.position.x - this.companion.position.x);
      if (this.simulationTime >= this.companion.nextAttackAt) {
        this.companion.nextAttackAt = this.simulationTime + 720;
        const direction = normalize({ x: combatTarget.position.x - this.companion.position.x, y: combatTarget.position.y - this.companion.position.y });
        const impactX = combatTarget.position.x;
        const impactY = combatTarget.position.y;
        this.damageZombie(combatTarget, 13, { x: direction.x * 4, y: direction.y * 4 });
        this.attackEffects.play({
          weapon: "pistol",
          originX: this.companion.position.x,
          originY: this.companion.position.y,
          angle: this.companion.aimAngle,
          startedAt: this.simulationTime,
          endpointX: impactX,
          endpointY: impactY,
          impacts: [{ x: impactX, y: impactY, kind: "zombie" }],
        });
        this.noise.emit({ x: this.companion.position.x, y: this.companion.position.y, intensity: 12, category: "melee", createdAt: this.simulationTime });
      }
    }

    let goal: Point | undefined;
    if (this.companion.command === "follow") goal = getFormationSlot(this.player.position, this.formation);
    if (this.companion.command === "move") goal = this.companion.commandTarget;
    if (this.companion.command === "focus" && combatTarget) goal = combatTarget.position;
    if (this.companion.command === "hold") goal = this.companion.commandTarget;
    if (combatTarget && this.companion.health > 24 && distance(this.companion.position, combatTarget.position) > 70 && this.companion.command !== "hold") goal = combatTarget.position;

    let moving = false;
    if (goal && distance(this.companion.position, goal) > 10 && !(this.companion.command === "hold" && combatTarget)) {
      moving = true;
      if (this.simulationTime >= this.companion.nextPathAt) {
        const nextPath = this.tryFindPath(this.companion.position, goal, 700);
        if (nextPath) {
          this.companion.nextPathAt = this.simulationTime + 500;
          this.companion.path = nextPath;
          this.companion.pathIndex = 0;
        } else {
          this.companion.nextPathAt = this.simulationTime + 60;
        }
      }
      const waypoint = this.companion.path[this.companion.pathIndex] ?? goal;
      if (distance(this.companion.position, waypoint) < 7 && this.companion.pathIndex < this.companion.path.length - 1) this.companion.pathIndex += 1;
      const target = this.companion.path[this.companion.pathIndex] ?? goal;
      const direction = normalize({ x: target.x - this.companion.position.x, y: target.y - this.companion.position.y });
      this.companion.position = this.collision.moveCircle(this.companion.position, direction.x * 68 * deltaSeconds, direction.y * 68 * deltaSeconds, BALANCE.companionRadius);
      if (!combatTarget) this.companion.aimAngle = Math.atan2(direction.y, direction.x);
      if (this.companion.command === "move" && distance(this.companion.position, goal) < 12) {
        this.companion.command = "hold";
        this.companion.commandTarget = { ...this.companion.position };
      }
    }
    this.companion.updateView(time, this.fog.getStateAtWorld(this.companion.position.x, this.companion.position.y) === VisibilityState.Visible, moving);
  }

  private chooseCompanionCommand(command: CompanionCommand): void {
    if (command === "follow") {
      this.companion.command = "follow";
      this.companion.focusTargetId = undefined;
      this.companion.commandTarget = undefined;
      this.commandPanel.hide();
      this.hud.showMessage("동료: 따라오겠습니다.");
      return;
    }
    if (command === "hold") {
      this.companion.command = "hold";
      this.companion.focusTargetId = undefined;
      this.companion.commandTarget = { ...this.companion.position };
      this.commandPanel.hide();
      this.hud.showMessage("동료: 이 위치를 지키겠습니다.");
      return;
    }
    this.pendingCompanionCommand = command;
    this.hud.showMessage(command === "move" ? "이동할 위치를 클릭하세요." : "집중 공격할 좀비를 클릭하세요.");
  }

  private applyPendingCompanionCommand(point: Point): void {
    if (this.pendingCompanionCommand === "move") {
      this.companion.command = "move";
      this.companion.commandTarget = { ...point };
      this.companion.focusTargetId = undefined;
      this.hud.showMessage("동료: 지정 위치로 이동합니다.");
    } else {
      let target: Zombie | undefined;
      let nearestDistanceSquared = 28 * 28;
      for (const zombie of this.zombies) {
        if (!zombie.isAlive()) continue;
        const candidateDistance = squaredDistance(zombie.position, point);
        if (candidateDistance > nearestDistanceSquared) continue;
        nearestDistanceSquared = candidateDistance;
        target = zombie;
      }
      if (!target) {
        this.hud.showMessage("좀비를 정확히 클릭하세요.");
        return;
      }
      this.companion.command = "focus";
      this.companion.focusTargetId = target.id;
      this.hud.showMessage("동료: 저 적을 집중 공격합니다.");
    }
    this.pendingCompanionCommand = undefined;
    this.commandPanel.hide();
  }

  private getNearestInteraction(): Interaction | undefined {
    let nearest: Interaction | undefined;
    for (const drop of this.drops) {
      const itemDistance = distance(this.player.position, { x: drop.x, y: drop.y });
      if (itemDistance <= 34 && itemDistance < (nearest?.distance ?? Number.POSITIVE_INFINITY)
        && this.collision.hasLineOfSight(this.player.position, { x: drop.x, y: drop.y })) {
        nearest = { distance: itemDistance, prompt: `[E] ${getItemDefinition(drop.itemId).name} 줍기`, run: () => this.pickupDrop(drop) };
      }
    }
    for (const door of this.map.doors) {
      const position = { x: tileCenter(door.tileX), y: tileCenter(door.tileY) };
      const doorDistance = distance(this.player.position, position);
      if (doorDistance <= 34 && doorDistance < (nearest?.distance ?? Number.POSITIVE_INFINITY)) {
        nearest = { distance: doorDistance, prompt: `[E] 문 ${door.open ? "닫기" : "열기"}`, run: () => this.toggleDoor(door) };
      }
    }
    for (const container of this.map.containers) {
      if (this.searchedContainers.has(container.id)) continue;
      const position = { x: tileCenter(container.tileX), y: tileCenter(container.tileY) };
      const containerDistance = distance(this.player.position, position);
      if (containerDistance <= 34 && containerDistance < (nearest?.distance ?? Number.POSITIVE_INFINITY)
        && this.collision.hasLineOfSight(this.player.position, position)) {
        nearest = { distance: containerDistance, prompt: "[E] 조사", run: () => this.searchContainer(container) };
      }
    }
    if (!this.companion.rescued && this.companion.alive) {
      const survivorDistance = distance(this.player.position, this.companion.position);
      if (survivorDistance <= 34 && survivorDistance < (nearest?.distance ?? Number.POSITIVE_INFINITY)
        && this.collision.hasLineOfSight(this.player.position, this.companion.position)) {
        nearest = { distance: survivorDistance, prompt: "[E] 생존자 구조", run: () => this.rescueCompanion() };
      }
    }
    const extractionDistance = distance(this.player.position, this.map.extractionZone);
    const extractionPriority = extractionDistance * 0.2;
    if (!this.defenseActive && extractionDistance <= this.map.extractionZone.radius
      && extractionPriority < (nearest?.distance ?? Number.POSITIVE_INFINITY)) {
      nearest = { distance: extractionPriority, prompt: "[E] 탈출 차량 수리", run: () => this.tryStartExtraction() };
    }
    return nearest;
  }

  private updateInteractionPrompt(): void {
    this.hud.setPrompt(this.getNearestInteraction()?.prompt);
  }

  private toggleDoor(door: DoorDefinition): void {
    door.open = !door.open;
    this.collision.setDoorOpen(door.id, door.open);
    const view = this.mapViews.doorViews.get(door.id);
    if (view) updateDoorView(view, door.open);
    this.noise.emit({ x: tileCenter(door.tileX), y: tileCenter(door.tileY), intensity: NOISE_LEVELS.door, category: "door", createdAt: this.simulationTime });
    this.audio.play("door");
    this.nextFogAt = 0;
  }

  private searchContainer(container: ContainerDefinition): void {
    this.searchedContainers.add(container.id);
    const acquired: string[] = [];
    container.loot.forEach((loot) => {
      const added = this.inventory.add(loot.itemId, loot.quantity);
      if (added > 0) acquired.push(`${getItemDefinition(loot.itemId).name} ${added}`);
      if (added < loot.quantity) this.spawnDrop(loot.itemId, loot.quantity - added, tileCenter(container.tileX), tileCenter(container.tileY));
    });
    this.syncCollectedParts();
    if (container.equipment) {
      this.player.unlockWeapon(container.equipment);
      acquired.push(WEAPON_DEFINITIONS[container.equipment].name);
    }
    if (container.part) {
      if (this.collectedParts.has(container.part)) this.saveGame(false);
    }
    this.mapViews.containerViews.get(container.id)?.setAlpha(0.4);
    this.audio.play("pickup");
    this.hud.showMessage(acquired.length > 0 ? `획득: ${acquired.join(", ")}` : "쓸 만한 물자가 없습니다.", 3_000);
    this.refreshInventoryPanel();
  }

  private pickupDrop(drop: ItemDrop): void {
    const added = this.inventory.add(drop.itemId, drop.quantity);
    if (added <= 0) {
      this.hud.showMessage("인벤토리가 가득 찼습니다.");
      return;
    }
    drop.quantity -= added;
    this.syncCollectedParts();
    if (drop.quantity <= 0) {
      this.drops = this.drops.filter((candidate) => candidate !== drop);
      drop.destroy();
      if (drop.id.startsWith("ground-")) this.searchedContainers.add(`ground:${drop.id}`);
    }
    this.audio.play("pickup");
    this.hud.showMessage(`${getItemDefinition(drop.itemId).name} ${added} 획득`);
  }

  private rescueCompanion(): void {
    this.companion.rescued = true;
    this.companion.command = "follow";
    this.mapViews.survivorMarker.setVisible(false);
    this.hud.showMessage("생존자를 구조했습니다. Q로 명령할 수 있습니다.", 4_000);
    this.saveGame(false);
  }

  private createGroundItems(): void {
    this.map.groundItems.forEach((item) => {
      if (!this.searchedContainers.has(`ground:${item.id}`)) this.drops.push(new ItemDrop(this, item.id, item.itemId, item.quantity, tileCenter(item.tileX), tileCenter(item.tileY)));
    });
  }

  private spawnDrop(itemId: string, quantity: number, x: number, y: number): void {
    this.dropCounter += 1;
    this.drops.push(new ItemDrop(this, `drop-${this.dropCounter}`, itemId, quantity, x, y));
  }

  private craft(recipeId: string): void {
    const result = this.crafting.craft(recipeId, this.inventory);
    if (!result.success) {
      this.hud.showMessage(result.reason === "inventory-full" ? "제작품을 넣을 공간이 없습니다." : "재료가 부족합니다.");
      return;
    }
    const recipe = result.recipe;
    if (!recipe) return;
    this.syncCollectedParts();
    this.noise.emit({ x: this.player.position.x, y: this.player.position.y, intensity: recipe.noiseIntensity, radius: recipe.noiseIntensity * 3, category: "craft", createdAt: this.simulationTime });
    this.audio.play("craft");
    this.hud.showMessage(`${recipe.name} 제작 완료 · 소음이 발생했습니다.`);
    this.refreshInventoryPanel();
  }

  private useInventorySlot(index: number): void {
    const slot = this.inventory.getSlots()[index];
    if (slot) this.useItem(slot.itemId);
  }

  private useQuickslot(index: number): void {
    const itemId = this.quickslots[index];
    if (!itemId) {
      this.hud.showMessage(`${index + 1}번 퀵슬롯이 비었습니다.`);
      return;
    }
    this.useItem(itemId);
  }

  private useItem(itemId: string): void {
    if (this.inventory.count(itemId) <= 0) {
      this.hud.showMessage(`${getItemDefinition(itemId).name}이 없습니다.`);
      return;
    }
    let consumed = false;
    if (itemId === "bandage" && this.player.vitals.health < this.player.vitals.maxHealth) {
      this.player.vitals = this.infection.heal(this.player.vitals, 28);
      consumed = true;
    } else if (itemId === "medicine" && this.player.vitals.infection > 0) {
      this.player.vitals = this.infection.useMedicine(this.player.vitals);
      consumed = true;
    } else if ((itemId === "canned_food" || itemId === "water") && this.player.vitals.health < this.player.vitals.maxHealth) {
      this.player.vitals = this.infection.heal(this.player.vitals, itemId === "canned_food" ? 10 : 5);
      consumed = true;
    } else if (itemId === "torch") {
      this.player.torchRemaining = Math.max(this.player.torchRemaining, BALANCE.torchSeconds);
      consumed = true;
      this.nextFogAt = 0;
    } else if (itemId === "molotov") {
      this.throwMolotov();
      consumed = true;
    } else if (itemId === "barricade") {
      consumed = this.placeBarricade();
    } else if (itemId === "scrap_cache") {
      this.inventory.add("metal", 1);
      if (this.rng.chance(0.5)) this.inventory.add("wood", 1);
      consumed = true;
    }
    if (!consumed) {
      this.hud.showMessage("지금은 사용할 수 없습니다.");
      return;
    }
    this.inventory.remove(itemId, 1);
    this.syncCollectedParts();
    this.hud.showMessage(`${getItemDefinition(itemId).name} 사용`);
    this.refreshInventoryPanel();
  }

  private throwMolotov(): void {
    const range = 120;
    const raw = { x: this.player.position.x + Math.cos(this.player.aimAngle) * range, y: this.player.position.y + Math.sin(this.player.aimAngle) * range };
    const collision = this.collision.firstProjectileCollision(this.player.position, raw);
    const point = collision ?? raw;
    const view = this.add.graphics().setDepth(DEPTH.item + Math.round(point.y));
    view.fillStyle(0xe66d36, 0.7).fillRect(point.x - 10, point.y - 10, 8, 8).fillRect(point.x + 3, point.y - 7, 9, 9).fillRect(point.x - 4, point.y + 3, 10, 8);
    this.fires.push({ id: `fire-${this.simulationTime}`, x: point.x, y: point.y, remaining: 12, view, nextDamageAt: 0 });
    this.noise.emit({ x: point.x, y: point.y, intensity: NOISE_LEVELS.explosion, category: "explosion", createdAt: this.simulationTime });
    this.effects.emitFireBurst(point.x, point.y, ++this.ambientEffectSequence, this.simulationTime);
    this.nextFogAt = 0;
  }

  private placeBarricade(): boolean {
    const worldX = this.player.position.x + Math.cos(this.player.aimAngle) * 34;
    const worldY = this.player.position.y + Math.sin(this.player.aimAngle) * 34;
    const tileX = Math.floor(worldX / TILE_SIZE);
    const tileY = Math.floor(worldY / TILE_SIZE);
    if (this.collision.isTileBlocked(tileX, tileY)) {
      this.hud.showMessage("이 위치에는 설치할 수 없습니다.");
      return false;
    }
    const obstacle: WorldObstacle = {
      id: `barricade-${this.simulationTime}`, tileX, tileY, widthTiles: 1, heightTiles: 1,
      blocksMovement: true, blocksVision: false, blocksProjectiles: true, coverHeight: "low", kind: "barricade",
    };
    this.collision.addDynamicObstacle(obstacle);
    this.add.rectangle(tileCenter(tileX), tileCenter(tileY), TILE_SIZE - 4, 9, 0x825e3d).setStrokeStyle(2, 0x31251a).setDepth(DEPTH.propBack + tileCenter(tileY));
    this.noise.emit({ x: tileCenter(tileX), y: tileCenter(tileY), intensity: 20, category: "craft", createdAt: this.simulationTime });
    return true;
  }

  private updateFires(deltaSeconds: number): void {
    let writeIndex = 0;
    let expired = false;
    for (const fire of this.fires) {
      fire.remaining -= deltaSeconds;
      fire.view.setAlpha(0.55 + Math.sin(this.simulationTime / 80) * 0.2);
      if (this.simulationTime >= fire.nextDamageAt) {
        fire.nextDamageAt = this.simulationTime + 550;
        for (const zombie of this.zombies) {
          if (zombie.isAlive() && distance(zombie.position, fire) <= 34) {
            const impactX = zombie.position.x;
            const impactY = zombie.position.y;
            const angle = Math.atan2(impactY - fire.y, impactX - fire.x);
            this.damageZombie(zombie, 8, { x: 0, y: 0 });
            this.effects.emitBloodImpact(impactX, impactY, angle, "bat", ++this.ambientEffectSequence, this.simulationTime);
          }
        }
      }
      if (fire.remaining <= 0) {
        fire.view.destroy();
        expired = true;
      } else {
        this.fires[writeIndex] = fire;
        writeIndex += 1;
      }
    }
    this.fires.length = writeIndex;
    if (expired) this.nextFogAt = 0;
  }

  private dropInventorySlot(index: number): void {
    const dropped = this.inventory.dropFromSlot(index, 1);
    if (!dropped) return;
    this.spawnDrop(dropped.itemId, dropped.quantity, this.player.position.x + Math.cos(this.player.aimAngle) * 14, this.player.position.y + Math.sin(this.player.aimAngle) * 14);
    this.syncCollectedParts();
    this.refreshInventoryPanel();
  }

  private assignQuickslot(index: number, quickslot: number): void {
    const slot = this.inventory.getSlots()[index];
    if (!slot || quickslot < 0 || quickslot >= 5) return;
    this.quickslots[quickslot] = slot.itemId;
    this.hud.showMessage(`${quickslot + 1}번 퀵슬롯: ${getItemDefinition(slot.itemId).name}`);
    this.refreshInventoryPanel();
  }

  private equipWeapon(weaponId: WeaponId): void {
    if (!this.player.unlockedWeapons.has(weaponId)) return;
    this.player.equippedWeapon = weaponId;
    this.hud.showMessage(`${WEAPON_DEFINITIONS[weaponId].name} 장착`);
    this.refreshInventoryPanel();
  }

  private getInventoryPanelState(): InventoryPanelState {
    return {
      slots: this.inventory.getSlots(),
      quickslots: [...this.quickslots],
      recipes: this.crafting.getRecipes(),
      unlockedWeapons: [...this.player.unlockedWeapons],
      equippedWeapon: this.player.equippedWeapon,
      weaponNames: {
        knife: WEAPON_DEFINITIONS.knife.name,
        bat: WEAPON_DEFINITIONS.bat.name,
        pistol: WEAPON_DEFINITIONS.pistol.name,
      },
    };
  }

  private refreshInventoryPanel(): void {
    this.inventoryPanel.update(this.getInventoryPanelState());
    this.updateHud();
  }

  private tryStartExtraction(): void {
    this.syncCollectedParts();
    if (this.collectedParts.size < 3) {
      this.hud.showMessage(`탈출 부품이 부족합니다. (${this.collectedParts.size}/3)`);
      return;
    }
    if (this.clock.getPhase() === "day") {
      this.hud.showMessage("차량은 준비됐습니다. 해가 질 때까지 물자와 동료를 준비하세요.", 3_500);
      return;
    }
    this.defenseActive = true;
    this.defenseRemaining = BALANCE.defenseSeconds;
    this.nextDefenseSpawnAt = this.simulationTime;
    this.noise.emit({ x: this.map.extractionZone.x, y: this.map.extractionZone.y, intensity: 100, category: "explosion", createdAt: this.simulationTime, radius: 350 });
    this.hud.showMessage("엔진 소음이 도시를 깨웠습니다. 탈출 지점을 방어하세요!", 4_000);
  }

  private updateExtraction(deltaSeconds: number): void {
    if (!this.defenseActive) return;
    const inZone = distance(this.player.position, this.map.extractionZone) <= this.map.extractionZone.radius + 20;
    if (inZone) this.defenseRemaining = Math.max(0, this.defenseRemaining - deltaSeconds);
    if (this.defenseRemaining <= 0) this.finishGame(true, "탈출 차량의 시동이 걸렸습니다.");
  }

  private updateSpawning(): void {
    if (this.activeZombieCount >= BALANCE.maxActiveZombies) return;
    if (this.defenseActive && this.simulationTime >= this.nextDefenseSpawnAt) {
      this.nextDefenseSpawnAt = this.simulationTime + 2_400;
      this.spawnWave(this.rng.chance(0.42) ? "runner" : "walker", 2, this.map.extractionZone, 190);
      return;
    }
    if (this.clock.getPhase() === "night" && this.simulationTime >= this.nextNightSpawnAt) {
      this.nextNightSpawnAt = this.simulationTime + 11_000;
      this.spawnWave(this.rng.chance(0.32) ? "runner" : "walker", 1, this.player.position, 260);
    }
  }

  private spawnWave(kind: ZombieKind, count: number, center: Point, radius: number): void {
    for (let index = 0; index < count; index += 1) {
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const angle = this.rng.next() * Math.PI * 2;
        const x = Math.max(12, Math.min(WORLD_SIZE - 12, center.x + Math.cos(angle) * radius));
        const y = Math.max(12, Math.min(WORLD_SIZE - 12, center.y + Math.sin(angle) * radius));
        if (this.collision.isMovementBlockedWorld(x, y, BALANCE.zombieRadius)) continue;
        const zombie = new Zombie(this, `spawned-${Math.round(this.simulationTime)}-${index}-${attempt}`, kind, { x, y }, "InvestigateNoise");
        zombie.mind.lastHeardNoisePosition = { ...center };
        this.zombies.push(zombie);
        this.activeZombieCount += 1;
        break;
      }
    }
  }

  private recomputeFog(force: boolean): void {
    const playerCellX = Math.floor(this.player.position.x / FOG_CELL_SIZE);
    const playerCellY = Math.floor(this.player.position.y / FOG_CELL_SIZE);
    const playerCell = playerCellY * this.fog.widthCells + playerCellX;
    const aimBucket = this.player.flashlightOn ? Math.round(this.player.aimAngle / (Math.PI / 90)) : -1;
    const sourceChanged = playerCell !== this.lastFogPlayerCell
      || aimBucket !== this.lastFogAimBucket
      || this.collision.visionRevision !== this.lastFogVisionRevision;
    if (!force && !sourceChanged && this.simulationTime < this.nextFogAt) return;
    this.nextFogAt = this.simulationTime + 50;

    const calculationStarted = performance.now();
    this.fog.recompute(buildVisionSources({
      x: this.player.position.x,
      y: this.player.position.y,
      aimAngle: this.player.aimAngle,
      flashlightOn: this.player.flashlightOn,
      torchRemaining: this.player.torchRemaining,
    }, this.clock, this.fires), this.collision);
    const calculationFinished = performance.now();
    this.fogRenderer.render();
    const textureFinished = performance.now();
    this.performanceMonitor.recordFog(calculationFinished - calculationStarted, textureFinished - calculationFinished);
    this.lastFogPlayerCell = playerCell;
    this.lastFogAimBucket = aimBucket;
    this.lastFogVisionRevision = this.collision.visionRevision;
    this.updateFogVisibility();
  }

  private updateFogVisibility(): void {
    this.zombies.forEach((zombie) => zombie.view.setVisible(
      this.fog.getStateAtWorld(zombie.position.x, zombie.position.y) === VisibilityState.Visible,
    ));
    this.drops.forEach((drop) => drop.setVisible(this.fog.getStateAtWorld(drop.x, drop.y) === VisibilityState.Visible));
    this.map.containers.forEach((container) => this.mapViews.containerViews.get(container.id)?.setVisible(
      this.fog.getStateAtWorld(tileCenter(container.tileX), tileCenter(container.tileY)) === VisibilityState.Visible,
    ));
    if (!this.companion.rescued) {
      const visible = this.fog.getStateAtWorld(this.companion.position.x, this.companion.position.y) === VisibilityState.Visible;
      this.mapViews.survivorMarker.setVisible(visible && this.companion.alive);
    }
    this.companion.view.setVisible(
      this.fog.getStateAtWorld(this.companion.position.x, this.companion.position.y) === VisibilityState.Visible,
    );
    this.fires.forEach((fire) => fire.view.setVisible(this.fog.getStateAtWorld(fire.x, fire.y) === VisibilityState.Visible));
  }

  private updateWorldTint(): void {
    const phase = this.clock.getPhase();
    const alpha = phase === "day" ? 0 : phase === "dusk" ? 0.08 + this.clock.getPhaseProgress() * 0.12 : phase === "night" ? 0.22 : 0.18 * (1 - this.clock.getPhaseProgress());
    if (!Number.isFinite(this.lastTintAlpha) || Math.abs(alpha - this.lastTintAlpha) >= 0.002) {
      this.tintOverlay.setAlpha(alpha);
      this.lastTintAlpha = alpha;
    }
  }

  private updateHud(): void {
    const objective = this.defenseActive
      ? "탈출 지점 안에서 버티기"
      : this.collectedParts.size < 3
        ? "부품과 생존자 탐색"
        : this.clock.getPhase() === "day"
          ? "해질녘까지 탈출 준비"
          : "탈출 차량으로 이동";
    this.hud.update({
      health: this.player.vitals.health,
      infection: this.player.vitals.infection,
      time: this.clock.getClockLabel(),
      phase: this.clock.getPhase(),
      weapon: WEAPON_DEFINITIONS[this.player.equippedWeapon].name,
      magazine: this.player.magazine,
      reserveAmmo: this.inventory.count("ammo"),
      flashlightCharge: this.player.flashlightCharge,
      flashlightOn: this.player.flashlightOn,
      torchRemaining: this.player.torchRemaining,
      quickslots: this.quickslots,
      collectedParts: this.collectedParts.size,
      companionHealth: this.companion.rescued ? this.companion.health : undefined,
      companionAlive: this.companion.alive,
      objective,
      defenseRemaining: this.defenseActive ? this.defenseRemaining : undefined,
    });
  }

  private saveGame(showFeedback: boolean): void {
    const data: SaveGame = {
      version: SAVE_VERSION,
      seed: this.seed,
      rngState: this.rng.getSeedState(),
      savedAt: Date.now(),
      player: {
        x: this.player.position.x,
        y: this.player.position.y,
        health: this.player.vitals.health,
        infection: this.player.vitals.infection,
        equippedWeapon: this.player.equippedWeapon,
        unlockedWeapons: [...this.player.unlockedWeapons],
        magazine: this.player.magazine,
        flashlightCharge: this.player.flashlightCharge,
        flashlightOn: this.player.flashlightOn,
        torchRemaining: this.player.torchRemaining,
      },
      clock: this.clock.snapshot(),
      inventory: this.inventory.snapshot(),
      quickslots: [...this.quickslots],
      companion: {
        x: this.companion.position.x,
        y: this.companion.position.y,
        health: this.companion.health,
        rescued: this.companion.rescued,
        alive: this.companion.alive,
        command: this.companion.command,
        targetX: this.companion.commandTarget?.x,
        targetY: this.companion.commandTarget?.y,
      },
      collectedParts: [...this.collectedParts],
      searchedContainers: [...this.searchedContainers],
      openedDoors: this.map.doors.filter((door) => door.open).map((door) => door.id),
      zombies: this.zombies.filter((zombie) => zombie.isAlive()).map((zombie) => ({
        id: zombie.id,
        kind: zombie.kind,
        state: zombie.mind.state,
        x: zombie.position.x,
        y: zombie.position.y,
        health: zombie.health,
      })),
      exploredFog: this.fog.exportExplored(),
      extraction: { active: this.defenseActive, remainingSeconds: this.defenseRemaining },
    };
    const success = this.saveSystem.save(data);
    if (showFeedback) this.hud.showMessage(success ? "생존 기록을 저장했습니다." : "저장에 실패했습니다.");
  }

  private restorePlayer(saved: SaveGame): void {
    this.player.vitals = { health: saved.player.health, maxHealth: 100, infection: saved.player.infection };
    saved.player.unlockedWeapons.forEach((weapon) => {
      if (weapon === "knife" || weapon === "bat" || weapon === "pistol") this.player.unlockedWeapons.add(weapon);
    });
    if (saved.player.equippedWeapon === "knife" || saved.player.equippedWeapon === "bat" || saved.player.equippedWeapon === "pistol") this.player.equippedWeapon = saved.player.equippedWeapon;
    this.player.magazine = saved.player.magazine;
    this.player.flashlightCharge = saved.player.flashlightCharge;
    this.player.flashlightOn = saved.player.flashlightOn;
    this.player.torchRemaining = saved.player.torchRemaining;
  }

  private restoreCompanion(saved: SaveGame): void {
    this.companion.health = saved.companion.health;
    this.companion.rescued = saved.companion.rescued;
    this.companion.alive = saved.companion.alive;
    this.companion.command = saved.companion.command;
    if (saved.companion.targetX !== undefined && saved.companion.targetY !== undefined) this.companion.commandTarget = { x: saved.companion.targetX, y: saved.companion.targetY };
    if (!this.companion.alive) this.companion.view.setDead(true);
  }

  private applySearchedContainerViews(): void {
    this.searchedContainers.forEach((id) => this.mapViews.containerViews.get(id)?.setAlpha(0.4));
  }

  private syncCollectedParts(): void {
    for (const part of ["battery", "fuel", "engine_part"] as const) {
      if (this.inventory.count(part) > 0) this.collectedParts.add(part);
      else this.collectedParts.delete(part);
    }
  }

  private isInsideSafehouse(point: Point): boolean {
    const zone = this.map.safehouseZone;
    return point.x >= zone.x && point.x <= zone.x + zone.width && point.y >= zone.y && point.y <= zone.y + zone.height;
  }

  private finishGame(won: boolean, reason: string): void {
    if (this.gameEnded) return;
    this.gameEnded = true;
    if (won) this.saveSystem.clear();
    this.scene.start("result", {
      won,
      reason,
      companionAlive: this.companion.rescued && this.companion.alive,
      companionRescued: this.companion.rescued,
      elapsedSeconds: this.clock.getElapsedSeconds(),
      parts: this.collectedParts.size,
    });
  }

  private shutdownUi(): void {
    this.performanceMonitor?.destroy();
    this.effects?.destroy();
    this.fogRenderer?.destroy();
    this.hud?.destroy();
    this.inventoryPanel?.destroy();
    this.commandPanel?.destroy();
    this.pauseMenu?.destroy();
    this.uiRoot?.remove();
  }
}

function tileCenter(tile: number): number {
  return tile * TILE_SIZE + TILE_SIZE / 2;
}

function normalize(point: Point): Point {
  const length = Math.hypot(point.x, point.y);
  return length > 0 ? { x: point.x / length, y: point.y / length } : { x: 0, y: 0 };
}

function squaredDistance(first: Point, second: Point): number {
  const deltaX = first.x - second.x;
  const deltaY = first.y - second.y;
  return deltaX * deltaX + deltaY * deltaY;
}

function angleDelta(a: number, b: number): number {
  return Math.atan2(Math.sin(a - b), Math.cos(a - b));
}
