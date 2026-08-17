import Phaser from "phaser";
import { BALANCE, COMPANION_MOVEMENT, DEPTH, FLASHLIGHT_AIM_BUCKETS, FOG_CELL_SIZE, LOGICAL_HEIGHT, LOGICAL_WIDTH, MAP_ID, MAP_VERSION, MAX_PATHFINDING_PER_FRAME, OBSTACLE_BALANCE, SAVE_KEY, SAVE_VERSION, TILE_SIZE, WORLD_HEIGHT, WORLD_WIDTH } from "../config/game-config";
import { GameSettingsStore, type GameSettings } from "../core/game-settings";
import { GameClock } from "../core/game-clock";
import type { SaveGame, SavedBarricadeState } from "../core/save-state";
import { SeededRng } from "../core/seeded-rng";
import { createCityBlockMap, getTerrain, isRoad, TerrainType, type ContainerDefinition, type DoorDefinition, type WorldObstacle } from "../data/map-definitions";
import { assertValidMap } from "../data/map-validation";
import { getItemDefinition } from "../data/item-definitions";
import { RECIPE_DEFINITIONS } from "../data/recipe-definitions";
import { BUILDABLE_ITEM_KIND, BUILDABLE_DEFINITIONS, type BuildableKind } from "../data/buildable-definitions";
import { isFirearmId, WEAPON_DEFINITIONS, type WeaponId } from "../data/weapon-definitions";
import type { ZombieKind } from "../data/zombie-definitions";
import { PerformanceMonitor } from "../debug/performance-monitor";
import { AttackEffectController, getAttackBlockReason } from "../effects/attack-effect-controller";
import { aggregateProjectileDamage, type DamageImpactContext } from "../effects/blood-effect-math";
import type { AttackEffectImpact } from "../effects/pixel-effect-definitions";
import { PixelEffectSystem } from "../effects/pixel-effect-system";
import { Companion, type CompanionCommand } from "../entities/companion";
import { DestructibleObstacleSystem, getZombieStructureDamage } from "../entities/destructible-obstacle";
import { ItemDrop } from "../entities/item-drop";
import { Player } from "../entities/player";
import { createPlacedStructure, type PlacedStructureState } from "../entities/placed-structure";
import type { InteractionContext, WorldObject, WorldObjectKind } from "../entities/world-object";
import { Zombie } from "../entities/zombie";
import { FogRenderer } from "../rendering/fog-renderer";
import { createMapRendering, updateDoorView, type MapViews } from "../rendering/map-renderer";
import { BarricadeView } from "../rendering/obstacle-views";
import { createPowerWirePolyline } from "../rendering/power-wire-geometry";
import { StructureView } from "../rendering/structure-view";
import { AudioSystem,playFirearmShotForEvent } from "../systems/audio-system";
import { CameraController, configurePaddedCameraBounds } from "../systems/camera-controller";
import { CollisionSystem } from "../systems/collision-system";
import { pointSegmentDistanceSquared, visibilityProbeTowardPoint } from "../systems/collision-geometry";
import { angleDifference, distance, firstTargetOnLine, getFinalZombieKnockback, targetsInMeleeArc, type ZombieKnockbackKind } from "../systems/combat-system";
import { chooseLocalSteering, findNearestWalkableGoal, getCompanionCombatMovement, getCompanionFollowSpeed, getCompanionStuckDuration, getWorldTileIndex, markCompanionBlocked, markCompanionRepath, selectCompanionCombatTarget, shouldOverrideCompanionGoalForCombat, updateCatchUpMode, updateCompanionStuckState } from "../systems/companion-navigation";
import { createFormationState, getFormationSlot, updateFormationDirection, type FormationState } from "../systems/companion-system";
import { CraftingSystem } from "../systems/crafting-system";
import { FogInvalidationTracker, FogOfWarSystem, VisibilityState, type VisionSource } from "../systems/fog-of-war-system";
import { InfectionSystem } from "../systems/infection-system";
import { applyConsumable, canApplyConsumable } from "../systems/consumable-system";
import { InventorySystem } from "../systems/inventory-system";
import { buildVisionSources, getCompanionVisionSignature, getVisionProfile, shouldConsumeFlashlightCharge, type ActiveFire } from "../systems/lighting-system";
import { InteractionSystem } from "../systems/interaction-system";
import { NoiseSystem, NOISE_LEVELS } from "../systems/noise-system";
import { initializeNewGameLoadout } from "../systems/new-game-loadout";
import { findTilePath, findWeightedTilePath } from "../systems/pathfinding-system";
import { SaveSystem } from "../systems/save-system";
import { WorldObjectRegistry } from "../systems/world-object-registry";
import { AUTO_PICKUP_INTERVAL_MS, AutoPickupSystem } from "../systems/auto-pickup-system";
import { grantCompendiumEntry, type CompendiumEntry } from "../systems/compendium-system";
import { CameraFeedbackSystem, type CameraFeedbackEvent } from "../systems/camera-feedback-system";
import { createPelletAngles } from "../systems/weapon-system";
import { getBuildablePlacementFailure } from "../systems/buildable-placement";
import { GENERATOR_FUEL_SECONDS, MAX_GENERATOR_FUEL_SECONDS, POWER_TICK_MS, PowerGridSystem } from "../systems/power-grid-system";
import { rotateTurretToward, selectTurretTarget, TURRET_AIM_TOLERANCE, TURRET_COOLDOWN_MS, TURRET_DAMAGE, TURRET_RANGE, TURRET_SCAN_INTERVAL_MS, type TurretTarget } from "../systems/turret-system";
import { updateZombieMind, ZOMBIE_CHASE_MULTIPLIER, type Point } from "../systems/zombie-ai-system";
import { canRun, createSurvivalNeeds, getRunSpeedMultiplier, updateSurvivalNeeds } from "../systems/survival-needs-system";
import { getHordeActivationCount, getHordeActivationIntervalMs, HORDE_SPAWN_SCAN_BUDGET, isEligibleHordeSpawn } from "../systems/gunshot-horde-system";
import { CompanionCommandPanel } from "../ui/companion-command-panel";
import { Hud } from "../ui/hud";
import { InventoryPanel, type InventoryPanelState } from "../ui/inventory-panel";
import { PauseMenu } from "../ui/pause-menu";
import { MinimapPanel, shouldPauseSimulationForMap } from "../ui/minimap";
import { DayAnnouncement, getInitialDayAnnouncement } from "../ui/day-announcement";
import { getFootstepEvent } from "../systems/footstep-system";

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
  map: Phaser.Input.Keyboard.Key;
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

interface AttackableTarget {
  id: string;
  position: Point;
  alive: boolean;
  kind: "player" | "companion";
}

const SEPARATION_CELL_SIZE = 12;
const SEPARATION_BUCKET_COLUMNS = Math.ceil(WORLD_WIDTH / SEPARATION_CELL_SIZE);
const ZOMBIE_ACTIVATION_RADIUS = 760;
const ZOMBIE_DORMANT_RADIUS = 960;

export class WorldScene extends Phaser.Scene {
  private loadRequested = false;
  private map!: ReturnType<typeof createCityBlockMap>;
  private collision!: CollisionSystem;
  private destructibles!: DestructibleObstacleSystem;
  private clock!: GameClock;
  private fog!: FogOfWarSystem;
  private fogRenderer!: FogRenderer;
  private cameraController!: CameraController;
  private mapViews!: MapViews;
  private readonly barricadeViews = new Map<string, BarricadeView>();
  private structures: PlacedStructureState[] = [];
  private readonly structureViews = new Map<string, StructureView>();
  private readonly turretRuntime = new Map<string, { target?: Zombie; nextScanAt: number; nextFireAt: number }>();
  private readonly turretTargetScratch: TurretTarget[] = [];
  private readonly powerGrid = new PowerGridSystem();
  private powerWireGraphics?: Phaser.GameObjects.Graphics;
  private indoorTiles = new Uint8Array(0);
  private structureCounter = 0;
  private nextPowerTickAt = 0;
  private player!: Player;
  private companions: Companion[] = [];
  /** Per-iteration scratch used by the allocation-free single companion updater. */
  private companion!: Companion;
  private readonly companionsById = new Map<string, Companion>();
  private readonly rescuedCompanions: Companion[] = [];
  private zombies: Zombie[] = [];
  private readonly minimapZombieSources: Zombie[] = [];
  private readonly teamVisibleZombies: Zombie[] = [];
  private nextTeamTargetScanAt = 0;
  private drops: ItemDrop[] = [];
  private inventory!: InventorySystem;
  private crafting = new CraftingSystem(RECIPE_DEFINITIONS);
  private infection = new InfectionSystem();
  private noise = new NoiseSystem();
  private saveSystem!: SaveSystem;
  private settingsStore!: GameSettingsStore;
  private settings!: GameSettings;
  private rng!: SeededRng;
  private seed = 0;
  private quickslots: Array<string | null> = ["bandage", "medicine", "torch", "molotov", "barricade"];
  private collectedParts = new Set<string>();
  private searchedContainers = new Set<string>();
  private effects!: PixelEffectSystem;
  private attackEffects!: AttackEffectController;
  private audio!: AudioSystem;
  private keys!: WorldKeys;
  private uiRoot!: HTMLDivElement;
  private hud!: Hud;
  private inventoryPanel!: InventoryPanel;
  private commandPanel!: CompanionCommandPanel;
  private pauseMenu!: PauseMenu;
  private minimap!: MinimapPanel;
  private dayAnnouncement!: DayAnnouncement;
  private tintOverlay!: Phaser.GameObjects.Rectangle;
  private telegraphGraphics!: Phaser.GameObjects.Graphics;
  private performanceMonitor!: PerformanceMonitor;
  private fires: FireRuntime[] = [];
  private formation: FormationState = createFormationState();
  private pendingCompanionCommand?: "move" | "focus";
  private simulationTime = 0;
  private nextFootstepAt = 0;
  private nextHudAt = 0;
  private readonly fogInvalidation = new FogInvalidationTracker();
  private readonly visionSources: VisionSource[] = [];
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
  private readonly pointerWorldSnapshot = new Phaser.Math.Vector2();
  private pointerInsideGame = false;
  private readonly consumedZombieSpawnIds = new Set<string>();
  private nextDormantActivationAt = 0;
  private nextHordeActivationAt = 0;
  private hordeSpawnCursor = 0;
  private barricadeCounter = 0;
  private readonly targetedObstacleIds = new Set<string>();
  private readonly worldObjects = new WorldObjectRegistry();
  private readonly autoPickup = new AutoPickupSystem();
  private readonly cameraFeedback = new CameraFeedbackSystem();
  private nextAutoPickupAt = 0;
  private nextInventoryFullMessageAt = 0;
  private nextZombieGrowlAt = 0;
  private readonly interactionSystem = new InteractionSystem(this.worldObjects, 75);
  private readonly zombieTargets: AttackableTarget[] = [];

  constructor() {
    super("world");
  }

  init(data: WorldSceneData = {}): void {
    this.loadRequested = Boolean(data.load);
  }

  create(): void {
    this.resetRuntimeCollections();
    this.saveSystem = new SaveSystem(window.localStorage, SAVE_KEY);
    this.settingsStore = new GameSettingsStore(window.localStorage);
    this.settings = this.settingsStore.load();
    const saved = this.loadRequested ? this.saveSystem.load() : null;
    const mapReset = this.saveSystem.consumeIncompatibleMapReset();
    this.seed = saved?.seed ?? ((Date.now() ^ 0x5f3759df) >>> 0);
    this.rng = new SeededRng(saved?.rngState ?? this.seed);
    this.map = createCityBlockMap(saved?.mapSeed ?? (this.seed ^ 0x6d617032));
    if ((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV) assertValidMap(this.map);
    if (saved) this.restoreDoorStates(saved);
    this.collision = new CollisionSystem(
      this.map.obstacles,
      this.map.doors,
      this.map.widthTiles,
      this.map.heightTiles,
      TILE_SIZE,
      this.map.wallSegments,
    );
    this.destructibles = new DestructibleObstacleSystem(this.map.doors, this.map.widthTiles);
    this.clock = new GameClock();
    if (saved) this.clock.restore(saved.clock);
    this.mapViews = createMapRendering(this, this.map);
    for (const barricade of saved?.barricades ?? []) this.restoreBarricade(barricade);
    this.indoorTiles = new Uint8Array(this.map.widthTiles * this.map.heightTiles);
    for (const building of this.map.buildings) for (const index of building.floorTiles) this.indoorTiles[index] = 1;
    this.powerWireGraphics = this.add.graphics().setDepth(DEPTH.propBack + 1);
    for (const structure of saved?.structures ?? []) this.restoreStructure({ ...structure, powered: false });
    this.rebuildPowerTopology();

    this.inventory = new InventorySystem(BALANCE.inventorySlots, saved?.inventory);
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
    else initializeNewGameLoadout(this.inventory, this.player);
    this.createCompanions(saved);

    this.createZombies(saved);
    this.createGroundItems();
    this.applySearchedContainerViews();

    this.fog = new FogOfWarSystem(WORLD_WIDTH, WORLD_HEIGHT, FOG_CELL_SIZE, this.seed);
    if (saved) this.fog.importExplored(saved.exploredFog);
    this.fogRenderer = new FogRenderer(this, this.fog);
    this.effects = new PixelEffectSystem(this, (x, y) => this.fog.getStateAtWorld(x, y) === VisibilityState.Visible);
    this.attackEffects = new AttackEffectController(this.effects);
    this.audio = new AudioSystem(this);
    this.registerExistingWorldObjects();
    this.tintOverlay = this.add.rectangle(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT / 2, LOGICAL_WIDTH, LOGICAL_HEIGHT, 0x101b2c, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH.tint);
    this.telegraphGraphics = this.add.graphics().setDepth(DEPTH.propFront + 500);

    this.configureCamera();
    this.configureInput();
    this.createUi();
    const initialDay = getInitialDayAnnouncement(Boolean(saved), this.clock.getDayNumber());
    if (initialDay !== undefined && this.dayAnnouncement.show(initialDay)) this.audio.requestDayStart();
    for (const state of this.destructibles.barricadeStates()) this.minimap.markBarricadeTile(state.tileX, state.tileY, true);
    this.performanceMonitor = new PerformanceMonitor(this, this.uiRoot);
    this.recomputeFog(true);
    this.updateHud();
    this.wasInSafehouse = this.isInsideSafehouse(this.player.position);
    this.hud.showMessage(mapReset ? "도시 확장으로 기존 기록을 초기화하고 새 게임을 시작했습니다." : saved ? "저장된 생존 기록을 불러왔습니다." : "해가 지기 전에 탈출 부품 3개와 생존자를 찾으세요.", 4_000);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdownUi());
  }

  update(time: number, rawDelta: number): void {
    if (this.gameEnded) return;
    this.performanceMonitor.beginFrame(rawDelta);
    this.pathfindingWorkThisFrame = 0;
    this.handlePanelKeys();
    this.capturePointerWorldSnapshot();
    if (shouldPauseSimulationForMap(this.minimap.getMode())) {
      this.minimap.update(time, this.getMinimapDynamicState());
      this.recordNavigationDiagnostics();
      this.performanceMonitor.update(time, this.activeZombieCount);
      return;
    }
    if (this.inventoryPanel.isOpen() || this.pauseMenu.isOpen()) {
      this.player.updateView(this.simulationTime);
      this.updateCamera(rawDelta, false);
      this.recordNavigationDiagnostics();
      this.performanceMonitor.update(time, this.activeZombieCount);
      return;
    }

    const timeScale = this.commandPanel.isOpen() ? 0.25 : 1;
    const deltaMs = Math.min(rawDelta, 50) * timeScale;
    const deltaSeconds = deltaMs / 1_000;
    this.simulationTime += deltaMs;
    const clockUpdate = this.clock.update(deltaSeconds);
    if (clockUpdate.dayStarted && this.dayAnnouncement.show(clockUpdate.dayNumber)) this.audio.requestDayStart();
    this.noise.updateGunshotPressure(deltaSeconds);
    this.audio.updateBgm(this.noise.getGunshotPressure().value, deltaSeconds);
    this.telegraphGraphics.clear();

    this.updatePlayer(deltaSeconds);
    this.updateAutoPickup();
    this.updateFires(deltaSeconds);
    this.refreshTeamVisibleZombies();
    this.updateCompanions(time, deltaSeconds);
    this.updateZombies(time, deltaSeconds);
    this.updateZombieAudio();
    this.updatePowerAndTurrets(deltaSeconds);
    this.updateObstacleViews();
    this.performanceMonitor.recordSeparationCandidates(this.applyZombieSeparation());
    this.updateSpawning();
    this.updateExtraction(deltaSeconds);
    this.effects.update(this.simulationTime, deltaSeconds);
    this.noise.prune(this.simulationTime);
    this.updateWorldTint();
    this.recomputeFog(false);
    this.updateCamera(rawDelta, this.pointerInsideGame);
    this.cameraFeedback.flush(this.game.loop.frame, (duration, intensity) => this.cameras.main.shake(duration, intensity));
    if (this.minimap.isVisible()) this.minimap.update(time, this.getMinimapDynamicState());
    this.updateInteractionPrompt();

    if (this.simulationTime >= this.nextHudAt) {
      this.nextHudAt = this.simulationTime + 160;
      this.updateHud();
    }
    if (this.infection.isGameOver(this.player.vitals)) {
      this.finishGame(false, this.player.vitals.infection >= 100 ? "감염이 전신으로 퍼졌습니다." : "도시에서 쓰러졌습니다.");
    }
    this.recordNavigationDiagnostics();
    this.performanceMonitor.update(time, this.activeZombieCount);
  }

  private capturePointerWorldSnapshot(): void {
    const pointer = this.input.activePointer;
    this.cameras.main.getWorldPoint(pointer.x, pointer.y, this.pointerWorldSnapshot);
    this.pointerInsideGame = this.cameraController.isPointerInsideGame() && document.hasFocus();
  }

  private updateCamera(deltaMs: number, allowCursorLead: boolean): void {
    this.cameraController.update({
      playerX: this.player.position.x,
      playerY: this.player.position.y,
      pointerX: this.pointerWorldSnapshot.x,
      pointerY: this.pointerWorldSnapshot.y,
      pointerInsideGame: allowCursorLead,
    }, deltaMs);
  }

  private recordNavigationDiagnostics(): void {
    this.performanceMonitor.recordCameraAndMinimap(this.cameraController.getZoom(), this.minimap.isOpen());
    this.performanceMonitor.recordCompanion(
      this.rescuedCompanions[0] ? distance(this.player.position, this.rescuedCompanions[0].position) : 0,
      this.rescuedCompanions.some((companion) => companion.navigation.catchUpMode),
      this.rescuedCompanions.reduce((maximum, companion) => Math.max(maximum, getCompanionStuckDuration(companion.navigation, this.simulationTime)), 0),
      this.rescuedCompanions.reduce((total, companion) => total + companion.navigation.repathCount, 0),
    );
  }

  private getMinimapDynamicState() {
    return {
      player: this.player.position,
      companions: this.companions,
      zombies: this.minimapZombieSources,
      collectedParts: this.collectedParts.size,
      defenseActive: this.defenseActive,
      developerMode: this.settings.developerMode,
      cameraWorldView: this.cameras.main.worldView,
    };
  }

  private resetRuntimeCollections(): void {
    this.zombies = [];
    this.minimapZombieSources.length = 0;
    this.teamVisibleZombies.length = 0;
    this.nextTeamTargetScanAt = 0;
    this.drops = [];
    this.companions = [];
    this.companionsById.clear();
    this.rescuedCompanions.length = 0;
    this.fires = [];
    this.formation = createFormationState();
    this.pendingCompanionCommand = undefined;
    this.simulationTime = 0;
    this.nextFootstepAt = 0;
    this.nextHudAt = 0;
    this.nextZombieGrowlAt = 2_500;
    this.fogInvalidation.reset();
    this.visionSources.length = 0;
    this.nextNightSpawnAt = 0;
    this.nextDefenseSpawnAt = 0;
    this.dropCounter = 0;
    this.ambientEffectSequence = 1_000_000;
    this.gameEnded = false;
    this.activeZombieCount = 0;
    this.pathfindingWorkThisFrame = 0;
    this.separationUsedBuckets.length = 0;
    this.lastTintAlpha = Number.NaN;
    this.consumedZombieSpawnIds.clear();
    this.nextDormantActivationAt = 0;
    this.nextHordeActivationAt = 0;
    this.hordeSpawnCursor = 0;
    this.barricadeCounter = 0;
    this.barricadeViews.clear();
    this.structures = [];
    this.structureViews.clear();
    this.turretRuntime.clear();
    this.turretTargetScratch.length = 0;
    this.indoorTiles = new Uint8Array(0);
    this.structureCounter = 0;
    this.nextPowerTickAt = 0;
    this.nextAutoPickupAt = 0;
    this.nextInventoryFullMessageAt = 0;
    this.autoPickup.clear();
    this.noise.clear();
    this.targetedObstacleIds.clear();
    this.interactionSystem.clear();
    this.worldObjects.clear();
  }

  private createCompanions(saved: SaveGame | null): void {
    const savedById = new Map((saved?.companions ?? []).map((state) => [state.id, state]));
    this.companions = this.map.companionSpawns.map((spawn, index) => {
      const state = savedById.get(spawn.id);
      const position = state ?? { x: tileCenter(spawn.tileX), y: tileCenter(spawn.tileY) };
      const companion = new Companion(this, spawn.id, position, index);
      if (state) {
        companion.health = state.health;
        companion.rescued = state.rescued;
        companion.alive = state.alive;
        companion.command = state.command;
        companion.focusTargetId = state.focusTargetId;
        if (state.targetX !== undefined && state.targetY !== undefined) companion.commandTarget = { x: state.targetX, y: state.targetY };
        if (!companion.alive) companion.view.setDead(true);
        this.recoverCompanionFromBlockedSave(companion);
      }
      this.companionsById.set(companion.id, companion);
      this.mapViews.survivorMarkers.get(companion.id)?.setVisible(!companion.rescued && companion.alive);
      return companion;
    });
    this.refreshRescuedCompanions();
  }

  private refreshRescuedCompanions(): void {
    this.rescuedCompanions.length = 0;
    for (const companion of this.companions) if (companion.rescued && companion.alive) this.rescuedCompanions.push(companion);
  }

  private registerExistingWorldObjects(): void {
    this.worldObjects.register(this.makeWorldObject(this.player.id, "player", this.player.view, () => this.player.position, () => true));
    for (const companion of this.companions) this.registerCompanionObject(companion);
    for (const zombie of this.zombies) this.registerZombieObject(zombie);
    for (const drop of this.drops) this.registerDropObject(drop);
    for (const door of this.map.doors) {
      const view = this.mapViews.doorViews.get(door.id);
      if (!view) continue;
      const position = { x: tileCenter(door.tileX), y: tileCenter(door.tileY) };
      const visibilityProbe = { x: position.x, y: position.y };
      const object = this.makeWorldObject(door.id, "door", view, () => position, () => !door.destroyed, {
        range: 34, requiresLineOfSight: false, selectionPriority: 10,
        distanceSquaredTo: (origin) => pointSegmentDistanceSquared(origin, door.segment!),
        getVisibilityProbe: (origin) => visibilityProbeTowardPoint(origin, door.segment!, door.segment!.thickness / 2 + FOG_CELL_SIZE * 0.75, visibilityProbe),
        isEnabled: () => !door.destroyed,
        getPrompt: () => `[E] 문 ${door.open ? "닫기" : "열기"}`,
        execute: () => this.toggleDoor(door),
      });
      this.worldObjects.register(object);
      if (door.destroyed) this.worldObjects.setInteractable(door.id, false);
    }
    for (const container of this.map.containers) {
      const view = this.mapViews.containerViews.get(container.id);
      if (!view) continue;
      const position = { x: tileCenter(container.tileX), y: tileCenter(container.tileY) };
      this.worldObjects.register(this.makeWorldObject(container.id, "container", view, () => position, () => !this.searchedContainers.has(container.id), {
        range: 34, requiresLineOfSight: true, selectionPriority: 10,
        isEnabled: () => !this.searchedContainers.has(container.id),
        getPrompt: () => "[E] 조사", execute: () => this.searchContainer(container),
      }));
      if (this.searchedContainers.has(container.id)) this.worldObjects.setInteractable(container.id, false);
    }
    for (const [id, view] of this.barricadeViews) {
      const state = this.destructibles.get(id);
      if (state) {
        const position = { x: tileCenter(state.tileX), y: tileCenter(state.tileY) };
        this.worldObjects.register(this.makeWorldObject(id, "barricade", view, () => position, () => !state.destroyed));
      }
    }
    for (const structure of this.structures) this.registerStructureObject(structure);
    this.worldObjects.register(this.makeWorldObject("extraction", "extraction", this.mapViews.extractionView, () => this.map.extractionZone, () => !this.defenseActive, {
      range: this.map.extractionZone.radius, requiresLineOfSight: false, selectionPriority: 0,
      isEnabled: () => !this.defenseActive, getPrompt: () => "[E] 탈출 차량 수리", execute: () => this.tryStartExtraction(),
    }));
    if (this.defenseActive) this.worldObjects.setInteractable("extraction", false);
  }

  private registerCompanionObject(companion: Companion): void {
    const object = this.makeWorldObject(companion.id, companion.rescued ? "companion" : "survivor", companion.view, () => companion.position, () => companion.alive, {
      range: 34, requiresLineOfSight: true, selectionPriority: 10,
      isEnabled: () => !companion.rescued && companion.alive,
      getPrompt: () => "[E] 생존자 구조", execute: () => this.rescueCompanion(companion),
    });
    this.worldObjects.register(object);
    if (companion.rescued || !companion.alive) this.worldObjects.setInteractable(companion.id, false);
  }

  private registerZombieObject(zombie: Zombie): void {
    if (this.worldObjects.get(zombie.id)) return;
    this.worldObjects.register(this.makeWorldObject(zombie.id, "zombie", zombie.view, () => zombie.position, () => zombie.isAlive()));
  }

  private registerDropObject(drop: ItemDrop): void {
    if (this.worldObjects.get(drop.id)) return;
    const position = { x: drop.x, y: drop.y };
    this.worldObjects.register(this.makeWorldObject(drop.id, "item-drop", drop, () => position, () => drop.quantity > 0));
    this.autoPickup.register(drop);
  }

  private makeWorldObject(
    id: string,
    kind: WorldObjectKind,
    view: WorldObject["view"],
    getPosition: () => Point,
    isActive: () => boolean,
    interaction?: WorldObject["interaction"],
  ): WorldObject {
    return { id, kind, view, getPosition, isActive, isVisible: () => true, interaction };
  }

  private getInteractionContext(): InteractionContext {
    return { playerPosition: this.player.position, fog: this.fog, collision: this.collision };
  }

  private restoreDoorStates(saved: SaveGame): void {
    const states = new Map(saved.doorStates.map((state) => [state.id, state]));
    for (const door of this.map.doors) {
      const state = states.get(door.id);
      if (!state) {
        door.open = false;
        door.health = door.maxHealth;
        door.destroyed = false;
        continue;
      }
      door.destroyed = state.destroyed || state.health <= 0;
      door.health = door.destroyed ? 0 : Math.max(0, Math.min(door.maxHealth, state.health));
      door.open = door.destroyed || state.open;
    }
  }

  private restoreBarricade(saved: SavedBarricadeState): void {
    if (saved.tileX < 0 || saved.tileY < 0 || saved.tileX >= this.map.widthTiles || saved.tileY >= this.map.heightTiles) return;
    const state = this.destructibles.addBarricade(saved);
    const obstacle: WorldObstacle = {
      id: state.id, tileX: state.tileX, tileY: state.tileY, widthTiles: 1, heightTiles: 1,
      blocksMovement: true, blocksVision: false, blocksProjectiles: true, coverHeight: "low", kind: "barricade",
    };
    this.collision.addDynamicObstacle(obstacle);
    this.barricadeViews.set(state.id, new BarricadeView(this, state));
    this.barricadeCounter += 1;
  }

  private restoreStructure(state: PlacedStructureState): void {
    if (state.tileX < 0 || state.tileY < 0 || state.tileX >= this.map.widthTiles || state.tileY >= this.map.heightTiles) return;
    state.powered = false;
    this.structures.push(state);
    this.structureViews.set(state.id, new StructureView(this, state));
    this.collision.addDynamicObstacle({ id: state.id, tileX: state.tileX, tileY: state.tileY, widthTiles: 1, heightTiles: 1, blocksMovement: true, blocksVision: false, blocksProjectiles: true, coverHeight: "low", kind: "furniture" });
    if (state.kind === "turret") this.turretRuntime.set(state.id, { nextScanAt: 0, nextFireAt: 0 });
    this.structureCounter += 1;
  }

  private registerStructureObject(state: PlacedStructureState): void {
    const view = this.structureViews.get(state.id);
    if (!view || this.worldObjects.get(state.id)) return;
    const position = { x: tileCenter(state.tileX), y: tileCenter(state.tileY) };
    this.worldObjects.register(this.makeWorldObject(state.id, "power-structure", view, () => position, () => true, {
      range: 34, requiresLineOfSight: true, selectionPriority: 10, isEnabled: () => true,
      getPrompt: () => `[E] ${BUILDABLE_DEFINITIONS[state.kind].name} 상태 확인`, execute: () => this.interactWithStructure(state),
    }));
  }

  private interactWithStructure(state: PlacedStructureState): void {
    if (state.kind === "fuel-generator" && this.inventory.count("generator_fuel") > 0 && (state.fuelSeconds ?? 0) < MAX_GENERATOR_FUEL_SECONDS) {
      this.inventory.remove("generator_fuel", 1);
      state.fuelSeconds = Math.min(MAX_GENERATOR_FUEL_SECONDS, (state.fuelSeconds ?? 0) + GENERATOR_FUEL_SECONDS);
      this.hud.showMessage(`발전기 연료를 보급했습니다. 남은 연료 ${Math.ceil(state.fuelSeconds / GENERATOR_FUEL_SECONDS)}/4`);
      this.refreshInventoryPanel();
      return;
    }
    if (state.kind === "turret") this.hud.showMessage(`터렛 · ${state.powered ? "전력 공급 중" : this.powerGrid.getEdges().some((edge) => edge.fromId === state.id || edge.toId === state.id) ? "전력 부족" : "발전기와 연결되지 않음"}`);
    else if (state.kind === "solar-generator") this.hud.showMessage(`태양광 발전기 · ${this.clock.getPhase() === "day" ? "출력 8/s" : "야간 발전 정지"} · 저장 ${Math.floor(state.storedEnergy)}/40`);
    else if (state.kind === "fuel-generator") this.hud.showMessage(`연료 발전기 · 저장 ${Math.floor(state.storedEnergy)}/60 · 연료 ${Math.ceil((state.fuelSeconds ?? 0) / GENERATOR_FUEL_SECONDS)}/4`);
    else this.hud.showMessage(`축전지 · 저장 ${Math.floor(state.storedEnergy)}/240`);
  }

  private configureCamera(): void {
    const camera = this.cameras.main;
    configurePaddedCameraBounds(camera, WORLD_WIDTH, WORLD_HEIGHT);
    camera.setRoundPixels(true);
    camera.stopFollow();
    camera.setBackgroundColor(0x080b0d);
    this.cameraController = new CameraController(camera, this.game.canvas, () => (
      !this.inventoryPanel?.isOpen() && !this.pauseMenu?.isOpen() && !this.minimap?.isFull() && !this.gameEnded
    ), WORLD_WIDTH, WORLD_HEIGHT);
  }

  private configureInput(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error("Keyboard input unavailable");
    this.keys = keyboard.addKeys({
      up: "W", down: "S", left: "A", right: "D", run: "SHIFT",
      interact: "E", reload: "R", flashlight: "F", command: "Q",
      inventory: "TAB", map: "M", pause: "ESC",
      quick1: "ONE", quick2: "TWO", quick3: "THREE", quick4: "FOUR", quick5: "FIVE",
    }) as unknown as WorldKeys;
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.audio.unlockAndStartBgm();
      if (pointer.button !== 0 || this.inventoryPanel?.isOpen() || this.pauseMenu?.isOpen() || this.minimap?.isFull()) return;
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y, this.pointerWorldSnapshot);
      this.player.aimAngle = Math.atan2(world.y - this.player.position.y, world.x - this.player.position.x);
      if (this.pendingCompanionCommand) {
        this.applyPendingCompanionCommand(world);
        return;
      }
      if (!this.commandPanel?.isOpen()) this.tryPlayerAttack();
    });
    keyboard.on("keydown",()=>this.audio.unlockAndStartBgm());
  }

  private createUi(): void {
    const parent = document.querySelector<HTMLElement>("#app");
    if (!parent) throw new Error("Game root missing");
    this.uiRoot = document.createElement("div");
    this.uiRoot.className = "game-ui-root";
    parent.append(this.uiRoot);
    this.hud = new Hud(this.uiRoot);
    this.dayAnnouncement = new DayAnnouncement(this.uiRoot);
    this.minimap = new MinimapPanel(this.uiRoot, this.map, this.fog);
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
      onDeveloperModeChange: (enabled) => this.setDeveloperMode(enabled),
      onGrantCompendiumEntry: (entry) => this.grantCompendium(entry),
      getCompendiumState: () => ({ developerMode: this.settings.developerMode, count: (entry) => entry.kind === "weapon" ? Number(this.player.unlockedWeapons.has(entry.sourceId as WeaponId)) : this.inventory.count(entry.sourceId) }),
      onUiSound:()=>this.audio.play("ui"),
    });
    this.pauseMenu.setDeveloperMode(this.settings.developerMode);
  }

  private handlePanelKeys(): void {
    if (this.minimap.isVisible()) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.pause)) {
        this.minimap.hide();
        return;
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.map)) {
        this.minimap.cycleMode();
        return;
      }
      if (this.minimap.isFull()) return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.inventory) && !this.pauseMenu.isOpen()) {
      if (this.inventoryPanel.isOpen()) this.inventoryPanel.hide();
      else {
        this.minimap.hide();
        this.commandPanel.hide();
        this.pendingCompanionCommand = undefined;
        this.inventoryPanel.show(this.getInventoryPanelState());
      }
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.pause)) {
      if (this.inventoryPanel.isOpen()) return;
      this.audio.play("ui");
      this.commandPanel.hide();
      this.pendingCompanionCommand = undefined;
      if (this.pauseMenu.isOpen()) this.pauseMenu.handleEscape();
      else this.pauseMenu.toggle();
    }
    if (this.inventoryPanel.isOpen() || this.pauseMenu.isOpen()) return;
    if (Phaser.Input.Keyboard.JustDown(this.keys.map)) this.minimap.setMode("local");
    if (Phaser.Input.Keyboard.JustDown(this.keys.command)) {
      if (this.rescuedCompanions.length === 0) this.hud.showMessage("먼저 생존자를 구조해야 합니다.");
      else {
        this.pendingCompanionCommand = undefined;
        this.commandPanel.toggle();
      }
    }
  }

  private updatePlayer(deltaSeconds: number): void {
    this.player.aimAngle = Math.atan2(
      this.pointerWorldSnapshot.y - this.player.position.y,
      this.pointerWorldSnapshot.x - this.player.position.x,
    );

    if (this.player.reloadingUntil > 0 && this.simulationTime >= this.player.reloadingUntil) this.finishReload();
    if (Phaser.Input.Keyboard.JustDown(this.keys.reload)) this.startReload();
    if (this.input.activePointer.isDown && this.pointerInsideGame && WEAPON_DEFINITIONS[this.player.equippedWeapon].fireMode === "auto") this.tryPlayerAttack();
    if (Phaser.Input.Keyboard.JustDown(this.keys.flashlight)) this.toggleFlashlight();
    if (Phaser.Input.Keyboard.JustDown(this.keys.interact)) {
      const target = this.interactionSystem.refreshNow(this.getInteractionContext());
      target?.interaction?.execute();
    }
    const quickKeys = [this.keys.quick1, this.keys.quick2, this.keys.quick3, this.keys.quick4, this.keys.quick5];
    quickKeys.forEach((key, index) => {
      if (Phaser.Input.Keyboard.JustDown(key)) this.useQuickslot(index);
    });

    let moveX = Number(this.keys.right.isDown) - Number(this.keys.left.isDown);
    let moveY = Number(this.keys.down.isDown) - Number(this.keys.up.isDown);
    const length = Math.hypot(moveX, moveY);
    if (length > 0) { moveX /= length; moveY /= length; }
    const wantsToRun = this.keys.run.isDown && length > 0;
    const runningRequested = wantsToRun && canRun(this.player.survivalNeeds, this.player.survivalRuntime);
    let speed = runningRequested ? BALANCE.playerRunSpeed * getRunSpeedMultiplier(this.player.survivalNeeds) : BALANCE.playerWalkSpeed;
    speed *= this.infection.getMovementMultiplier(this.player.vitals.infection);
    if (this.simulationTime - this.player.lastAttackAt < 170) speed *= 0.62;
    const previousX = this.player.position.x;
    const previousY = this.player.position.y;
    const next = this.collision.moveCircle(this.player.position, moveX * speed * deltaSeconds, moveY * speed * deltaSeconds, BALANCE.playerRadius);
    this.player.position = next;
    const movedX = next.x - previousX;
    const movedY = next.y - previousY;
    const movedDistance = Math.hypot(movedX, movedY);
    const actuallyMoved = movedDistance > 0.01;
    const actualRunning = runningRequested && actuallyMoved;
    this.player.movement = actuallyMoved ? { x: movedX / movedDistance, y: movedY / movedDistance } : { x: 0, y: 0 };

    const survival = updateSurvivalNeeds(this.player.survivalNeeds, this.player.survivalRuntime, {
      deltaSeconds,
      nowMs: this.simulationTime,
      actualRunning,
      lastAttackAt: this.player.lastAttackAt,
    });
    this.player.survivalNeeds = survival.needs;
    if (survival.damage > 0) {
      this.player.vitals = this.infection.clamp({ ...this.player.vitals, health: this.player.vitals.health - survival.damage });
      this.player.view.flashHit(this.simulationTime);
      this.audio.play("player-hurt", { volumeScale: 0.65 });
      this.cameraFeedback.request("player-hit", this.simulationTime, survival.damage);
    }

    const footstep = getFootstepEvent(actuallyMoved, actualRunning, this.simulationTime, this.nextFootstepAt);
    if (footstep) {
      this.noise.emit({ x: next.x, y: next.y, intensity: NOISE_LEVELS[footstep.category], category: footstep.category, createdAt: this.simulationTime });
      this.audio.play(footstep.cue);
      const terrain = getTerrain(this.map, Math.floor(next.x / TILE_SIZE), Math.floor(next.y / TILE_SIZE));
      const dustTerrain = terrain === TerrainType.Ground ? "ground" : terrain === TerrainType.Road ? "road" : terrain === TerrainType.Sidewalk ? "sidewalk" : "floor";
      this.effects.emitFootstepDust(next.x, next.y, Math.atan2(movedY, movedX), actualRunning, dustTerrain, ++this.ambientEffectSequence, this.simulationTime);
      this.nextFootstepAt = footstep.nextAt;
    }
    if (shouldConsumeFlashlightCharge(this.player.flashlightOn, this.player.flashlightCharge, this.clock)) {
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
    if (weapon.kind === "ranged" && isFirearmId(weapon.id)) this.noise.emitGunshot(weapon.id, this.player.position.x, this.player.position.y, weapon.noise, this.simulationTime);
    else this.noise.emit({ x: this.player.position.x, y: this.player.position.y, intensity: weapon.noise, category: "melee", createdAt: this.simulationTime });
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
        this.damageZombie(zombie, weapon.damage, { x: direction.x * weapon.knockback, y: direction.y * weapon.knockback },{kind:"melee",hitX:zombie.position.x,hitY:zombie.position.y,directionX:direction.x,directionY:direction.y,weaponId:weapon.id,sequence:++this.ambientEffectSequence});
      });
      this.audio.play(impacts.length>0?"melee-hit":"melee-swing");
    } else {
      const pelletAngles = createPelletAngles(this.player.aimAngle, weapon, () => this.rng.next());
      const bloodByZombie=new Map<string,DamageImpactContext[]>();
      for (const pelletAngle of pelletAngles) {
        const rawEnd = { x: this.player.position.x + Math.cos(pelletAngle) * weapon.range, y: this.player.position.y + Math.sin(pelletAngle) * weapon.range };
        const wallHit = this.collision.firstProjectileCollision(this.player.position, rawEnd);
        const end = wallHit ?? rawEnd;
        const hit = firstTargetOnLine(this.player.position, end, this.zombies.map((zombie) => ({ id: zombie.id, position: zombie.position, alive: zombie.isAlive() })), 8);
        const zombie = hit ? this.zombies.find((candidate) => candidate.id === hit.target.id) : undefined;
        const tracerEnd = zombie?.position ?? end;
        endpointX = tracerEnd.x; endpointY = tracerEnd.y;
        if (zombie) {
          impacts.push({ x: zombie.position.x, y: zombie.position.y, kind: "zombie" });
          const direction = normalize({ x: Math.cos(pelletAngle), y: Math.sin(pelletAngle) });
          const rawKnockback = weapon.id === "shotgun" ? { x: 0, y: 0 } : { x: direction.x * weapon.knockback, y: direction.y * weapon.knockback };
          const killed=this.damageZombie(zombie, weapon.damage, rawKnockback);
          const contexts=bloodByZombie.get(zombie.id)??[];contexts.push({kind:"projectile",damage:weapon.damage,hitX:zombie.position.x,hitY:zombie.position.y,directionX:direction.x,directionY:direction.y,weaponId:weapon.id,sequence:++this.ambientEffectSequence,killed});bloodByZombie.set(zombie.id,contexts);
        } else if (wallHit) { impacts.push({ x: wallHit.x, y: wallHit.y, kind: "wall" }); }
      }
      this.attackEffects.play({ weapon: weapon.id, originX: this.player.position.x, originY: this.player.position.y, angle: this.player.aimAngle, startedAt: this.simulationTime, endpointX, endpointY, impacts, alwaysShowCore: true });
      for(const [zombieId,contexts] of bloodByZombie){const context=aggregateProjectileDamage(contexts);if(!context)continue;this.effects.emitDirectionalBlood(context,this.simulationTime);if(weapon.id==="shotgun"){const zombie=this.zombies.find((candidate)=>candidate.id===zombieId);if(zombie?.isAlive()){const direction=normalize({x:context.directionX,y:context.directionY});const magnitude=Math.min(weapon.knockback*1.6,weapon.knockback*Math.sqrt(contexts.length));this.applyZombieKnockback(zombie,{x:direction.x*magnitude,y:direction.y*magnitude},context.damage,"ranged");}}}
      if(isFirearmId(weapon.id))playFirearmShotForEvent(this.audio,weapon.id,this.attackEffects.lastSequence,{source:this.player.position,listener:this.player.position});
    }
    this.player.beginAttack(this.simulationTime);
    const feedbackEvent:CameraFeedbackEvent=weapon.kind==="melee"?(impacts.length>0?"melee-hit":"melee-swing"):weapon.id==="smg"?"smg-shot":weapon.id==="shotgun"?"shotgun-shot":weapon.id==="hunting_rifle"?"rifle-shot":"pistol-shot";
    this.cameraFeedback.request(feedbackEvent,this.simulationTime);
    if (weapon.kind === "melee") this.attackEffects.play({
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

  private damageZombie(zombie: Zombie, damage: number, knockback: Point, impact?:Omit<DamageImpactContext,"damage"|"killed">): boolean {
    const kind: ZombieKnockbackKind = impact?.kind === "melee" ? "melee" : "ranged";
    const killed = zombie.damage(damage, getFinalZombieKnockback(knockback, damage, kind), this.simulationTime);
    if(impact)this.effects.emitDirectionalBlood({...impact,damage,killed},this.simulationTime);
    this.audio.play(killed?"zombie-death":"zombie-hit",{source:zombie.position,listener:this.player.position});
    if (killed && this.rng.chance(0.28)) {
      const itemId = this.rng.chance(0.45) ? "pistol_ammo" : "cloth";
      this.spawnDrop(itemId, 1, zombie.position.x, zombie.position.y);
    }
    return killed;
  }

  private applyZombieKnockback(zombie: Zombie, knockback: Point, damage: number, kind: ZombieKnockbackKind): void {
    if (!zombie.isAlive()) return;
    zombie.applyKnockback(getFinalZombieKnockback(knockback, damage, kind));
  }

  private updateZombieAudio():void{
    if(this.simulationTime<this.nextZombieGrowlAt)return;
    this.nextZombieGrowlAt=this.simulationTime+5_500;
    let closest:Zombie|undefined;let closestSquared=Infinity;
    for(const zombie of this.zombies){if(!zombie.isAlive()||this.isZombieDormant(zombie))continue;const dx=zombie.position.x-this.player.position.x,dy=zombie.position.y-this.player.position.y;const candidate=dx*dx+dy*dy;if(candidate<closestSquared){closest=zombie;closestSquared=candidate;}}
    if(closest)this.audio.play("zombie-growl",{source:closest.position,listener:this.player.position});
  }

  private startReload(): void {
    if (!isFirearmId(this.player.equippedWeapon) || this.player.reloadingUntil > 0) return;
    const weapon = WEAPON_DEFINITIONS[this.player.equippedWeapon];
    const ammoItemId = weapon.ammoItemId!;
    if (this.player.magazine >= (weapon.magazineSize ?? 0) || this.inventory.count(ammoItemId) <= 0) {
      this.hud.showMessage(this.inventory.count(ammoItemId) <= 0 ? "예비 탄약이 없습니다." : "탄창이 이미 가득 찼습니다.");
      return;
    }
    this.player.reloadingUntil = this.simulationTime + (weapon.reloadMs ?? 1_000);
    this.audio.play("reload");
    this.hud.showMessage("재장전 중…", 1_100);
  }

  private finishReload(): void {
    if (!isFirearmId(this.player.equippedWeapon)) { this.player.reloadingUntil = 0; return; }
    const weapon = WEAPON_DEFINITIONS[this.player.equippedWeapon];
    const ammoItemId = weapon.ammoItemId!;
    const capacity = (weapon.magazineSize ?? 0) - this.player.magazine;
    const amount = Math.min(capacity, this.inventory.count(ammoItemId));
    this.inventory.remove(ammoItemId, amount);
    this.player.magazine += amount;
    this.player.reloadingUntil = 0;
  }

  private toggleFlashlight(): void {
    if (this.player.flashlightCharge <= 0) {
      this.hud.showMessage("손전등 배터리가 없습니다.");
      return;
    }
    this.player.flashlightOn = !this.player.flashlightOn;
  }

  private createZombies(saved: SaveGame | null): void {
    if (saved) {
      saved.consumedZombieSpawnIds.forEach((id) => this.consumedZombieSpawnIds.add(id));
      this.zombies = saved.zombies.map((state) => {
        const zombie = new Zombie(this, state.id, state.kind, state, state.state);
        const healthRatio = state.maxHealth && state.maxHealth > 0 ? state.health / state.maxHealth : undefined;
        zombie.health = Math.max(0, Math.min(zombie.definition.health, healthRatio === undefined ? state.health : zombie.definition.health * healthRatio));
        zombie.mind.visualLock = state.visualLock ?? false;
        zombie.mind.currentTargetId = state.currentTargetId;
        zombie.mind.lastSeenAt = state.lastSeenAt ?? 0;
        return zombie;
      });
    } else {
      this.zombies = [];
      this.activateDormantZombieSpawns(40, ZOMBIE_ACTIVATION_RADIUS);
    }
    this.activeZombieCount = 0;
    for (const zombie of this.zombies) if (zombie.isAlive()) this.activeZombieCount += 1;
  }

  private updateZombies(time: number, deltaSeconds: number): void {
    const targets = this.getZombieTargets();
    this.activeZombieCount = 0;
    this.minimapZombieSources.length = 0;
    this.zombies.forEach((zombie, index) => {
      if (!zombie.isAlive()) {
        zombie.updateView(time, this.fog.getStateAtWorld(zombie.position.x, zombie.position.y) === VisibilityState.Visible);
        return;
      }
      if (this.isZombieDormant(zombie) && !zombie.mind.visualLock) {
        zombie.view.setVisible(false);
        return;
      }
      if (this.minimapZombieSources.length < BALANCE.maxActiveZombies) this.minimapZombieSources.push(zombie);
      this.activeZombieCount += 1;
      if (zombie.mind.state === "Stagger" && this.simulationTime >= zombie.staggerUntil) {
        zombie.mind = { ...zombie.mind, state: "Chase" };
      }
      if (zombie.mind.state === "AttackObstacle" && this.updateZombieObstacleAttack(zombie)) {
        zombie.updateView(time, this.fog.getStateAtWorld(zombie.position.x, zombie.position.y) === VisibilityState.Visible);
        return;
      }
      let perceivedTarget = targets.find((target) => target.id === zombie.mind.currentTargetId);
      if (this.simulationTime >= zombie.nextThinkAt && zombie.mind.state !== "Stagger") {
        const farFromPlayer = distance(zombie.position, this.player.position) > 360;
        zombie.nextThinkAt = this.simulationTime + 220 + (index % 5) * 47 + (farFromPlayer ? 380 : 0);
        const lockedTarget = zombie.mind.visualLock ? targets.find((target) => target.id === zombie.mind.currentTargetId) : undefined;
        const sightTarget = this.findVisibleZombieTarget(zombie, targets);
        const heardNoise = sightTarget ? undefined : this.noise.loudestHeard(zombie.position.x, zombie.position.y, zombie.definition.hearingMultiplier, this.simulationTime);
        const previousState = zombie.mind.state;
        zombie.mind = updateZombieMind(zombie.mind, {
          canSeeTarget: Boolean(sightTarget),
          targetPosition: sightTarget?.position,
          targetId: sightTarget?.id,
          inAttackRange: sightTarget ? distance(zombie.position, sightTarget.position) <= 17 : lockedTarget ? distance(zombie.position, lockedTarget.position) <= 17 : false,
          heardNoise,
          nowMs: this.simulationTime,
          targetAlive: zombie.mind.visualLock ? lockedTarget?.alive ?? false : undefined,
          targetDistance: lockedTarget ? distance(zombie.position, lockedTarget.position) : undefined,
          ...(sightTarget ? {} : lockedTarget ? { targetPosition: lockedTarget.position, targetId: lockedTarget.id } : {}),
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
    this.zombieTargets.length = 0;
    this.zombieTargets.push({ id: this.player.id, position: this.player.position, alive: this.player.vitals.health > 0, kind: "player" });
    for (const companion of this.rescuedCompanions) this.zombieTargets.push({ id: companion.id, position: companion.position, alive: true, kind: "companion" });
    return this.zombieTargets;
  }

  private findVisibleZombieTarget(zombie: Zombie, targets: readonly AttackableTarget[]): AttackableTarget | undefined {
    let best: AttackableTarget | undefined;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const target of targets) {
      if (!target.alive) continue;
      let sight = zombie.definition.sightRadius * this.clock.getZombieActivityMultiplier();
      if (target.kind === "player" && this.player.torchRemaining > 0) sight *= 1.45;
      if (target.kind === "player" && this.player.flashlightOn && getVisionProfile(this.clock).flashlightFactor > 0) {
        const towardZombie = Math.atan2(zombie.position.y - this.player.position.y, zombie.position.x - this.player.position.x);
        if (Math.abs(angleDelta(towardZombie, this.player.aimAngle)) < Math.PI * 0.23) sight *= 1.28;
      }
      const targetDistance = distance(zombie.position, target.position);
      if (targetDistance > sight || targetDistance >= bestDistance || !this.collision.hasLineOfSight(zombie.position, target.position)) continue;
      if (target.id === zombie.mind.currentTargetId && zombie.mind.visualLock) return target;
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
      const nextPath = this.tryFindZombiePath(zombie.position, goal, 650);
      if (nextPath) {
        zombie.nextPathAt = zombie.mind.visualLock
          ? this.simulationTime + 600 + (zombieIndex % 4) * 45
          : this.simulationTime + 650 + (zombieIndex % 5) * 65 + (farFromPlayer ? 500 : 0);
        zombie.path = nextPath;
        zombie.pathIndex = 0;
      } else {
        zombie.nextPathAt = this.simulationTime + 80 + (zombieIndex % 4) * 20;
      }
    }
    const waypoint = zombie.path[zombie.pathIndex] ?? goal;
    if (distance(zombie.position, waypoint) < 7 && zombie.pathIndex < zombie.path.length - 1) zombie.pathIndex += 1;
    const currentTarget = zombie.path[zombie.pathIndex] ?? goal;
    const obstacle = this.destructibles.getBlockingAtTile(
      Math.floor(currentTarget.x / TILE_SIZE),
      Math.floor(currentTarget.y / TILE_SIZE),
    );
    if (obstacle) {
      const obstaclePosition = { x: tileCenter(obstacle.tileX), y: tileCenter(obstacle.tileY) };
      zombie.aimAngle = Math.atan2(obstaclePosition.y - zombie.position.y, obstaclePosition.x - zombie.position.x);
      if (distance(zombie.position, obstaclePosition) <= OBSTACLE_BALANCE.attackRange) {
        zombie.obstacleTargetId = obstacle.id;
        zombie.mind = { ...zombie.mind, state: "AttackObstacle" };
        this.updateZombieObstacleAttack(zombie);
        return;
      }
    }
    const direction = normalize({ x: currentTarget.x - zombie.position.x, y: currentTarget.y - zombie.position.y });
    const chaseMultiplier = zombie.mind.state === "Chase" || zombie.mind.visualLock ? ZOMBIE_CHASE_MULTIPLIER[zombie.kind] : 1;
    const speed = zombie.definition.speed * chaseMultiplier * this.clock.getZombieActivityMultiplier();
    zombie.position = this.collision.moveCircle(zombie.position, direction.x * speed * deltaSeconds, direction.y * speed * deltaSeconds, BALANCE.zombieRadius);
    zombie.aimAngle = Math.atan2(direction.y, direction.x);
    if (distance(zombie.position, goal) < 10 && (zombie.mind.state === "InvestigateNoise" || zombie.mind.state === "SearchLastKnownPosition")) {
      zombie.mind = updateZombieMind(zombie.mind, { canSeeTarget: false, reachedDestination: true, nowMs: this.simulationTime });
      zombie.path = [];
    }
  }

  private tryFindPath(start: Point, goal: Point, maxVisited: number): Point[] | undefined {
    if (this.pathfindingWorkThisFrame >= MAX_PATHFINDING_PER_FRAME) return undefined;
    this.pathfindingWorkThisFrame += 1;
    this.performanceMonitor.recordPathfinding();
    return findTilePath(
      start,
      goal,
      (x, y) => this.collision.isTileBlocked(x, y),
      maxVisited,
      this.map.widthTiles,
      this.map.heightTiles,
      (fromX, fromY, toX, toY) => this.collision.canTraverseTileEdge(fromX, fromY, toX, toY, BALANCE.companionRadius),
    );
  }

  private tryFindZombiePath(start: Point, goal: Point, maxVisited: number): Point[] | undefined {
    if (this.pathfindingWorkThisFrame >= MAX_PATHFINDING_PER_FRAME) return undefined;
    this.pathfindingWorkThisFrame += 1;
    this.performanceMonitor.recordPathfinding();
    return findWeightedTilePath(
      start,
      goal,
      (x, y) => this.collision.getZombieTraversalCost(x, y),
      maxVisited,
      this.map.widthTiles,
      this.map.heightTiles,
      (fromX, fromY, toX, toY) => this.collision.canTraverseTileEdge(fromX, fromY, toX, toY, BALANCE.zombieRadius, true),
    );
  }

  private updateZombieObstacleAttack(zombie: Zombie): boolean {
    const id = zombie.obstacleTargetId;
    const obstacle = id ? this.destructibles.get(id) : undefined;
    if (!obstacle || obstacle.destroyed
      || this.destructibles.getBlockingAtTile(obstacle.tileX, obstacle.tileY)?.id !== obstacle.id) {
      this.cancelZombieObstacleTarget(zombie);
      return false;
    }
    const position = { x: tileCenter(obstacle.tileX), y: tileCenter(obstacle.tileY) };
    const targetDistance = distance(zombie.position, position);
    if (targetDistance > OBSTACLE_BALANCE.attackRange + 1) {
      this.cancelZombieObstacleTarget(zombie);
      return false;
    }
    zombie.aimAngle = Math.atan2(position.y - zombie.position.y, position.x - zombie.position.x);
    if (this.simulationTime < zombie.nextObstacleAttackAt) return true;
    const windup = Math.max(220, Math.round(zombie.definition.biteWindupMs * 0.75));
    if (zombie.obstacleAttackCompletesAt === 0) zombie.obstacleAttackCompletesAt = this.simulationTime + windup;
    const progress = 1 - (zombie.obstacleAttackCompletesAt - this.simulationTime) / windup;
    this.telegraphGraphics.lineStyle(1, 0xb98a5b, 0.9).strokeCircle(position.x, position.y, 8 + Math.max(0, progress) * 4);
    if (this.simulationTime < zombie.obstacleAttackCompletesAt) return true;
    const damage = getZombieStructureDamage(zombie.definition.damage);
    this.damageDestructible(obstacle.id, damage, zombie.aimAngle);
    zombie.obstacleAttackCompletesAt = 0;
    zombie.nextObstacleAttackAt = this.simulationTime + zombie.definition.attackCooldownMs;
    if (!this.destructibles.get(obstacle.id) || this.destructibles.get(obstacle.id)?.destroyed) {
      this.cancelZombieObstacleTarget(zombie);
      return false;
    }
    return true;
  }

  private damageDestructible(id: string, amount: number, angle: number): void {
    const result = this.destructibles.damage(id, amount);
    if (!result?.damaged) return;
    const state = result.state;
    const x = tileCenter(state.tileX);
    const y = tileCenter(state.tileY);
    this.effects.emitObstacleImpact(x, y, angle, ++this.ambientEffectSequence, this.simulationTime, result.destroyedNow);
    if (state.kind === "door") {
      const door = this.map.doors.find((candidate) => candidate.id === state.id);
      const view = this.mapViews.doorViews.get(state.id);
      view?.setHealth(state.health, state.maxHealth, this.simulationTime);
      if (result.destroyedNow && door) {
        this.collision.setDoorDestroyed(state.id);
        if (view) updateDoorView(view, true, door.orientation, true);
        this.worldObjects.setInteractable(state.id, false);
        view?.setOutlineState("normal");
        this.minimap.markWorldTileDirty(state.tileX, state.tileY);
      }
    } else {
      const view = this.barricadeViews.get(state.id);
      view?.setHealth(state.health, state.maxHealth, this.simulationTime);
      if (result.destroyedNow) {
        this.collision.removeDynamicObstacle(state.id);
        this.destructibles.removeBarricade(state.id);
        this.worldObjects.unregister(state.id);
        view?.destroy();
        this.barricadeViews.delete(state.id);
        this.minimap.markBarricadeTile(state.tileX, state.tileY, false);
      }
    }
    if (result.destroyedNow) {
      this.cancelZombieObstacleTargets(state.id);
      this.fogInvalidation.invalidate();
      this.interactionSystem.invalidate();
    }
  }

  private cancelZombieObstacleTarget(zombie: Zombie): void {
    zombie.obstacleTargetId = undefined;
    zombie.obstacleAttackCompletesAt = 0;
    zombie.mind = { ...zombie.mind, state: "Chase" };
    zombie.path = [];
    zombie.pathIndex = 0;
    zombie.nextPathAt = Math.min(zombie.nextPathAt, this.simulationTime);
  }

  private cancelZombieObstacleTargets(id: string): void {
    for (const zombie of this.zombies) if (zombie.obstacleTargetId === id) this.cancelZombieObstacleTarget(zombie);
  }

  private updateObstacleViews(): void {
    this.targetedObstacleIds.clear();
    for (const zombie of this.zombies) {
      if (zombie.isAlive() && zombie.obstacleTargetId) this.targetedObstacleIds.add(zombie.obstacleTargetId);
    }
    for (const door of this.map.doors) this.mapViews.doorViews.get(door.id)?.updateStatus(this.simulationTime, this.targetedObstacleIds.has(door.id));
    for (const [id, view] of this.barricadeViews) view.updateStatus(this.simulationTime, this.targetedObstacleIds.has(id));
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
      const previousHealth=this.player.vitals.health;
      this.player.vitals = this.infection.applyAttack(
        this.player.vitals,
        isBite ? "bite" : "scratch",
        zombie.definition.damage + (isBite ? 4 : 0),
        isBite ? zombie.definition.infectionBite : zombie.definition.infectionScratch,
      );
      this.player.invulnerableUntil = this.simulationTime + 350;
      this.player.view.flashHit(this.simulationTime);
      this.audio.play("player-hurt");
      this.cameraFeedback.request("player-hit",this.simulationTime,previousHealth-this.player.vitals.health);
    } else if (target.kind === "companion") {
      const companion = this.companionsById.get(target.id);
      const died = companion?.damage(zombie.definition.damage + (isBite ? 3 : 0), this.simulationTime) ?? false;
      if (died && companion) {
        this.refreshRescuedCompanions();
        this.fogInvalidation.invalidate();
        this.worldObjects.setInteractable(companion.id, false);
        this.hud.showMessage(`${companion.id} 동료가 쓰러졌습니다.`, 3_500);
      }
    }
    zombie.biteCompletesAt = 0;
    zombie.nextAttackAt = this.simulationTime + zombie.definition.attackCooldownMs;
  }

  private applyZombieSeparation(): number {
    for (const bucketIndex of this.separationUsedBuckets) this.separationBuckets[bucketIndex]!.length = 0;
    this.separationUsedBuckets.length = 0;

    for (let index = 0; index < this.zombies.length; index += 1) {
      const zombie = this.zombies[index];
      if (!zombie?.isAlive() || this.isZombieDormant(zombie)) continue;
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
      if (!first?.isAlive() || this.isZombieDormant(first)) continue;
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

  private refreshTeamVisibleZombies(): void {
    if (this.simulationTime < this.nextTeamTargetScanAt) return;
    this.nextTeamTargetScanAt = this.simulationTime + 100;
    this.teamVisibleZombies.length = 0;
    for (const zombie of this.zombies) {
      if (!zombie.isAlive() || this.isZombieDormant(zombie)) continue;
      if (this.fog.getStateAtWorld(zombie.position.x, zombie.position.y) === VisibilityState.Visible) this.teamVisibleZombies.push(zombie);
    }
  }

  private updateCompanions(time: number, deltaSeconds: number): void {
    this.formation = updateFormationDirection(this.formation, this.player.movement, deltaSeconds * 1_000);
    for (const companion of this.companions) {
      this.companion = companion;
      this.updateSingleCompanion(time, deltaSeconds);
    }
  }

  private updateSingleCompanion(time: number, deltaSeconds: number): void {
    if (!this.companion.alive) {
      this.companion.updateView(time, this.fog.getStateAtWorld(this.companion.position.x, this.companion.position.y) === VisibilityState.Visible, false);
      return;
    }
    if (!this.companion.rescued) {
      this.companion.updateView(time, this.fog.getStateAtWorld(this.companion.position.x, this.companion.position.y) === VisibilityState.Visible, false);
      return;
    }
    const distanceToPlayer = distance(this.companion.position, this.player.position);
    this.companion.navigation.catchUpMode = updateCatchUpMode(
      this.companion.navigation.catchUpMode,
      distanceToPlayer,
      this.companion.command,
    );

    const companionWeapon = WEAPON_DEFINITIONS.pistol;
    let explicitFocus = this.companion.command === "focus" && Boolean(this.companion.focusTargetId);
    let focusTarget = explicitFocus
      ? this.zombies.find((zombie) => zombie.id === this.companion.focusTargetId && zombie.isAlive())
      : undefined;
    if (focusTarget && this.teamVisibleZombies.includes(focusTarget)) this.companion.combatTargetLastVisibleAt = this.simulationTime;
    if (focusTarget && this.simulationTime - this.companion.combatTargetLastVisibleAt > 1_500) focusTarget = undefined;
    if (explicitFocus && !focusTarget) {
      this.companion.command = "follow";
      this.companion.focusTargetId = undefined;
      this.companion.combatTargetId = undefined;
      this.companion.navigation.catchUpMode = updateCatchUpMode(false, distanceToPlayer, "follow");
      explicitFocus = false;
    }
    const automaticTargetDistance = this.companion.navigation.catchUpMode || this.companion.command === "move"
      ? COMPANION_MOVEMENT.immediateThreatDistance
      : companionWeapon.range;
    let combatTarget = selectCompanionCombatTarget(
      this.teamVisibleZombies,
      this.companion.position,
      this.companion.combatTargetId,
      focusTarget,
      automaticTargetDistance,
    );
    if (combatTarget && this.teamVisibleZombies.includes(combatTarget)) {
      this.companion.combatTargetId = combatTarget.id;
      this.companion.combatTargetLastVisibleAt = this.simulationTime;
    } else if (!combatTarget && this.companion.combatTargetId
      && this.simulationTime - this.companion.combatTargetLastVisibleAt <= 900) {
      combatTarget = this.zombies.find((zombie) => zombie.id === this.companion.combatTargetId && zombie.isAlive());
    }
    if (!combatTarget) this.companion.combatTargetId = undefined;

    const combatDistance = combatTarget ? distance(this.companion.position, combatTarget.position) : Number.POSITIVE_INFINITY;
    const combatHasLineOfSight = Boolean(combatTarget && this.collision.hasLineOfSight(this.companion.position, combatTarget.position));
    if (combatTarget && combatHasLineOfSight && combatDistance <= companionWeapon.range) {
      this.companion.aimAngle = Math.atan2(combatTarget.position.y - this.companion.position.y, combatTarget.position.x - this.companion.position.x);
      if (this.simulationTime >= this.companion.nextAttackAt) {
        this.companion.nextAttackAt = this.simulationTime + companionWeapon.cooldownMs;
        const direction = normalize({ x: combatTarget.position.x - this.companion.position.x, y: combatTarget.position.y - this.companion.position.y });
        const impactX = combatTarget.position.x;
        const impactY = combatTarget.position.y;
        this.damageZombie(combatTarget, companionWeapon.damage, { x: direction.x * companionWeapon.knockback, y: direction.y * companionWeapon.knockback },{kind:"projectile",hitX:combatTarget.position.x,hitY:combatTarget.position.y,directionX:direction.x,directionY:direction.y,weaponId:"pistol",sequence:++this.ambientEffectSequence});
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
        this.audio.play("remote-shot",{source:this.companion.position,listener:this.player.position});
        this.noise.emitGunshot("pistol", this.companion.position.x, this.companion.position.y, companionWeapon.noise, this.simulationTime);
      }
    }

    let requestedGoal: Point | undefined;
    if (this.companion.command === "follow") {
      const formationDistance = this.companion.navigation.catchUpMode ? 20 : 28;
      requestedGoal = getFormationSlot(this.player.position, this.formation, formationDistance, this.companion.formationSlotIndex);
      if (distanceToPlayer >= COMPANION_MOVEMENT.emergencyDistance) requestedGoal = this.player.position;
    }
    if (this.companion.command === "move") requestedGoal = this.companion.commandTarget;
    if (this.companion.command === "focus" && combatTarget) requestedGoal = combatTarget.position;
    if (this.companion.command === "hold") requestedGoal = this.companion.commandTarget;
    if (combatTarget && this.companion.health > 24) {
      const shouldChase = shouldOverrideCompanionGoalForCombat(
        this.companion.command,
        explicitFocus,
        this.companion.navigation.catchUpMode,
        combatDistance,
      );
      const combatMovement = !combatHasLineOfSight && shouldChase
        ? "approach"
        : getCompanionCombatMovement(companionWeapon, combatDistance, this.companion.command, shouldChase);
      if (combatMovement === "approach") {
        requestedGoal = combatTarget.position;
      } else if (combatMovement === "retreat") {
        const deltaX = this.companion.position.x - combatTarget.position.x;
        const deltaY = this.companion.position.y - combatTarget.position.y;
        const length = Math.hypot(deltaX, deltaY) || 1;
        this.companion.combatGoalScratch.x = this.companion.position.x + deltaX / length * 36;
        this.companion.combatGoalScratch.y = this.companion.position.y + deltaY / length * 36;
        requestedGoal = this.companion.combatGoalScratch;
      } else if (this.companion.command === "focus"
        || (this.companion.command === "follow" && distanceToPlayer <= COMPANION_MOVEMENT.catchUpExitDistance)) {
        requestedGoal = undefined;
      }
    }

    const stuckDuration = getCompanionStuckDuration(this.companion.navigation, this.simulationTime);
    const searchRadius = stuckDuration >= COMPANION_MOVEMENT.severeStuckThresholdMs
      || distanceToPlayer >= COMPANION_MOVEMENT.emergencyDistance ? 4 : 2;
    const goal = requestedGoal
      ? findNearestWalkableGoal(
        requestedGoal,
        (x, y) => this.collision.canOccupyCircle(x, y, BALANCE.companionRadius),
        searchRadius,
        this.companion.goalScratch,
      ) ?? undefined
      : undefined;

    let moving = false;
    if (goal && distance(this.companion.position, goal) > 10 && !(this.companion.command === "hold" && combatTarget)) {
      const goalTile = getWorldTileIndex(goal);
      if (goalTile !== this.companion.navigation.lastGoalTile) {
        this.companion.navigation.lastGoalTile = goalTile;
        this.companion.path = [];
        this.companion.pathIndex = 0;
        this.companion.nextPathAt = Math.min(this.companion.nextPathAt, this.simulationTime + this.companion.formationSlotIndex * 18);
      }
      const currentWaypoint = this.companion.path[this.companion.pathIndex];
      if (currentWaypoint && !this.collision.canOccupyCircle(currentWaypoint.x, currentWaypoint.y, BALANCE.companionRadius)) {
        this.companion.path = [];
        this.companion.pathIndex = 0;
        this.companion.nextPathAt = this.simulationTime;
      }

      if (this.simulationTime >= this.companion.nextPathAt) {
        const nextPath = this.tryFindPath(this.companion.position, goal, 700);
        if (nextPath !== undefined) {
          const repathDelay = stuckDuration > 0 ? 120 : this.companion.navigation.catchUpMode ? 280 : 500;
          this.companion.nextPathAt = this.simulationTime + repathDelay;
          this.companion.path = nextPath;
          this.companion.pathIndex = 0;
          markCompanionRepath(this.companion.navigation);
        }
      }

      while (this.companion.pathIndex < this.companion.path.length - 1) {
        const waypoint = this.companion.path[this.companion.pathIndex];
        const nextWaypoint = this.companion.path[this.companion.pathIndex + 1];
        if (!waypoint || !nextWaypoint) break;
        if (distance(this.companion.position, waypoint) < 7
          || this.collision.canTraverseCircle(this.companion.position, nextWaypoint, BALANCE.companionRadius)) {
          this.companion.pathIndex += 1;
        } else break;
      }
      const finalWaypoint = this.companion.path[this.companion.path.length - 1];
      if (finalWaypoint && this.companion.pathIndex === this.companion.path.length - 1
        && distance(this.companion.position, finalWaypoint) < 7) {
        this.companion.path = [];
        this.companion.pathIndex = 0;
      }

      const target = this.companion.path[this.companion.pathIndex] ?? goal;
      const hasSafeTarget = this.companion.path.length > 0
        || this.collision.canTraverseCircle(this.companion.position, target, BALANCE.companionRadius);
      if (hasSafeTarget) {
        const followSpeed = this.companion.command === "follow"
          ? getCompanionFollowSpeed(distanceToPlayer)
          : COMPANION_MOVEMENT.baseSpeed;
        const targetDistance = distance(this.companion.position, target);
        const arrivalScale = Math.max(0.35, Math.min(1, targetDistance / 18));
        const stepDistance = Math.min(followSpeed * arrivalScale * deltaSeconds, 7);
        const direction = chooseLocalSteering(
          this.companion.position,
          target,
          stepDistance,
          (x, y) => this.collision.canOccupyCircle(x, y, BALANCE.companionRadius),
          this.companion.steeringScratch,
        );
        if (direction) {
          const previousX = this.companion.position.x;
          const previousY = this.companion.position.y;
          this.companion.position = this.collision.moveCircle(
            this.companion.position,
            direction.x * stepDistance,
            direction.y * stepDistance,
            BALANCE.companionRadius,
          );
          moving = Math.hypot(this.companion.position.x - previousX, this.companion.position.y - previousY) >= 0.05;
          if (!moving) {
            markCompanionBlocked(this.companion.navigation);
            this.companion.nextPathAt = Math.min(this.companion.nextPathAt, this.simulationTime + 60);
          }
          if (!combatTarget) this.companion.aimAngle = Math.atan2(direction.y, direction.x);
        } else {
          markCompanionBlocked(this.companion.navigation);
          this.companion.nextPathAt = Math.min(this.companion.nextPathAt, this.simulationTime + 60);
        }
      }

      if (updateCompanionStuckState(this.companion.navigation, this.companion.position, this.simulationTime, true)) {
        this.companion.path = [];
        this.companion.pathIndex = 0;
        this.companion.nextPathAt = Math.min(this.companion.nextPathAt, this.simulationTime + 80);
      }
      if (this.companion.command === "move" && distance(this.companion.position, goal) < 12) {
        this.companion.command = "hold";
        this.companion.commandTarget = { ...this.companion.position };
      }
    } else {
      updateCompanionStuckState(this.companion.navigation, this.companion.position, this.simulationTime, false);
    }
    this.companion.updateView(time, this.fog.getStateAtWorld(this.companion.position.x, this.companion.position.y) === VisibilityState.Visible, moving);
  }

  private chooseCompanionCommand(command: CompanionCommand): void {
    if (command === "follow") {
      for (const companion of this.rescuedCompanions) {
        companion.command = "follow";
        companion.focusTargetId = undefined;
        companion.commandTarget = undefined;
      }
      this.commandPanel.hide();
      this.hud.showMessage("동료 전체: 따라오겠습니다.");
      return;
    }
    if (command === "hold") {
      for (const companion of this.rescuedCompanions) {
        companion.command = "hold";
        companion.focusTargetId = undefined;
        companion.commandTarget = { ...companion.position };
      }
      this.commandPanel.hide();
      this.hud.showMessage("동료 전체: 각자 현재 위치를 지킵니다.");
      return;
    }
    this.pendingCompanionCommand = command;
    this.hud.showMessage(command === "move" ? "이동할 위치를 클릭하세요." : "집중 공격할 좀비를 클릭하세요.");
  }

  private applyPendingCompanionCommand(point: Point): void {
    if (this.pendingCompanionCommand === "move") {
      for (const companion of this.rescuedCompanions) {
        companion.command = "move";
        companion.commandTarget = getFormationSlot(point, this.formation, 28, companion.formationSlotIndex);
        companion.focusTargetId = undefined;
      }
      this.hud.showMessage("동료 전체: 지정 위치 대형으로 이동합니다.");
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
      for (const companion of this.rescuedCompanions) {
        companion.command = "focus";
        companion.focusTargetId = target.id;
        companion.combatTargetId = target.id;
        companion.combatTargetLastVisibleAt = this.simulationTime;
      }
      this.hud.showMessage("동료 전체: 저 적을 집중 공격합니다.");
    }
    this.pendingCompanionCommand = undefined;
    this.commandPanel.hide();
  }

  private updateInteractionPrompt(): void {
    const target = this.interactionSystem.update(this.simulationTime, this.getInteractionContext());
    this.hud.setPrompt(target?.interaction?.getPrompt());
  }

  private toggleDoor(door: DoorDefinition): void {
    if (door.destroyed) return;
    this.collision.setDoorOpen(door.id, !door.open);
    const view = this.mapViews.doorViews.get(door.id);
    if (view) updateDoorView(view, door.open, door.orientation, door.destroyed);
    this.noise.emit({ x: tileCenter(door.tileX), y: tileCenter(door.tileY), intensity: NOISE_LEVELS.door, category: "door", createdAt: this.simulationTime });
    this.audio.play("door",{source:{x:tileCenter(door.tileX),y:tileCenter(door.tileY)},listener:this.player.position});
    this.minimap.markWorldTileDirty(door.tileX, door.tileY);
    this.fogInvalidation.invalidate();
    this.interactionSystem.invalidate();
    if (door.open) this.cancelZombieObstacleTargets(door.id);
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
    this.worldObjects.setInteractable(container.id, false);
    this.interactionSystem.invalidate();
  }

  private updateAutoPickup(): void {
    if (this.simulationTime < this.nextAutoPickupAt) return;
    this.nextAutoPickupAt = this.simulationTime + AUTO_PICKUP_INTERVAL_MS;
    const result = this.autoPickup.collect(this.player.position, (from, to) => this.collision.hasLineOfSight(from, to), (itemId, quantity) => this.inventory.add(itemId, quantity));
    if (result.removedIds.length > 0) for (const id of result.removedIds) {
      const index = this.drops.findIndex((drop) => drop.id === id); if (index < 0) continue;
      const [drop] = this.drops.splice(index, 1); if (!drop) continue;
      this.worldObjects.unregister(id); drop.destroy(); if (id.startsWith("ground-")) this.searchedContainers.add(`ground:${id}`);
    }
    if (result.acquired.size > 0) {
      this.syncCollectedParts(); this.audio.play("pickup");
      const items=[...result.acquired].map(([id,amount])=>`${getItemDefinition(id).name} ${amount}`);
      this.hud.showMessage(`획득: ${items.slice(0,3).join(", ")}${items.length>3?` 외 ${items.length-3}종`:""}`); this.refreshInventoryPanel();
    } else if (result.blockedByCapacity && this.simulationTime >= this.nextInventoryFullMessageAt) {
      this.nextInventoryFullMessageAt=this.simulationTime+1_800; this.audio.play("ui"); this.hud.showMessage("인벤토리가 가득 찼습니다.");
    }
  }

  private rescueCompanion(companion: Companion): void {
    companion.rescued = true;
    companion.command = "follow";
    companion.focusTargetId = undefined;
    companion.commandTarget = undefined;
    this.mapViews.survivorMarkers.get(companion.id)?.setVisible(false);
    this.worldObjects.unregister(companion.id);
    this.registerCompanionObject(companion);
    this.refreshRescuedCompanions();
    this.fogInvalidation.invalidate();
    this.hud.showMessage(`생존자를 구조했습니다. 현재 동료 ${this.rescuedCompanions.length}/4`, 4_000);
    this.saveGame(false);
    this.interactionSystem.invalidate();
  }

  private createGroundItems(): void {
    this.map.groundItems.forEach((item) => {
      if (!this.searchedContainers.has(`ground:${item.id}`)) this.drops.push(new ItemDrop(this, item.id, item.itemId, item.quantity, tileCenter(item.tileX), tileCenter(item.tileY)));
    });
  }

  private spawnDrop(itemId: string, quantity: number, x: number, y: number): void {
    this.dropCounter += 1;
    const drop = new ItemDrop(this, `drop-${this.dropCounter}`, itemId, quantity, x, y);
    this.drops.push(drop);
    this.registerDropObject(drop);
  }

  private grantCompendium(entry: CompendiumEntry): void {
    const equipped=this.player.equippedWeapon;
    const result=grantCompendiumEntry(entry,{developerMode:this.settings.developerMode,canAdd:(id,amount)=>this.inventory.canAdd(id,amount),add:(id,amount)=>this.inventory.add(id,amount),hasWeapon:(id)=>this.player.unlockedWeapons.has(id),unlockWeapon:(id)=>{this.player.unlockWeapon(id,false);this.player.equippedWeapon=equipped;},syncObjectives:()=>this.syncCollectedParts()});
    this.pauseMenu.setDeveloperMode(this.settings.developerMode);
    if(result.success)this.hud.showMessage(`${entry.name} ${entry.kind==="weapon"?"해금":`${result.amount} 지급`}`);else this.hud.showMessage(result.reason==="developer-mode-off"?"개발자 모드에서만 지급할 수 있습니다.":result.reason==="already-unlocked"?"이미 해금된 무기입니다.":"인벤토리가 가득 찼습니다.");
    this.refreshInventoryPanel();
  }

  private craft(recipeId: string): void {
    const result = this.crafting.craft(recipeId, this.inventory, { ignoreIngredients: this.settings.developerMode });
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
    const consumable = getItemDefinition(itemId).consumableEffect;
    if (consumable && canApplyConsumable(consumable, this.player.vitals, this.player.survivalNeeds)) {
      const applied = applyConsumable(consumable, this.player.vitals, this.player.survivalNeeds);
      this.player.vitals = applied.vitals;
      this.player.survivalNeeds = applied.needs;
      consumed = true;
    } else if (itemId === "bandage" && this.player.vitals.health < this.player.vitals.maxHealth) {
      this.player.vitals = this.infection.heal(this.player.vitals, 28);
      consumed = true;
    } else if (itemId === "medicine" && this.player.vitals.infection > 0) {
      this.player.vitals = this.infection.useMedicine(this.player.vitals);
      consumed = true;
    } else if (itemId === "torch") {
      this.player.torchRemaining = Math.max(this.player.torchRemaining, BALANCE.torchSeconds);
      consumed = true;
      this.fogInvalidation.invalidate();
    } else if (itemId === "molotov") {
      this.throwMolotov();
      consumed = true;
    } else if (itemId === "barricade") {
      consumed = this.placeBarricade();
    } else if (BUILDABLE_ITEM_KIND[itemId]) {
      consumed = this.placeStructure(BUILDABLE_ITEM_KIND[itemId]);
    } else if (itemId === "scrap_cache") {
      this.inventory.add("metal", 1);
      if (this.rng.chance(0.5)) this.inventory.add("wood", 1);
      consumed = true;
    }
    if (!consumed) {
      this.hud.showMessage(itemId === "canned_food" ? "지금은 배가 고프지 않습니다." : itemId === "water" ? "지금은 목이 마르지 않습니다." : "지금은 사용할 수 없습니다.");
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
    this.fogInvalidation.invalidate();
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
    let id: string;
    do id = `barricade-${this.seed}-${++this.barricadeCounter}`;
    while (this.destructibles.get(id));
    const saved: SavedBarricadeState = { id, tileX, tileY, health: OBSTACLE_BALANCE.barricadeHealth, maxHealth: OBSTACLE_BALANCE.barricadeHealth };
    const state = this.destructibles.addBarricade(saved);
    const obstacle: WorldObstacle = {
      id, tileX, tileY, widthTiles: 1, heightTiles: 1,
      blocksMovement: true, blocksVision: false, blocksProjectiles: true, coverHeight: "low", kind: "barricade",
    };
    this.collision.addDynamicObstacle(obstacle);
    const view = new BarricadeView(this, state);
    this.barricadeViews.set(id, view);
    const position = { x: tileCenter(state.tileX), y: tileCenter(state.tileY) };
    this.worldObjects.register(this.makeWorldObject(id, "barricade", view, () => position, () => !state.destroyed));
    this.minimap.markBarricadeTile(tileX, tileY, true);
    this.noise.emit({ x: tileCenter(tileX), y: tileCenter(tileY), intensity: 20, category: "craft", createdAt: this.simulationTime });
    this.fogInvalidation.invalidate();
    return true;
  }

  private placeStructure(kind: BuildableKind): boolean {
    const worldX = this.player.position.x + Math.cos(this.player.aimAngle) * 34;
    const worldY = this.player.position.y + Math.sin(this.player.aimAngle) * 34;
    const tileX = Math.floor(worldX / TILE_SIZE); const tileY = Math.floor(worldY / TILE_SIZE);
    const tileIndex = tileY * this.map.widthTiles + tileX;
    const actorOccupied = squaredDistance({ x: tileCenter(tileX), y: tileCenter(tileY) }, this.player.position) < 18 * 18
      || this.companions.some((companion) => companion.alive && squaredDistance({ x: tileCenter(tileX), y: tileCenter(tileY) }, companion.position) < 18 * 18);
    const failure = getBuildablePlacementFailure(kind, {
      inBounds: tileX >= 0 && tileY >= 0 && tileX < this.map.widthTiles && tileY < this.map.heightTiles,
      blocked: this.collision.isTileBlocked(tileX, tileY),
      occupiedByStructure: this.structures.some((state) => state.tileX === tileX && state.tileY === tileY),
      doorway: this.map.doors.some((door) => door.tileX === tileX && door.tileY === tileY),
      objective: this.map.containers.some((container) => Boolean(container.part) && container.tileX === tileX && container.tileY === tileY),
      extraction: squaredDistance({ x: tileCenter(tileX), y: tileCenter(tileY) }, this.map.extractionZone) <= this.map.extractionZone.radius ** 2,
      actorOccupied,
      indoor: this.indoorTiles[tileIndex] === 1,
      roadLane: isRoad(this.map, tileX, tileY),
    });
    if (failure) { this.hud.showMessage(failure === "solar-indoors" ? "태양광 발전기는 실외에만 설치할 수 있습니다." : "이 위치에는 설치할 수 없습니다."); return false; }
    let id: string;
    do id = `structure-${this.seed}-${++this.structureCounter}`; while (this.structures.some((state) => state.id === id));
    const state = createPlacedStructure(id, kind, tileX, tileY);
    this.restoreStructure(state);
    this.registerStructureObject(state);
    this.rebuildPowerTopology();
    this.fogInvalidation.invalidate();
    this.noise.emit({ x: tileCenter(tileX), y: tileCenter(tileY), intensity: 24, category: "craft", createdAt: this.simulationTime });
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
            this.damageZombie(zombie, 8, { x: 0, y: 0 },{kind:"fire",hitX:impactX,hitY:impactY,directionX:Math.cos(angle),directionY:Math.sin(angle),sequence:++this.ambientEffectSequence});
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
    if (expired) this.fogInvalidation.invalidate();
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
    this.player.reloadingUntil = 0;
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
        smg: WEAPON_DEFINITIONS.smg.name,
        shotgun: WEAPON_DEFINITIONS.shotgun.name,
        hunting_rifle: WEAPON_DEFINITIONS.hunting_rifle.name,
      },
      developerMode: this.settings.developerMode,
    };
  }

  private setDeveloperMode(enabled: boolean): void {
    this.settings = this.settingsStore.setDeveloperMode(enabled);
    this.pauseMenu.setDeveloperMode(enabled);
    this.refreshInventoryPanel();
    this.minimap.invalidateMarkers();
    this.hud.showMessage(`개발자 모드 ${enabled ? "켜짐" : "꺼짐"}`);
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
    this.worldObjects.setInteractable("extraction", false);
    this.interactionSystem.invalidate();
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
    const attractor = this.noise.getGunshotAttractor(this.simulationTime);
    if (attractor && this.simulationTime >= this.nextHordeActivationAt) {
      const activationCount = getHordeActivationCount(attractor.value);
      if (activationCount > 0) {
        this.nextHordeActivationAt = this.simulationTime + getHordeActivationIntervalMs(attractor.value);
        this.activateGunshotHorde(activationCount, attractor);
      }
    }
    if (this.simulationTime >= this.nextDormantActivationAt) {
      this.nextDormantActivationAt = this.simulationTime + 1_000;
      this.activateDormantZombieSpawns(48, ZOMBIE_ACTIVATION_RADIUS);
    }
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
      if (this.countActiveLivingZombies() >= BALANCE.maxActiveZombies) return;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const angle = this.rng.next() * Math.PI * 2;
        const x = Math.max(12, Math.min(WORLD_WIDTH - 12, center.x + Math.cos(angle) * radius));
        const y = Math.max(12, Math.min(WORLD_HEIGHT - 12, center.y + Math.sin(angle) * radius));
        if (this.collision.isMovementBlockedWorld(x, y, BALANCE.zombieRadius)) continue;
        const zombie = new Zombie(this, `spawned-${Math.round(this.simulationTime)}-${index}-${attempt}`, kind, { x, y }, "InvestigateNoise");
        zombie.mind.lastHeardNoisePosition = { ...center };
        this.zombies.push(zombie);
        this.registerZombieObject(zombie);
        this.activeZombieCount += 1;
        break;
      }
    }
  }

  private activateDormantZombieSpawns(targetLivingCount: number, radius: number): void {
    let living = this.countActiveLivingZombies();
    if (living >= Math.min(targetLivingCount, BALANCE.maxActiveZombies)) return;
    const radiusSquared = radius * radius;
    for (const spawn of this.map.zombieSpawns) {
      if (living >= Math.min(targetLivingCount, BALANCE.maxActiveZombies)) break;
      if (this.consumedZombieSpawnIds.has(spawn.id)) continue;
      const spawnX = tileCenter(spawn.tileX);
      const spawnY = tileCenter(spawn.tileY);
      const deltaX = spawnX - this.player.position.x;
      const deltaY = spawnY - this.player.position.y;
      if (deltaX * deltaX + deltaY * deltaY > radiusSquared) continue;
      this.consumedZombieSpawnIds.add(spawn.id);
      const zombie = new Zombie(this, spawn.id, spawn.kind, { x: spawnX, y: spawnY });
      this.zombies.push(zombie);
      if (this.worldObjects.size > 0) this.registerZombieObject(zombie);
      living += 1;
    }
  }

  private activateGunshotHorde(requestedCount: number, attractor: Readonly<{ x: number; y: number }>): number {
    const spawns = this.map.zombieSpawns;
    let living = this.countActiveLivingZombies();
    if (spawns.length === 0 || living >= BALANCE.maxActiveZombies) return 0;
    let activated = 0;
    const scanCount = Math.min(HORDE_SPAWN_SCAN_BUDGET, spawns.length);
    for (let scanned = 0; scanned < scanCount && activated < requestedCount; scanned += 1) {
      const index = this.hordeSpawnCursor++ % spawns.length;
      const spawn = spawns[index]!;
      if (this.consumedZombieSpawnIds.has(spawn.id)) continue;
      const spawnPoint = { x: tileCenter(spawn.tileX), y: tileCenter(spawn.tileY) };
      if (!isEligibleHordeSpawn({
        spawn: spawnPoint,
        player: this.player.position,
        attractor,
        insideCamera: this.cameras.main.worldView.contains(spawnPoint.x, spawnPoint.y),
        visibleInFog: this.fog.getStateAtWorld(spawnPoint.x, spawnPoint.y) === VisibilityState.Visible,
        blocked: this.collision.isMovementBlockedWorld(spawnPoint.x, spawnPoint.y, BALANCE.zombieRadius),
      })) continue;
      if (living >= BALANCE.maxActiveZombies) break;
      this.consumedZombieSpawnIds.add(spawn.id);
      const zombie = new Zombie(this, spawn.id, spawn.kind, spawnPoint, "InvestigateNoise");
      zombie.mind.lastHeardNoisePosition = { x: attractor.x, y: attractor.y };
      zombie.mind.alertLevel = 1;
      zombie.mind.searchTicks = 3;
      zombie.nextThinkAt = this.simulationTime + activated * 45;
      this.zombies.push(zombie);
      if (this.worldObjects.size > 0) this.registerZombieObject(zombie);
      this.activeZombieCount += 1;
      living += 1;
      activated += 1;
    }
    return activated;
  }

  private countActiveLivingZombies(): number {
    let count = 0;
    for (const zombie of this.zombies) if (zombie.isAlive() && !this.isZombieDormant(zombie)) count += 1;
    return count;
  }

  private rebuildPowerTopology(): void {
    this.powerGrid.rebuild(this.structures, (state) => ({ x: tileCenter(state.tileX), y: tileCenter(state.tileY) }));
    const graphics = this.powerWireGraphics;
    if (!graphics) return;
    graphics.clear().lineStyle(1, 0x777d7a, 0.82);
    const byId = new Map(this.structures.map((state) => [state.id, state]));
    for (const edge of this.powerGrid.getEdges()) {
      const first = byId.get(edge.fromId); const second = byId.get(edge.toId);
      if (!first || !second) continue;
      const fromCenter = { x: tileCenter(first.tileX), y: tileCenter(first.tileY) };
      const toCenter = { x: tileCenter(second.tileX), y: tileCenter(second.tileY) };
      const length = Math.hypot(toCenter.x - fromCenter.x, toCenter.y - fromCenter.y) || 1;
      const insetX = (toCenter.x - fromCenter.x) / length * 8; const insetY = (toCenter.y - fromCenter.y) / length * 8;
      const points = createPowerWirePolyline({ x: fromCenter.x + insetX, y: fromCenter.y + insetY }, { x: toCenter.x - insetX, y: toCenter.y - insetY }, first.id, second.id);
      graphics.beginPath().moveTo(points[0]!.x, points[0]!.y);
      for (let index = 1; index < points.length; index += 1) graphics.lineTo(points[index]!.x, points[index]!.y);
      graphics.strokePath();
    }
  }

  private updatePowerAndTurrets(deltaSeconds: number): void {
    if (this.simulationTime >= this.nextPowerTickAt) {
      this.nextPowerTickAt = this.simulationTime + POWER_TICK_MS;
      const changed = this.powerGrid.tick(POWER_TICK_MS / 1_000, this.clock.getPhase() === "day");
      if (changed.length > 0) {
        for (const id of changed) this.structureViews.get(id)?.updateStatus();
        this.fogInvalidation.invalidate();
      }
    }
    for (const turret of this.structures) {
      if (turret.kind !== "turret") continue;
      const runtime = this.turretRuntime.get(turret.id)!;
      if (!turret.powered) { runtime.target = undefined; continue; }
      const origin = { x: tileCenter(turret.tileX), y: tileCenter(turret.tileY) };
      if (this.simulationTime >= runtime.nextScanAt || !runtime.target?.isAlive()) {
        runtime.nextScanAt = this.simulationTime + TURRET_SCAN_INTERVAL_MS;
        this.turretTargetScratch.length = 0;
        for (const zombie of this.zombies) this.turretTargetScratch.push({ id: zombie.id, position: zombie.position, alive: zombie.isAlive(), active: !this.isZombieDormant(zombie), kind: "zombie" });
        const selected = selectTurretTarget(origin, true, this.turretTargetScratch, (from, to) => this.collision.hasLineOfSight(from, to), runtime.target?.id);
        runtime.target = selected ? this.zombies.find((zombie) => zombie.id === selected.id) : undefined;
      }
      const target = runtime.target;
      if (!target?.isAlive()) continue;
      const targetAngle = Math.atan2(target.position.y - origin.y, target.position.x - origin.x);
      turret.aimAngle = rotateTurretToward(turret.aimAngle ?? 0, targetAngle, deltaSeconds);
      this.structureViews.get(turret.id)?.setAim(turret.aimAngle);
      if (Math.abs(angleDifference(targetAngle, turret.aimAngle)) > TURRET_AIM_TOLERANCE || this.simulationTime < runtime.nextFireAt) continue;
      runtime.nextFireAt = this.simulationTime + TURRET_COOLDOWN_MS;
      const projectileOrigin = { x: origin.x + Math.cos(turret.aimAngle) * 13, y: origin.y + Math.sin(turret.aimAngle) * 13 };
      const wallHit = this.collision.firstProjectileCollision(projectileOrigin, target.position);
      if (wallHit) continue;
      this.damageZombie(target, TURRET_DAMAGE, { x: Math.cos(turret.aimAngle) * 5, y: Math.sin(turret.aimAngle) * 5 },{kind:"projectile",hitX:target.position.x,hitY:target.position.y,directionX:Math.cos(turret.aimAngle),directionY:Math.sin(turret.aimAngle),weaponId:"pistol",sequence:++this.ambientEffectSequence});
      this.noise.emitGunshot("turret", origin.x, origin.y, 72, this.simulationTime);
      this.attackEffects.play({ weapon: "turret", originX: origin.x, originY: origin.y, angle: turret.aimAngle, startedAt: this.simulationTime, endpointX: target.position.x, endpointY: target.position.y, impacts: [{ x: target.position.x, y: target.position.y, kind: "zombie" }], alwaysShowCore: false });
      this.audio.play("remote-shot",{source:origin,listener:this.player.position});
    }
  }

  private isZombieDormant(zombie: Zombie): boolean {
    return squaredDistance(zombie.position, this.player.position) > ZOMBIE_DORMANT_RADIUS * ZOMBIE_DORMANT_RADIUS;
  }

  private recomputeFog(force: boolean): void {
    const playerCellX = Math.floor(this.player.position.x / FOG_CELL_SIZE);
    const playerCellY = Math.floor(this.player.position.y / FOG_CELL_SIZE);
    const playerCell = playerCellY * this.fog.widthCells + playerCellX;
    const vision = getVisionProfile(this.clock);
    const flashlightActive = this.player.flashlightOn && this.player.flashlightCharge > 0 && vision.flashlightFactor > 0;
    const input = {
      playerCell,
      ambientAimBucket: Math.round(this.player.aimAngle / (Math.PI * 2 / FLASHLIGHT_AIM_BUCKETS)),
      visionRevision: this.collision.visionRevision,
      ambientRadiusBucket: Math.round(vision.ambientRadius / FOG_CELL_SIZE),
      ambientAngleBucket: Math.round(vision.ambientConeAngle / (Math.PI / 64)),
      flashlightActive,
      flashlightRadiusBucket: flashlightActive ? Math.round(vision.effectiveFlashlightRadius / FOG_CELL_SIZE) : -1,
      torchActive: this.player.torchRemaining > 0,
      companionVisionSignature: getCompanionVisionSignature(this.rescuedCompanions, FOG_CELL_SIZE, this.fog.widthCells),
    };
    if (!this.fogInvalidation.shouldRecompute(input, force)) return;

    const calculationStarted = performance.now();
    const sources = buildVisionSources({
      x: this.player.position.x,
      y: this.player.position.y,
      aimAngle: this.player.aimAngle,
      flashlightOn: flashlightActive,
      torchRemaining: this.player.torchRemaining,
    }, this.clock, this.fires, this.rescuedCompanions, this.visionSources);
    for (const turret of this.structures) if (turret.kind === "turret" && turret.powered) sources.push({
      id: `turret:${turret.id}`, x: tileCenter(turret.tileX), y: tileCenter(turret.tileY), radius: TURRET_RANGE, intensity: 1, sourceType: "turret",
    });
    this.fog.recompute(sources, this.collision);
    const calculationFinished = performance.now();
    this.fogRenderer.render();
    this.minimap.markFogDirty(this.fog.getChangedIndices());
    const textureFinished = performance.now();
    this.performanceMonitor.recordFog(calculationFinished - calculationStarted, textureFinished - calculationFinished);
    this.fogInvalidation.commit(input);
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
    for (const companion of this.companions) {
      const visible = this.fog.getStateAtWorld(companion.position.x, companion.position.y) === VisibilityState.Visible;
      this.mapViews.survivorMarkers.get(companion.id)?.setVisible(!companion.rescued && companion.alive && visible);
      companion.view.setVisible(visible);
    }
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
    const weapon = WEAPON_DEFINITIONS[this.player.equippedWeapon];
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
      hunger: this.player.survivalNeeds.hunger,
      thirst: this.player.survivalNeeds.thirst,
      stamina: this.player.survivalNeeds.stamina,
      dayNumber: this.clock.getDayNumber(),
      time: this.clock.getClockLabel(),
      phase: this.clock.getPhase(),
      weaponId: weapon.id,
      weapon: weapon.name,
      magazine: this.player.magazine,
      reserveAmmo: weapon.ammoItemId ? this.inventory.count(weapon.ammoItemId) : 0,
      showAmmo: weapon.kind === "ranged",
      reloading: this.player.reloadingUntil > 0,
      flashlightCharge: this.player.flashlightCharge,
      flashlightOn: this.player.flashlightOn,
      torchRemaining: this.player.torchRemaining,
      quickslots: this.quickslots,
      collectedParts: this.collectedParts.size,
      companions: this.companions,
      objective,
      defenseRemaining: this.defenseActive ? this.defenseRemaining : undefined,
    });
  }

  private saveGame(showFeedback: boolean): void {
    const data: SaveGame = {
      version: SAVE_VERSION,
      mapId: MAP_ID,
      mapVersion: MAP_VERSION,
      mapSeed: this.map.mapSeed,
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
        magazines: { ...this.player.magazines },
        flashlightCharge: this.player.flashlightCharge,
        flashlightOn: this.player.flashlightOn,
        torchRemaining: this.player.torchRemaining,
        survivalNeeds: { ...this.player.survivalNeeds },
      },
      clock: this.clock.snapshot(),
      inventory: this.inventory.snapshot(),
      quickslots: [...this.quickslots],
      companions: this.companions.map((companion) => ({
        id: companion.id,
        x: companion.position.x,
        y: companion.position.y,
        health: companion.health,
        rescued: companion.rescued,
        alive: companion.alive,
        command: companion.command,
        targetX: companion.commandTarget?.x,
        targetY: companion.commandTarget?.y,
        focusTargetId: companion.focusTargetId,
      })),
      collectedParts: [...this.collectedParts],
      searchedContainers: [...this.searchedContainers],
      openedDoors: this.map.doors.filter((door) => door.open).map((door) => door.id),
      doorStates: this.destructibles.doorStates(),
      barricades: this.destructibles.barricadeStates(),
      structures: this.structures.map(({ powered: _powered, ...state }) => ({ ...state })),
      consumedZombieSpawnIds: [...this.consumedZombieSpawnIds],
      zombies: this.zombies.filter((zombie) => zombie.isAlive()).map((zombie) => ({
        id: zombie.id,
        kind: zombie.kind,
        state: zombie.mind.state,
        x: zombie.position.x,
        y: zombie.position.y,
        health: zombie.health,
        maxHealth: zombie.definition.health,
        visualLock: zombie.mind.visualLock,
        currentTargetId: zombie.mind.currentTargetId,
        lastSeenAt: zombie.mind.lastSeenAt,
      })),
      exploredFog: this.fog.exportExplored(),
      extraction: { active: this.defenseActive, remainingSeconds: this.defenseRemaining },
    };
    const success = this.saveSystem.save(data);
    if (showFeedback) this.hud.showMessage(success ? "생존 기록을 저장했습니다." : "저장에 실패했습니다.");
  }

  private restorePlayer(saved: SaveGame): void {
    this.player.vitals = { health: saved.player.health, maxHealth: 100, infection: saved.player.infection };
    this.player.survivalNeeds = createSurvivalNeeds(saved.player.survivalNeeds);
    saved.player.unlockedWeapons.forEach((weapon) => {
      if (weapon === "knife" || weapon === "bat" || isFirearmId(weapon)) this.player.unlockedWeapons.add(weapon);
    });
    if (saved.player.equippedWeapon === "knife" || saved.player.equippedWeapon === "bat" || isFirearmId(saved.player.equippedWeapon)) this.player.equippedWeapon = saved.player.equippedWeapon;
    this.player.magazines = { ...saved.player.magazines };
    this.player.flashlightCharge = saved.player.flashlightCharge;
    this.player.flashlightOn = saved.player.flashlightOn;
    this.player.torchRemaining = saved.player.torchRemaining;
  }

  private recoverCompanionFromBlockedSave(companion: Companion): void {
    if (this.collision.canOccupyCircle(companion.position.x, companion.position.y, BALANCE.companionRadius)) return;
    const recovered = findNearestWalkableGoal(
      companion.position,
      (x, y) => this.collision.canOccupyCircle(x, y, BALANCE.companionRadius),
      6,
      companion.goalScratch,
    );
    if (!recovered) return;
    companion.position = { x: recovered.x, y: recovered.y };
    companion.navigation.lastProgressX = recovered.x;
    companion.navigation.lastProgressY = recovered.y;
    companion.navigation.lastProgressAt = this.simulationTime;
    companion.view.setPosition(recovered.x, recovered.y);
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
      companionAlive: this.rescuedCompanions.length > 0,
      companionRescued: this.companions.some((companion) => companion.rescued),
      elapsedSeconds: this.clock.getElapsedSeconds(),
      parts: this.collectedParts.size,
    });
  }

  private shutdownUi(): void {
    this.audio?.destroy();
    this.cameraController?.destroy();
    this.performanceMonitor?.destroy();
    this.effects?.destroy();
    this.fogRenderer?.destroy();
    this.hud?.destroy();
    this.dayAnnouncement?.destroy();
    this.inventoryPanel?.destroy();
    this.commandPanel?.destroy();
    this.pauseMenu?.destroy();
    this.minimap?.destroy();
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
