import Phaser from "phaser";
import { BALANCE, COMPANION_MOVEMENT, DEPTH, FLASHLIGHT_AIM_BUCKETS, FOG_CELL_SIZE, LOGICAL_HEIGHT, LOGICAL_WIDTH, MAP_ID, MAP_VERSION, MAX_PATHFINDING_PER_FRAME, OBSTACLE_BALANCE, SAVE_KEY, SAVE_VERSION, TILE_SIZE, WORLD_HEIGHT, WORLD_WIDTH } from "../config/game-config";
import { GameSettingsStore, type GameSettings } from "../core/game-settings";
import { GameClock } from "../core/game-clock";
import type { SaveGame, SavedBarricadeState } from "../core/save-state";
import { SeededRng } from "../core/seeded-rng";
import { createCityBlockMap, CURRENT_MAP_GENERATION_VERSION, getTerrain, TerrainType, type ContainerDefinition, type DoorDefinition, type WorldObstacle } from "../data/map-definitions";
import { assertValidMap } from "../data/map-validation";
import { getItemDefinition, type StorageSlot } from "../data/item-definitions";
import { getInventoryObjectDefinition, isWeaponItemId } from "../data/inventory-object-definitions";
import { CRAFTING_STATION_LABEL, RECIPE_DEFINITIONS, type CraftingStationKind } from "../data/recipe-definitions";
import { BUILDABLE_DEFINITIONS, getBuildCostItems, getRotatedStructureFootprint, type BuildableKind } from "../data/buildable-definitions";
import { isFirearmId, WEAPON_DEFINITIONS } from "../data/weapon-definitions";
import { getChargedMeleeDefinition, isMeleeWeaponId, MELEE_ATTACK_DEFINITIONS, MELEE_INPUT_BALANCE, type MeleeAttackMode } from "../data/melee-attack-definitions";
import type { ZombieKind } from "../data/zombie-definitions";
import { PerformanceMonitor } from "../debug/performance-monitor";
import { AttackEffectController, getAttackBlockReason } from "../effects/attack-effect-controller";
import type { DamageImpactContext } from "../effects/blood-effect-math";
import type { AttackEffectImpact } from "../effects/pixel-effect-definitions";
import { PixelEffectSystem } from "../effects/pixel-effect-system";
import { drawPixelRing } from "../effects/pixel-ring-geometry";
import { Companion, type CompanionCommand } from "../entities/companion";
import { DestructibleObstacleSystem, getZombieStructureDamage } from "../entities/destructible-obstacle";
import { ItemDrop } from "../entities/item-drop";
import { Player } from "../entities/player";
import { createPlacedFurniture, createPlacedSegment, createPlacedStructure, getPlacedStructureCenter, normalizePlacedStructure, type PlacedStructureState, type SavedStructureState } from "../entities/placed-structure";
import type { InteractionContext, WorldObject, WorldObjectKind } from "../entities/world-object";
import { Zombie } from "../entities/zombie";
import { FogRenderer } from "../rendering/fog-renderer";
import { createMapRendering, updateDoorView, type MapViews } from "../rendering/map-renderer";
import { BarricadeView } from "../rendering/obstacle-views";
import { createPowerWirePolyline } from "../rendering/power-wire-geometry";
import { StructureView } from "../rendering/structure-view";
import { StructureChunkRenderer, type StructureRuntimeView } from "../rendering/structure-chunk-renderer";
import { AudioSystem,playFirearmShotForEvent } from "../systems/audio-system";
import { CameraController, configurePaddedCameraBounds } from "../systems/camera-controller";
import { CollisionSystem } from "../systems/collision-system";
import { circleIntersectsThickSegment, pointSegmentDistanceSquared, visibilityProbeTowardPoint, type SegmentGeometry } from "../systems/collision-geometry";
import { angleDifference, distance, getFinalZombieKnockback, type ZombieKnockbackKind } from "../systems/combat-system";
import { chooseLocalSteering, findNearestWalkableGoal, getCompanionFollowSpeed, getCompanionStuckDuration, getWorldTileIndex, isCompanionAimAligned, markCompanionBlocked, markCompanionRepath, shouldOverrideCompanionGoalForCombat, updateCatchUpMode, updateCompanionCombatMovement, updateCompanionStuckState } from "../systems/companion-navigation";
import { createFormationState, getFormationSlot, updateFormationDirection, type FormationState } from "../systems/companion-system";
import { CraftingSystem } from "../systems/crafting-system";
import { CraftingStationSystem, type CraftingStationRegistration } from "../systems/crafting-station-system";
import { FogInvalidationTracker, FogOfWarSystem, VisibilityState, type VisionSource } from "../systems/fog-of-war-system";
import { InfectionSystem } from "../systems/infection-system";
import { applyConsumable, canApplyConsumable } from "../systems/consumable-system";
import { InventorySystem, type InventorySlot, type WeaponEquipmentSlot } from "../systems/inventory-system";
import { buildVisionSources, getCompanionVisionSignature, getVisionProfile, shouldConsumeFlashlightCharge, type ActiveFire } from "../systems/lighting-system";
import { InteractionSystem } from "../systems/interaction-system";
import { NoiseSystem, NOISE_LEVELS } from "../systems/noise-system";
import { initializeNewGameLoadout } from "../systems/new-game-loadout";
import { findAnyAnglePath, type NavigationQuery } from "../systems/pathfinding-system";
import { SaveSystem } from "../systems/save-system";
import { WorldObjectRegistry } from "../systems/world-object-registry";
import { AUTO_PICKUP_INTERVAL_MS, AutoPickupSystem } from "../systems/auto-pickup-system";
import { grantCompendiumEntry, type CompendiumEntry } from "../systems/compendium-system";
import { CameraFeedbackSystem, type CameraFeedbackEvent } from "../systems/camera-feedback-system";
import { getBuildablePlacementFailure } from "../systems/buildable-placement";
import { GENERATOR_FUEL_SECONDS, MAX_GENERATOR_FUEL_SECONDS, POWER_TICK_MS, PowerGridSystem } from "../systems/power-grid-system";
import { rotateTurretToward, selectTurretTarget, TURRET_AIM_TOLERANCE, TURRET_COOLDOWN_MS, TURRET_DAMAGE, TURRET_RANGE, TURRET_SCAN_INTERVAL_MS, type TurretTarget } from "../systems/turret-system";
import { updateZombieMind, ZOMBIE_CHASE_MULTIPLIER, type Point } from "../systems/zombie-ai-system";
import { angleDifference as motionAngleDifference, COMPANION_MOTION_PROFILE, RUNNER_MOTION_PROFILE, updateActorMotionSmoothing, WALKER_MOTION_PROFILE } from "../systems/actor-motion-smoothing";
import { beginNoiseReaction, beginVisualReaction, consumeReadyZombieReaction, updateZombieGait } from "../systems/zombie-organic-behavior";
import { clearCompanionTargetCommitment, updateCompanionTargetCommitment } from "../systems/companion-target-commitment";
import { canRun, createSurvivalNeeds, getRunSpeedMultiplier, updateSurvivalNeeds } from "../systems/survival-needs-system";
import { getHordeActivationCount, getHordeActivationIntervalMs, HORDE_SPAWN_SCAN_BUDGET, isEligibleHordeSpawn } from "../systems/gunshot-horde-system";
import { canSpawnZombies, consumeZombieRestoreBatch, createZombieSpawnToggleState, setZombieSpawnToggle, type ZombieSpawnToggleState } from "../systems/zombie-spawn-toggle";
import { CompanionCommandPanel } from "../ui/companion-command-panel";
import { Hud } from "../ui/hud";
import { InventoryPanel, type BuildTabSelectionIntent, type InventoryPanelState } from "../ui/inventory-panel";
import { PauseMenu } from "../ui/pause-menu";
import { MinimapPanel, shouldPauseSimulationForMap } from "../ui/minimap";
import { DayAnnouncement, getInitialDayAnnouncement } from "../ui/day-announcement";
import { getFootstepEvent } from "../systems/footstep-system";
import { MeleeActionController } from "../systems/melee-input-state";
import { collectMeleeTargets, MeleeHitTracker, type MeleeHit } from "../systems/melee-combat-system";
import { HitStopSystem } from "../systems/hit-stop-system";
import { ProjectileSystem, type ProjectileImpact, type ProjectileTarget, type ProjectileTeam, type ProjectileWeaponId } from "../systems/projectile-system";
import { createWeaponAccuracyState, deterministicProjectileAngle, getEffectiveWeaponSpread, recordWeaponShot, recoverWeaponBloom, type WeaponMovementAccuracy } from "../systems/weapon-accuracy-system";
import { WeaponCrosshair } from "../ui/weapon-crosshair";
import { createOrientedSegmentChain, isWithinBuildRange, segmentConflicts, snapStructureAnchor, type SegmentBuildableKind, type StructureSegment } from "../systems/structure-segment-placement";
import { beginWallDrag, clearWallDrag, createWallDragState, markWallDragCommitted, snapshotWallDrag, updateWallDragPreview, type WallBuildableKind } from "../systems/wall-drag-chain-placement";
import { commitStructureSegmentChain } from "../systems/build-transaction";
import { PlacedStructureRegistry } from "../systems/placed-structure-registry";
import { StructureDurabilitySystem, getDemolitionRefund, getRepairCost } from "../systems/structure-durability-system";
import { deterministicStorageDropOffsets, WorldStorageContainer } from "../systems/world-storage-container";
import { chooseBlockingStructure, getStructureAttackSlot, ZOMBIE_STRUCTURE_DAMAGE } from "../systems/zombie-structure-attack";
import { WorldStoragePanel } from "../ui/world-storage-panel";
import { BUILD_PREVIEW_ALPHA, INVALID_BUILD_PREVIEW_ALPHA, confirmPendingBuildPlacement, createPendingBuildPlacement, getFurniturePlacement, getItemBuildableId, rotatePendingBuildPlacement, shouldReportBuildPlacementFailure, toggleFurniturePlacementMode, updatePendingBuildPlacement, type BuildPlacementSource, type PendingBuildPlacement } from "../systems/build-placement-flow";
import { createStructureRenderModel, drawStructureRenderModel } from "../rendering/structure-render-model";
import { OccluderSurfaceRenderer } from "../rendering/occluder-surface-renderer";
import { circleIntersectsObb, getObbAabb, obbIntersectsObb, type OrientedRectangle } from "../systems/oriented-furniture-collision";

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
  build: Phaser.Input.Keyboard.Key;
  buildGrid: Phaser.Input.Keyboard.Key;
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
  private companionNavigationQuery!: NavigationQuery;
  private zombieNavigationQuery!: NavigationQuery;
  private destructibles!: DestructibleObstacleSystem;
  private clock!: GameClock;
  private fog!: FogOfWarSystem;
  private fogRenderer!: FogRenderer;
  private occluderSurfaceRenderer!:OccluderSurfaceRenderer;
  private cameraController!: CameraController;
  private mapViews!: MapViews;
  private readonly barricadeViews = new Map<string, BarricadeView>();
  private structures: PlacedStructureState[] = [];
  private readonly structureRegistry = new PlacedStructureRegistry();
  private readonly structureDurability = new StructureDurabilitySystem();
  private readonly structureStorage = new Map<string, WorldStorageContainer>();
  private readonly minimapStructureSources: Array<{ id:string; position:Point; kind:string }> = [];
  private readonly structureViews = new Map<string, StructureRuntimeView>();
  private structureChunks!: StructureChunkRenderer;
  private readonly turretRuntime = new Map<string, { target?: Zombie; nextScanAt: number; nextFireAt: number }>();
  private readonly turretTargetScratch: TurretTarget[] = [];
  private readonly powerGrid = new PowerGridSystem();
  private readonly craftingStations = new CraftingStationSystem();
  private activeCraftingStationId?: string;
  private powerWireGraphics?: Phaser.GameObjects.Graphics;
  private indoorTiles = new Uint8Array(0);
  private structureCounter = 0;
  private buildPreview?: Phaser.GameObjects.Graphics;
  private pendingBuildPlacement?: PendingBuildPlacement;
  private buildStartAnchor?: Point;
  private readonly wallDrag = createWallDragState();
  private lastBuildFailureMessageAt = Number.NEGATIVE_INFINITY;
  private readonly demolitionConfirmUntil = new Map<string, number>();
  private worldStoragePanel!: WorldStoragePanel;
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
  private zombieSpawnToggle: ZombieSpawnToggleState = createZombieSpawnToggleState();
  private rng!: SeededRng;
  private seed = 0;
  private quickslots: Array<string | null> = ["bandage", "medicine", "torch", "molotov", "barricade"];
  private collectedParts = new Set<string>();
  private searchedContainers = new Set<string>();
  private effects!: PixelEffectSystem;
  private attackEffects!: AttackEffectController;
  private projectiles!: ProjectileSystem;
  private audio!: AudioSystem;
  private keys!: WorldKeys;
  private uiRoot!: HTMLDivElement;
  private hud!: Hud;
  private inventoryPanel!: InventoryPanel;
  private commandPanel!: CompanionCommandPanel;
  private pauseMenu!: PauseMenu;
  private minimap!: MinimapPanel;
  private dayAnnouncement!: DayAnnouncement;
  private crosshair!: WeaponCrosshair;
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
  private readonly meleeAction = new MeleeActionController();
  private readonly meleeHitTracker = new MeleeHitTracker();
  private readonly meleeTargetScratch: MeleeHit[] = [];
  private readonly hitStop = new HitStopSystem();
  private readonly weaponAccuracy = createWeaponAccuracyState();
  private weaponMovementAccuracy: WeaponMovementAccuracy = "stationary";
  private readonly projectileTargets: ProjectileTarget[] = [];
  private readonly projectileBloodKeys = new Set<string>();
  private readonly projectileBloodOrder: string[] = [];
  private readonly preventCanvasContextMenu = (event: Event) => event.preventDefault();
  private readonly handleWindowBuildPointerUp = (event: PointerEvent) => { if (event.button === 0) this.finishWallDrag("commit"); };
  private readonly handleBuildPointerCancel = () => this.finishWallDrag("cancel");
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
    this.zombieSpawnToggle = createZombieSpawnToggleState(this.settings.zombieSpawningEnabled);
    const saved = this.loadRequested ? this.saveSystem.load() : null;
    const mapReset = this.saveSystem.consumeIncompatibleMapReset();
    this.seed = saved?.seed ?? ((Date.now() ^ 0x5f3759df) >>> 0);
    this.rng = new SeededRng(saved?.rngState ?? this.seed);
    this.map = createCityBlockMap(saved?.mapSeed ?? (this.seed ^ 0x6d617032),saved?.mapGenerationVersion??CURRENT_MAP_GENERATION_VERSION);
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
    const navigationCollision = this.collision;
    this.companionNavigationQuery = {
      widthTiles: this.map.widthTiles, heightTiles: this.map.heightTiles, tileSize: TILE_SIZE,
      get navigationRevision() { return navigationCollision.navigationRevision; },
      getTraversalCost: (x, y) => navigationCollision.isTileBlocked(x, y) ? Number.POSITIVE_INFINITY : 1,
      canTraverse: (from, to) => navigationCollision.canTraverseCircle(from, to, BALANCE.companionRadius),
      canTraverseEdge: (fromX, fromY, toX, toY) => navigationCollision.canTraverseTileEdge(fromX, fromY, toX, toY, BALANCE.companionRadius),
    };
    this.zombieNavigationQuery = {
      widthTiles: this.map.widthTiles, heightTiles: this.map.heightTiles, tileSize: TILE_SIZE,
      get navigationRevision() { return navigationCollision.navigationRevision; },
      getTraversalCost: (x, y) => navigationCollision.getZombieTraversalCost(x, y),
      canTraverse: (from, to) => navigationCollision.canTraverseCircle(from, to, BALANCE.zombieRadius),
      canTraverseEdge: (fromX, fromY, toX, toY) => navigationCollision.canTraverseTileEdge(fromX, fromY, toX, toY, BALANCE.zombieRadius, true),
    };
    this.destructibles = new DestructibleObstacleSystem(this.map.doors, this.map.widthTiles);
    this.clock = new GameClock();
    if (saved) this.clock.restore(saved.clock);
    this.mapViews = createMapRendering(this, this.map);
    for (const barricade of saved?.barricades ?? []) this.restoreBarricade(barricade);
    this.indoorTiles = new Uint8Array(this.map.widthTiles * this.map.heightTiles);
    for (const building of this.map.buildings) for (const index of building.floorTiles) this.indoorTiles[index] = 1;
    this.powerWireGraphics = this.add.graphics().setDepth(DEPTH.propBack + 1);
    this.structureChunks = new StructureChunkRenderer(this);
    for (const structure of saved?.structures ?? []) this.restoreStructure(structure);
    this.structureCounter = Math.max(this.structureCounter, saved?.nextStructureId ?? 0);
    this.rebuildPowerTopology();

    this.inventory = new InventorySystem(BALANCE.inventorySlots, saved?.inventory);
    const legacyInventoryOverflow: InventorySlot[] = [];
    this.quickslots = saved?.quickslots.slice(0, 5) ?? ["bandage", "medicine", "torch", "molotov", "barricade"];
    while (this.quickslots.length < 5) this.quickslots.push(null);
    this.collectedParts = new Set(saved?.collectedParts ?? []);
    this.syncCollectedParts();
    this.searchedContainers = new Set(saved?.searchedContainers ?? []);
    this.defenseActive = saved?.extraction.active ?? false;
    this.defenseRemaining = saved?.extraction.remainingSeconds ?? BALANCE.defenseSeconds;

    const playerPosition = saved?.player ?? this.map.playerSpawn;
    this.player = new Player(this, playerPosition);
    if (saved) {
      this.restorePlayer(saved);
      const inventoryVersion = Array.isArray(saved.inventory) ? 0 : saved.inventory.version;
      if (inventoryVersion < 4) legacyInventoryOverflow.push(...this.inventory.migrateLegacyWeapons(saved.player.equippedWeapon, saved.player.unlockedWeapons));
    } else initializeNewGameLoadout(this.inventory);
    legacyInventoryOverflow.push(...this.inventory.takeLegacyOverflow());
    this.syncEquippedWeaponFromInventory();
    this.createCompanions(saved);

    this.createZombies(saved);
    this.createGroundItems();
    legacyInventoryOverflow.forEach((slot, index) => this.spawnDrop(slot.itemId, slot.quantity, this.player.position.x + 18 + (index % 3) * 8, this.player.position.y + Math.floor(index / 3) * 8));
    this.applySearchedContainerViews();

    this.fog = new FogOfWarSystem(WORLD_WIDTH, WORLD_HEIGHT, FOG_CELL_SIZE, this.seed);
    if (saved) this.fog.importExplored(saved.exploredFog);
    this.fogRenderer = new FogRenderer(this, this.fog);
    this.occluderSurfaceRenderer=new OccluderSurfaceRenderer(this,this.map);
    this.effects = new PixelEffectSystem(this, (x, y) => this.fog.getStateAtWorld(x, y) === VisibilityState.Visible);
    this.attackEffects = new AttackEffectController(this.effects);
    this.projectiles = new ProjectileSystem(this, (x, y) => this.fog.getStateAtWorld(x, y) === VisibilityState.Visible);
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
    this.hud.showMessage(legacyInventoryOverflow.length > 0 ? `기존 인벤토리의 초과 물자 ${legacyInventoryOverflow.length}묶음을 발밑에 내려놓았습니다.` : mapReset ? "도시 확장으로 기존 기록을 초기화하고 새 게임을 시작했습니다." : saved ? "저장된 생존 기록을 불러왔습니다." : "해가 지기 전에 탈출 부품 3개와 생존자를 찾으세요.", 4_000);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.shutdownUi());
  }

  update(time: number, rawDelta: number): void {
    if (this.gameEnded) return;
    this.performanceMonitor.beginFrame(rawDelta);
    this.pathfindingWorkThisFrame = 0;
    this.handlePanelKeys();
    this.capturePointerWorldSnapshot();
    this.updateBuildPreview();
    if (shouldPauseSimulationForMap(this.minimap.getMode())) {
      this.cancelMeleeAction();
      this.updateWeaponCrosshair(true);
      this.minimap.update(time, this.getMinimapDynamicState());
      this.recordNavigationDiagnostics();
      this.performanceMonitor.update(time, this.activeZombieCount);
      return;
    }
    if (this.commandPanel.isOpen()) this.cancelMeleeAction();
    if (this.inventoryPanel.isOpen() || this.pauseMenu.isOpen() || this.worldStoragePanel.isOpen()) {
      this.cancelMeleeAction();
      this.updateWeaponCrosshair(true);
      this.player.updateView(this.simulationTime);
      this.updateCamera(rawDelta, false);
      this.recordNavigationDiagnostics();
      this.performanceMonitor.update(time, this.activeZombieCount);
      return;
    }

    const timeScale = this.commandPanel.isOpen() ? 0.25 : 1;
    const deltaMs = this.hitStop.consume(Math.min(rawDelta, 50) * timeScale);
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
    this.updateProjectiles(deltaSeconds);
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
    this.updateWeaponCrosshair(false);

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
      structures: this.minimapStructureSources,
      structureRevision: this.structureRegistry.revision,
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
    this.meleeAction.cancel();
    this.hitStop.clear();
    this.weaponAccuracy.bloomRadians = 0;
    this.weaponAccuracy.lastShotAt = -10_000;
    this.weaponMovementAccuracy = "stationary";
    this.projectileBloodKeys.clear();
    this.projectileBloodOrder.length = 0;
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
    this.structureRegistry.clear();
    this.structureStorage.clear();
    this.minimapStructureSources.length=0;
    this.demolitionConfirmUntil.clear();
    this.structureViews.clear();
    this.turretRuntime.clear();
    this.turretTargetScratch.length = 0;
    this.craftingStations.clear();
    this.activeCraftingStationId = undefined;
    clearWallDrag(this.wallDrag);
    this.pendingBuildPlacement = undefined;
    this.buildStartAnchor = undefined;
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

  private restoreStructure(state: SavedStructureState | PlacedStructureState): void {
    if (!BUILDABLE_DEFINITIONS[state.kind]) return;
    const normalized = normalizePlacedStructure({ ...state, powered: false }); const definition = BUILDABLE_DEFINITIONS[normalized.kind];
    if (normalized.placement.kind === "furniture") {
      const size=definition.furnitureSize!;const bounds=getObbAabb({x:normalized.placement.x,y:normalized.placement.y,angle:normalized.placement.angle,halfWidth:size.width/2,halfHeight:size.height/2});
      if(bounds.minX<0||bounds.minY<0||bounds.maxX>WORLD_WIDTH||bounds.maxY>WORLD_HEIGHT)return;
      this.collision.addDynamicFurniture(normalized.id,{x:normalized.placement.x,y:normalized.placement.y,angle:normalized.placement.angle,halfWidth:size.width/2,halfHeight:size.height/2},{blocksMovement:definition.blocksMovement,blocksProjectiles:definition.blocksProjectiles});
    } else if (normalized.placement.kind === "footprint") {
      const footprint = getRotatedStructureFootprint(normalized.kind, normalized.placement.rotation);
      if (normalized.tileX < 0 || normalized.tileY < 0 || normalized.tileX + footprint.width > this.map.widthTiles || normalized.tileY + footprint.height > this.map.heightTiles) return;
      this.collision.addDynamicObstacle({ id: normalized.id, tileX: normalized.tileX, tileY: normalized.tileY, widthTiles: footprint.width, heightTiles: footprint.height, blocksMovement: definition.blocksMovement, blocksVision: definition.blocksVision, blocksProjectiles: definition.blocksProjectiles, coverHeight: normalized.kind === "wood-crate" ? "low" : "low", kind: "furniture" });
    } else {
      const placement = normalized.placement; const segment = definition.segment!;
      if ([placement.startX, placement.startY, placement.endX, placement.endY].some((value) => value < 0) || Math.max(placement.startX, placement.endX) > WORLD_WIDTH || Math.max(placement.startY, placement.endY) > WORLD_HEIGHT) return;
      this.collision.addDynamicSegment(normalized.id, { ...placement, thickness: segment.thickness }, { blocksMovement: definition.blocksMovement, blocksVision: definition.blocksVision, blocksProjectiles: definition.blocksProjectiles });
      if (normalized.kind === "wood-door" && normalized.doorOpen) this.collision.setDynamicSegmentActive(normalized.id, false);
    }
    normalized.powered = false;
    this.structures.push(normalized); this.structureRegistry.register(normalized);
    this.structureViews.set(normalized.id, normalized.kind === "wood-wall" || normalized.kind === "metal-wall" ? this.structureChunks.add(normalized) : new StructureView(this, normalized));
    this.minimapStructureSources.push({id:normalized.id,position:getPlacedStructureCenter(normalized),kind:normalized.kind});
    if (normalized.kind === "wood-crate") this.structureStorage.set(normalized.id, new WorldStorageContainer(`structure:${normalized.id}:storage`, 8, 6, normalized.storage));
    if (definition.craftingStationKind) { const position = getPlacedStructureCenter(normalized); this.craftingStations.register({ id: normalized.id, kind: definition.craftingStationKind, ...position }); }
    if (normalized.kind === "turret") this.turretRuntime.set(normalized.id, { nextScanAt: 0, nextFireAt: 0 });
    this.structureCounter += 1;
  }

  private registerStructureObject(state: PlacedStructureState): void {
    const view = this.structureViews.get(state.id);
    if (!view || this.worldObjects.get(state.id)) return;
    const definition = BUILDABLE_DEFINITIONS[state.kind]; const position = getPlacedStructureCenter(state);
    const isCraftingStation = Boolean(definition.craftingStationKind);
    this.worldObjects.register(this.makeWorldObject(state.id, isCraftingStation ? "crafting-station" : state.kind === "wood-crate" ? "container" : "power-structure", view, () => position, () => true, {
      range: definition.interactionRange, requiresLineOfSight: true, selectionPriority: isCraftingStation || state.kind === "wood-door" || state.kind === "wood-crate" ? 16 : 10, isEnabled: () => true,
      getPrompt: () => isCraftingStation ? `[E] ${definition.name}에서 제작 · [Shift+E] 관리` : state.kind === "wood-door" ? `[E] 목재 문 ${state.doorOpen ? "닫기" : "열기"} · [Shift+E] 관리` : state.kind === "wood-crate" ? `[E] 목재 보관함 · [Shift+E] 관리` : `[E] ${definition.name} 상태 · [Shift+E] 관리`, execute: () => isCraftingStation && !this.keys.run.isDown ? this.openCraftingAtStation(state.id) : this.interactWithStructure(state),
    }));
  }

  private interactWithStructure(state: PlacedStructureState): void {
    if (this.keys.run.isDown) { this.manageStructure(state); return; }
    if (state.kind === "wood-door") { state.doorOpen = !state.doorOpen; this.collision.setDynamicSegmentActive(state.id, !state.doorOpen); this.structureViews.get(state.id)?.refresh?.(); this.fogInvalidation.invalidate(); this.hud.showMessage(`목재 문을 ${state.doorOpen ? "열었습니다" : "닫았습니다"}.`); return; }
    if (state.kind === "wood-crate") { const storage=this.structureStorage.get(state.id);if(storage){this.closeBuildMode();this.worldStoragePanel.show(storage);} return; }
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
    else if (state.kind === "battery-bank") this.hud.showMessage(`축전지 · 저장 ${Math.floor(state.storedEnergy)}/240`);
  }

  private openCraftingAtStation(stationId: string): void {
    this.closeBuildMode();
    this.activeCraftingStationId = stationId;
    this.minimap.hide(); this.commandPanel.hide(); this.pendingCompanionCommand = undefined;
    this.inventoryPanel.showCrafting(this.getInventoryPanelState(stationId));
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
      build: "B",
      buildGrid: "G",
    }) as unknown as WorldKeys;
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.audio.unlockAndStartBgm();
      if ((pointer.button !== 0 && pointer.button !== 2) || this.inventoryPanel?.isOpen() || this.worldStoragePanel?.isOpen() || this.pauseMenu?.isOpen() || this.minimap?.isFull()) return;
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y, this.pointerWorldSnapshot);
      this.player.aimAngle = Math.atan2(world.y - this.player.position.y, world.x - this.player.position.x);
      if (this.pendingBuildPlacement) {
        if (pointer.button === 2) { this.cancelBuildPlacement(); return; }
        if (pointer.button === 0 && this.isPendingWallChain()) this.startWallDrag(world);
        else if (pointer.button === 0) this.confirmBuildPlacement(world);
        return;
      }
      if (pointer.button === 0 && this.pendingCompanionCommand) {
        this.applyPendingCompanionCommand(world);
        return;
      }
      if (this.commandPanel?.isOpen() || !this.player.equippedWeapon) return;
      if (isMeleeWeaponId(this.player.equippedWeapon)) {
        if (pointer.button === 0) this.meleeAction.pressPrimary(this.simulationTime, this.player.aimAngle, this.player.equippedWeapon);
        else this.tryStartMeleeSwing(this.player.equippedWeapon);
      } else if (pointer.button === 0) this.tryPlayerAttack();
    });
    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      if (pointer.button === 0 && this.wallDrag.active) { this.finishWallDrag("commit"); return; }
      if (pointer.button !== 0 || !isMeleeWeaponId(this.player.equippedWeapon)) return;
      if (this.meleeAction.state.phase !== "charging") return;
      const mode = this.simulationTime - this.meleeAction.state.pressedAt >= MELEE_INPUT_BALANCE.heavyThresholdMs ? "heavy" : "stab";
      if (this.meleeAction.releasePrimary(this.simulationTime, this.player.survivalNeeds.stamina)) this.commitMeleeStamina(mode);
      else this.showMeleeStaminaFailure(mode);
    });
    this.game.canvas.addEventListener("contextmenu", this.preventCanvasContextMenu);
    window.addEventListener("pointerup", this.handleWindowBuildPointerUp);
    this.game.canvas.addEventListener("pointercancel", this.handleBuildPointerCancel);
    this.game.canvas.addEventListener("lostpointercapture", this.handleBuildPointerCancel);
    keyboard.on("keydown",()=>this.audio.unlockAndStartBgm());
  }

  private createUi(): void {
    const parent = document.querySelector<HTMLElement>("#app");
    if (!parent) throw new Error("Game root missing");
    this.uiRoot = document.createElement("div");
    this.uiRoot.className = "game-ui-root";
    parent.append(this.uiRoot);
    this.crosshair = new WeaponCrosshair(parent, this.game.canvas);
    this.hud = new Hud(this.uiRoot);
    this.dayAnnouncement = new DayAnnouncement(this.uiRoot);
    this.minimap = new MinimapPanel(this.uiRoot, this.map, this.fog);
    this.inventoryPanel = new InventoryPanel(this.uiRoot, {
      onClose: () => { this.activeCraftingStationId = undefined; this.inventoryPanel.hide(); },
      onCraft: (recipeId) => this.craft(recipeId),
      onUseItem: (instanceId) => this.useInventoryItem(instanceId),
      onStartBuildPlacement:(intent)=>this.startBuildPlacement(intent),
      onDropItem: (instanceId) => this.dropInventoryItem(instanceId),
      onAssignQuickslot: (instanceId, quickslot) => this.assignQuickslot(instanceId, quickslot),
      onMoveItem: (instanceId, target) => { const success = this.inventory.moveItem(instanceId, target); this.refreshInventoryPanel(); return success; },
      onRotateItem: (instanceId) => this.rotateInventoryItem(instanceId),
      canPlaceItem: (instanceId, target) => this.inventory.canPlace(instanceId, target),
      onEquipItem: (instanceId) => this.equipInventoryItem(instanceId),
      onUnequipItem: (slot) => this.unequipInventoryItem(slot),
      canEquipItemToSlot: (instanceId, slot) => this.inventory.canEquipToSlot(instanceId, slot),
      onEquipItemToSlot: (instanceId, slot) => { const success = this.inventory.equipToSlot(instanceId, slot); if (success) this.audio.play(slot === "backpack" ? "equip-backpack" : "equip-clothing"); this.refreshInventoryPanel(); return success; },
      canEquipWeapon: (instanceId, slot) => this.inventory.canEquipWeapon(instanceId, slot),
      onEquipWeapon: (instanceId, slot) => this.equipWeapon(instanceId, slot),
      onUnequipWeapon: (slot) => this.unequipWeapon(slot),
      onActivateWeapon: (slot) => this.activateWeapon(slot),
      canUnequipItemToGrid: (slot, instanceId, target) => this.inventory.canUnequipItemToGrid(slot, instanceId, target).success,
      onUnequipItemToGrid: (slot, instanceId, target) => {
        const result = this.inventory.unequipItemToGrid(slot, instanceId, target);
        if (result.success) { this.audio.play("unequip-clothing"); this.hud.showMessage("장비를 인벤토리로 옮겼습니다."); }
        else this.hud.showMessage(result.reason === "storage-not-empty" ? "장비 수납공간을 먼저 비워야 합니다." : result.reason === "own-storage" ? "장비를 자기 수납공간에 넣을 수 없습니다." : "이 위치에는 장비를 놓을 수 없습니다.");
        this.refreshInventoryPanel(); return result.success;
      },
      canUnequipWeaponToGrid: (slot, instanceId, target) => this.inventory.canUnequipWeaponToGrid(slot, instanceId, target).success,
      onUnequipWeaponToGrid: (slot, instanceId, target) => {
        const result = this.inventory.unequipWeaponToGrid(slot, instanceId, target);
        if (result.success) { this.syncEquippedWeaponFromInventory(); this.hud.showMessage("무기를 인벤토리로 옮겼습니다."); }
        else this.hud.showMessage("이 위치에는 무기를 놓을 수 없습니다.");
        this.refreshInventoryPanel(); return result.success;
      },
      onAudio: (cue) => { this.audio.play(cue); },
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
      onZombieSpawningChange: (enabled) => this.setZombieSpawningEnabled(enabled),
      onGrantCompendiumEntry: (entry) => this.grantCompendium(entry),
      getCompendiumState: () => ({ developerMode: this.settings.developerMode, count: (entry) => this.inventory.count(entry.sourceId) }),
      onUiSound:()=>this.audio.play("ui"),
    });
    this.pauseMenu.setDeveloperMode(this.settings.developerMode);
    this.pauseMenu.setZombieSpawningEnabled(this.settings.zombieSpawningEnabled);
    this.worldStoragePanel = new WorldStoragePanel(this.uiRoot,this.inventory,()=>{this.refreshInventoryPanel();this.saveGame(false);});
    this.buildPreview = this.add.graphics().setDepth(DEPTH.effectWorld - 10);
  }

  private handlePanelKeys(): void {
    if(this.worldStoragePanel?.isOpen()){if(Phaser.Input.Keyboard.JustDown(this.keys.pause)||Phaser.Input.Keyboard.JustDown(this.keys.inventory))this.worldStoragePanel.hide();return;}
    if (Phaser.Input.Keyboard.JustDown(this.keys.build) && !this.inventoryPanel.isOpen() && !this.pauseMenu.isOpen() && !this.minimap.isFull()) {
      this.commandPanel.hide(); this.pendingCompanionCommand = undefined;
      this.cancelBuildPlacement();
      this.inventoryPanel.showBuild(this.getInventoryPanelState());
    }
    if (this.pendingBuildPlacement && Phaser.Input.Keyboard.JustDown(this.keys.reload)) { rotatePendingBuildPlacement(this.pendingBuildPlacement); if(this.wallDrag.active){this.wallDrag.direction=this.pendingBuildPlacement.rotation;this.refreshWallDragPreview(this.pointerWorldSnapshot);} }
    if(this.pendingBuildPlacement&&Phaser.Input.Keyboard.JustDown(this.keys.buildGrid)){if(toggleFurniturePlacementMode(this.pendingBuildPlacement))this.hud.showMessage(`가구 배치: ${this.pendingBuildPlacement.placementMode==="free"?"자유":"격자"}`);else this.hud.showMessage("구조물은 격자 배치만 지원합니다.");}
    if (this.minimap.isVisible()) {
      if (Phaser.Input.Keyboard.JustDown(this.keys.pause)) {
        this.minimap.hide();
        return;
      }
      if (Phaser.Input.Keyboard.JustDown(this.keys.map)) {
        this.closeBuildMode();
        this.minimap.cycleMode();
        return;
      }
      if (this.minimap.isFull()) return;
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.inventory) && !this.pauseMenu.isOpen()) {
      this.closeBuildMode();
      if (this.inventoryPanel.isOpen()) this.inventoryPanel.hide();
      else {
        this.minimap.hide();
        this.commandPanel.hide();
        this.pendingCompanionCommand = undefined;
        this.activeCraftingStationId = undefined;
        this.inventoryPanel.show(this.getInventoryPanelState());
      }
    }
    if (Phaser.Input.Keyboard.JustDown(this.keys.pause)) {
      if(this.pendingBuildPlacement){this.cancelBuildPlacement();return;}
      if (this.inventoryPanel.isOpen()) return;
      this.audio.play("ui");
      this.commandPanel.hide();
      this.pendingCompanionCommand = undefined;
      this.closeBuildMode();
      if (this.pauseMenu.isOpen()) this.pauseMenu.handleEscape();
      else this.pauseMenu.toggle();
    }
    if (this.inventoryPanel.isOpen() || this.pauseMenu.isOpen()) return;
    if (Phaser.Input.Keyboard.JustDown(this.keys.map)) { this.closeBuildMode();this.minimap.setMode("local"); }
    if (this.pendingBuildPlacement) return;
    if (Phaser.Input.Keyboard.JustDown(this.keys.command)) {
      if (this.rescuedCompanions.length === 0) this.hud.showMessage("먼저 생존자를 구조해야 합니다.");
      else {
        this.pendingCompanionCommand = undefined;
        this.commandPanel.toggle();
      }
    }
  }

  private updatePlayer(deltaSeconds: number): void {
    if (this.player.equippedWeapon && isFirearmId(this.player.equippedWeapon)) recoverWeaponBloom(this.weaponAccuracy, WEAPON_DEFINITIONS[this.player.equippedWeapon], deltaSeconds);
    const pointerAim = Math.atan2(
      this.pointerWorldSnapshot.y - this.player.position.y,
      this.pointerWorldSnapshot.x - this.player.position.x,
    );
    const meleeState = this.meleeAction.state;
    if (meleeState.phase === "idle") this.player.aimAngle = pointerAim;
    else if (meleeState.phase === "charging" || meleeState.phase === "windup") {
      const turnSpeed = meleeState.phase === "charging" ? 2.5 : meleeState.weapon && meleeState.mode ? MELEE_ATTACK_DEFINITIONS[meleeState.weapon][meleeState.mode].turnSpeedRadiansPerSecond : 2.5;
      meleeState.aimAngle = rotateAngleToward(meleeState.aimAngle, pointerAim, turnSpeed * deltaSeconds);
      this.player.aimAngle = meleeState.aimAngle;
    } else this.player.aimAngle = meleeState.aimAngle;

    const meleeAttack = this.meleeAction.update(this.simulationTime);
    if (meleeAttack) this.executeMeleeAttack(meleeAttack.mode, meleeAttack.weapon, meleeAttack.aimAngle, meleeAttack.charge, meleeAttack.sequence);

    if (this.player.reloadingUntil > 0 && this.simulationTime >= this.player.reloadingUntil) this.finishReload();
    if (!this.pendingBuildPlacement && Phaser.Input.Keyboard.JustDown(this.keys.reload)) this.startReload();
    if (!this.pendingBuildPlacement && this.player.equippedWeapon && this.input.activePointer.isDown && this.pointerInsideGame && WEAPON_DEFINITIONS[this.player.equippedWeapon].fireMode === "auto") this.tryPlayerAttack();
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
    speed *= this.meleeAction.getMovementMultiplier();
    if (this.meleeAction.state.phase === "idle" && this.simulationTime - this.player.lastAttackAt < 170) speed *= 0.62;
    const previousX = this.player.position.x;
    const previousY = this.player.position.y;
    const next = this.collision.moveCircle(this.player.position, moveX * speed * deltaSeconds, moveY * speed * deltaSeconds, BALANCE.playerRadius);
    this.player.position = next;
    const movedX = next.x - previousX;
    const movedY = next.y - previousY;
    const movedDistance = Math.hypot(movedX, movedY);
    const actuallyMoved = movedDistance > 0.01;
    const actualRunning = runningRequested && actuallyMoved;
    this.weaponMovementAccuracy = actualRunning ? "running" : actuallyMoved ? "walking" : "stationary";
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

  private tryStartMeleeSwing(weapon: "knife" | "bat"): void {
    if (this.meleeAction.pressSecondary(this.simulationTime, this.player.aimAngle, weapon, this.player.survivalNeeds.stamina)) this.commitMeleeStamina("swing");
    else if (this.meleeAction.state.phase === "idle") this.showMeleeStaminaFailure("swing");
  }

  private commitMeleeStamina(mode: MeleeAttackMode): void {
    const weapon = this.meleeAction.state.weapon;
    if (!weapon) return;
    this.player.survivalNeeds.stamina = Math.max(0, this.player.survivalNeeds.stamina - MELEE_ATTACK_DEFINITIONS[weapon][mode].staminaCost);
    this.player.lastAttackAt = this.simulationTime;
  }

  private showMeleeStaminaFailure(mode: MeleeAttackMode): void {
    if (!isMeleeWeaponId(this.player.equippedWeapon)) return;
    if (this.player.survivalNeeds.stamina < MELEE_ATTACK_DEFINITIONS[this.player.equippedWeapon][mode].staminaCost) this.hud.showMessage("기력이 부족합니다.", 900);
  }

  private cancelMeleeAction(): void {
    this.meleeAction.cancel();
  }

  private executeMeleeAttack(mode: MeleeAttackMode, weaponId: "knife" | "bat", aimAngle: number, charge: number, sequence: number): void {
    const attack = mode === "heavy" ? getChargedMeleeDefinition(weaponId, charge) : MELEE_ATTACK_DEFINITIONS[weaponId][mode];
    const sweepDirection: -1 | 1 = sequence % 2 === 0 ? -1 : 1;
    const hits = collectMeleeTargets(this.player.position, aimAngle, attack, this.zombies, (origin, target) => this.collision.hasLineOfSight(origin, target), this.meleeTargetScratch);
    const impacts: AttackEffectImpact[] = [];
    this.meleeHitTracker.begin(sequence);
    let postureBroken = false;
    for (const hit of hits) {
      const zombie = hit.target as Zombie;
      if (!this.meleeHitTracker.tryHit(zombie.id)) continue;
      const direction = normalize({ x: zombie.position.x - this.player.position.x, y: zombie.position.y - this.player.position.y });
      const alreadyBroken = zombie.posture.staggerUntil > this.simulationTime;
      const damageBonus = mode === "heavy" && alreadyBroken ? MELEE_INPUT_BALANCE.postureBrokenDamageBonus : 1;
      const damage = attack.damage * hit.multiplier * damageBonus;
      impacts.push({ x: zombie.position.x, y: zombie.position.y, kind: "zombie" });
      const killed = this.damageZombie(zombie, damage, { x: direction.x * attack.knockback, y: direction.y * attack.knockback }, { kind: `melee-${mode}`, hitX: zombie.position.x, hitY: zombie.position.y, directionX: direction.x, directionY: direction.y, weaponId, sequence: ++this.ambientEffectSequence });
      if (!killed) {
        const posture = zombie.damagePosture(attack.postureDamage * hit.multiplier, this.simulationTime);
        if (posture.broken) {
          postureBroken = true;
          this.effects.emitPixelDebris("posture", zombie.position.x, zombie.position.y, aimAngle, sequence, this.simulationTime);
          if (weaponId === "bat" && mode === "heavy") this.effects.emitPixelDebris("bat-ground", zombie.position.x, zombie.position.y + 4, aimAngle, sequence, this.simulationTime);
          const breakDistance = zombie.kind === "runner" ? 10 : 13;
          zombie.position = this.collision.moveCircle(zombie.position, direction.x * breakDistance, direction.y * breakDistance, BALANCE.zombieRadius);
          this.audio.playForEvent("posture-break", sequence, { source: zombie.position, listener: this.player.position });
          this.cameraFeedback.request("posture-break", this.simulationTime);
        }
      }
    }
    this.noise.emit({ x: this.player.position.x, y: this.player.position.y, intensity: WEAPON_DEFINITIONS[weaponId].noise, category: "melee", createdAt: this.simulationTime });
    this.attackEffects.play({ weapon: weaponId, originX: this.player.position.x, originY: this.player.position.y, angle: aimAngle, startedAt: this.simulationTime, impacts, alwaysShowCore: true, meleeMode: mode, meleeRange: attack.range, meleeArcRadians: attack.arcRadians, sweepDirection });
    this.player.beginAttack(this.simulationTime, mode, attack.activeMs + Math.min(attack.recoveryMs, 160), sweepDirection);
    this.audio.playForEvent(impacts.length > 0 ? "melee-hit" : "melee-swing", sequence, { source: this.player.position, listener: this.player.position, volumeScale: mode === "heavy" ? 1.2 : mode === "stab" ? 0.82 : 1 });
    const feedback: CameraFeedbackEvent = mode === "stab" ? (impacts.length ? "melee-stab-hit" : "melee-stab-miss") : mode === "swing" ? (impacts.length ? "melee-swing-hit" : "melee-swing-miss") : (impacts.length ? "melee-heavy-hit" : "melee-heavy-miss");
    this.cameraFeedback.request(feedback, this.simulationTime);
    if (impacts.length > 0) this.hitStop.request(postureBroken ? 65 : attack.hitStopMs);
  }

  private tryPlayerAttack(): void {
    if (!this.player.equippedWeapon) return;
    const weapon = WEAPON_DEFINITIONS[this.player.equippedWeapon];
    if (weapon.kind === "melee") return;
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
    if (!isFirearmId(weapon.id)) return;
    const shot = this.attackEffects.play({ weapon: weapon.id, originX: this.player.position.x, originY: this.player.position.y, angle: this.player.aimAngle, startedAt: this.simulationTime, impacts: [], alwaysShowCore: true });
    const spread = getEffectiveWeaponSpread(weapon, this.weaponAccuracy, this.weaponMovementAccuracy);
    const pelletCount = weapon.pelletCount ?? 1;
    for (let pelletIndex = 0; pelletIndex < pelletCount; pelletIndex += 1) {
      const angle = deterministicProjectileAngle(this.player.aimAngle, spread, shot.sequence, pelletIndex, pelletCount);
      this.spawnProjectile("player", this.player.id, weapon.id, this.player.position, angle, shot.sequence, pelletIndex);
    }
    recordWeaponShot(this.weaponAccuracy, weapon, this.simulationTime);
    playFirearmShotForEvent(this.audio,weapon.id,shot.sequence,{source:this.player.position,listener:this.player.position});
    this.player.beginAttack(this.simulationTime);
    const feedbackEvent:CameraFeedbackEvent=weapon.id==="smg"?"smg-shot":weapon.id==="shotgun"?"shotgun-shot":weapon.id==="hunting_rifle"?"rifle-shot":"pistol-shot";
    this.cameraFeedback.request(feedbackEvent,this.simulationTime);
  }

  private spawnProjectile(team: ProjectileTeam, ownerId: string, weaponId: ProjectileWeaponId, origin: Point, angle: number, shotSequence: number, pelletIndex: number): void {
    const weapon = WEAPON_DEFINITIONS[weaponId === "turret" ? "pistol" : weaponId];
    const pelletCount = weaponId === "shotgun" ? weapon.pelletCount ?? 1 : 1;
    const offset = weaponId === "turret" ? 13 : 7;
    this.projectiles.spawn({
      team, ownerId, weaponId, shotSequence, pelletIndex, angle,
      x: origin.x + Math.cos(angle) * offset, y: origin.y + Math.sin(angle) * offset,
      speed: weaponId === "turret" ? 1200 : weapon.projectileSpeed ?? 1100,
      maximumDistance: weaponId === "turret" ? TURRET_RANGE : weapon.range,
      damage: weaponId === "turret" ? TURRET_DAMAGE : weapon.damage,
      postureDamage: (weaponId === "turret" ? TURRET_DAMAGE : weapon.damage) * 0.22,
      knockback: (weaponId === "turret" ? 5 : weapon.knockback) / pelletCount,
      collisionRadius: weapon.projectileRadius ?? 1,
      visualLength: weaponId === "turret" ? 5 : weapon.projectileVisualLength ?? 5,
      visualWidth: weapon.projectileVisualWidth ?? 1,
      now: this.simulationTime,
    });
  }

  private updateProjectiles(deltaSeconds: number): void {
    for (let index = 0; index < this.zombies.length; index += 1) {
      const zombie = this.zombies[index]!;
      const target = this.projectileTargets[index];
      if (target) { target.id = zombie.id; target.position = zombie.position; target.alive = zombie.isAlive(); }
      else this.projectileTargets.push({ id: zombie.id, position: zombie.position, radius: BALANCE.zombieRadius, alive: zombie.isAlive(), team: "zombie" });
    }
    this.projectileTargets.length = this.zombies.length;
    this.projectiles.update(deltaSeconds, {
      targets: this.projectileTargets,
      firstWorldHit: (from, to) => {
        const hit = this.collision.firstProjectileCollisionAlongSegment(from, to);
        return hit ? { ...hit, material: this.getProjectileImpactMaterial(hit.point) } : null;
      },
      onImpact: (impact) => this.handleProjectileImpact(impact),
    });
  }

  private handleProjectileImpact(impact: ProjectileImpact): void {
    const projectile = impact.projectile;
    const directionLength = Math.max(1, Math.hypot(projectile.velocityX, projectile.velocityY));
    const direction = { x: projectile.velocityX / directionLength, y: projectile.velocityY / directionLength };
    if (impact.type === "world") {
      this.effects.emitPixelDebris(impact.material === "metal" ? "metal" : impact.material === "wood" ? "wood" : "wall", impact.point.x, impact.point.y, Math.atan2(direction.y, direction.x), projectile.shotSequence, this.simulationTime);
      return;
    }
    const zombie = impact.target ? this.zombies.find((candidate) => candidate.id === impact.target!.id) : undefined;
    if (!zombie?.isAlive()) return;
    const bloodKey = `${projectile.shotSequence}:${zombie.id}`;
    const firstBloodForShot = !this.projectileBloodKeys.has(bloodKey);
    if (firstBloodForShot) {
      this.projectileBloodKeys.add(bloodKey); this.projectileBloodOrder.push(bloodKey);
      if (this.projectileBloodOrder.length > 256) this.projectileBloodKeys.delete(this.projectileBloodOrder.shift()!);
    }
    const impactContext = firstBloodForShot ? { kind: "projectile" as const, hitX: impact.point.x, hitY: impact.point.y, directionX: direction.x, directionY: direction.y, weaponId: projectile.weaponId === "turret" ? "pistol" as const : projectile.weaponId, sequence: projectile.shotSequence } : undefined;
    const killed = this.damageZombie(zombie, projectile.damage, { x: direction.x * projectile.knockback, y: direction.y * projectile.knockback }, impactContext);
    if (!killed) {
      const posture = zombie.damagePosture(projectile.postureDamage, this.simulationTime);
      if (posture.broken) this.effects.emitPixelDebris("posture", zombie.position.x, zombie.position.y, 0, projectile.shotSequence, this.simulationTime);
    }
    if (projectile.team === "player") this.crosshair.registerHit(projectile.shotSequence, this.simulationTime);
  }

  private getProjectileImpactMaterial(point: Point): "wall" | "metal" | "wood" {
    const tileX = Math.floor(point.x / TILE_SIZE);
    const tileY = Math.floor(point.y / TILE_SIZE);
    for (const obstacle of this.map.obstacles) {
      if (tileX < obstacle.tileX || tileY < obstacle.tileY || tileX >= obstacle.tileX + obstacle.widthTiles || tileY >= obstacle.tileY + obstacle.heightTiles) continue;
      return obstacle.kind === "vehicle" ? "metal" : obstacle.kind === "barricade" ? "wood" : "wall";
    }
    if (this.map.doors.some((door) => door.tileX === tileX && door.tileY === tileY)) return "wood";
    if (this.structures.some((structure) => structure.tileX === tileX && structure.tileY === tileY)) return "metal";
    return "wall";
  }

  private updateWeaponCrosshair(forceBlocked: boolean): void {
    if (!this.crosshair) return;
    const pointer = this.input.activePointer;
    const bounds = this.game.canvas.getBoundingClientRect();
    const x = bounds.left + pointer.x / Math.max(1, this.scale.width) * bounds.width;
    const y = bounds.top + pointer.y / Math.max(1, this.scale.height) * bounds.height;
    const weapon = this.player.equippedWeapon ? WEAPON_DEFINITIONS[this.player.equippedWeapon] : undefined;
    const ranged = Boolean(weapon && weapon.kind === "ranged");
    const spread = weapon ? getEffectiveWeaponSpread(weapon, this.weaponAccuracy, this.weaponMovementAccuracy) : 0;
    this.crosshair.update({
      x, y, spreadRadians: spread, ranged, pointerInsideGame: this.pointerInsideGame,
      windowFocused: document.hasFocus(),
      blocked: forceBlocked || this.gameEnded || Boolean(this.pendingBuildPlacement) || this.inventoryPanel.isOpen() || this.worldStoragePanel.isOpen() || this.pauseMenu.isOpen() || this.commandPanel.isOpen() || this.minimap.isFull(),
      now: this.simulationTime,
    });
  }

  private damageZombie(zombie: Zombie, damage: number, knockback: Point, impact?:Omit<DamageImpactContext,"damage"|"killed">): boolean {
    const kind: ZombieKnockbackKind = impact?.kind.startsWith("melee") ? "melee" : "ranged";
    const killed = zombie.damage(damage, getFinalZombieKnockback(knockback, damage, kind), this.simulationTime);
    if(impact)this.effects.emitDirectionalBlood({...impact,damage,killed},this.simulationTime);
    if (!impact?.kind.startsWith("melee") || killed) this.audio.play(killed?"zombie-death":"zombie-hit",{source:zombie.position,listener:this.player.position});
    if (killed && this.rng.chance(0.28)) {
      const itemId = this.rng.chance(0.45) ? "pistol_ammo" : "cloth";
      this.spawnDrop(itemId, 1, zombie.position.x, zombie.position.y);
    }
    return killed;
  }

  private updateZombieAudio():void{
    if(this.simulationTime<this.nextZombieGrowlAt)return;
    this.nextZombieGrowlAt=this.simulationTime+5_500;
    let closest:Zombie|undefined;let closestSquared=Infinity;
    for(const zombie of this.zombies){if(!zombie.isAlive()||this.isZombieDormant(zombie))continue;const dx=zombie.position.x-this.player.position.x,dy=zombie.position.y-this.player.position.y;const candidate=dx*dx+dy*dy;if(candidate<closestSquared){closest=zombie;closestSquared=candidate;}}
    if(closest)this.audio.play("zombie-growl",{source:closest.position,listener:this.player.position});
  }

  private startReload(): void {
    if (!this.player.equippedWeapon || !isFirearmId(this.player.equippedWeapon) || this.player.reloadingUntil > 0) return;
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
    if (!this.player.equippedWeapon || !isFirearmId(this.player.equippedWeapon)) { this.player.reloadingUntil = 0; return; }
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
    if (!canSpawnZombies(this.zombieSpawnToggle)) {
      this.zombies = [];
      this.activeZombieCount = 0;
      return;
    }
    if (saved) {
      saved.consumedZombieSpawnIds.forEach((id) => this.consumedZombieSpawnIds.add(id));
      this.zombies = saved.zombies.map((state) => {
        const zombie = new Zombie(this, state.id, state.kind, state, state.state);
        const healthRatio = state.maxHealth && state.maxHealth > 0 ? state.health / state.maxHealth : undefined;
        zombie.health = Math.max(0, Math.min(zombie.definition.health, healthRatio === undefined ? state.health : zombie.definition.health * healthRatio));
        zombie.mind.visualLock = state.visualLock ?? false;
        zombie.mind.currentTargetId = state.currentTargetId;
        zombie.mind.lastSeenAt = state.lastSeenAt ?? 0;
        zombie.posture.value = Math.max(0, Math.min(zombie.posture.maximum, state.postureValue ?? zombie.posture.maximum));
        zombie.posture.recoveryStartsAt = this.simulationTime + Math.max(0, state.postureRecoveryRemainingMs ?? 0);
        zombie.posture.staggerUntil = this.simulationTime + Math.max(0, state.postureStaggerRemainingMs ?? 0);
        zombie.posture.breakImmunityUntil = this.simulationTime + Math.max(0, state.postureBreakImmunityRemainingMs ?? 0);
        if ((state.postureStaggerRemainingMs ?? 0) > 0) { zombie.staggerUntil = zombie.posture.staggerUntil; zombie.mind = { ...zombie.mind, state: "Stagger" }; }
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
      zombie.updatePosture(this.simulationTime, deltaSeconds);
      if (this.isZombieDormant(zombie) && !zombie.mind.visualLock) {
        zombie.view.setVisible(false);
        return;
      }
      if (this.minimapZombieSources.length < BALANCE.maxActiveZombies) this.minimapZombieSources.push(zombie);
      this.activeZombieCount += 1;
      if (zombie.mind.state === "Stagger" && this.simulationTime >= zombie.staggerUntil) {
        zombie.mind = { ...zombie.mind, state: "Chase" };
      }
      if (zombie.mind.state === "AttackObstacle" && this.updateZombieObstacleAttack(zombie, deltaSeconds)) {
        zombie.updateView(time, this.fog.getStateAtWorld(zombie.position.x, zombie.position.y) === VisibilityState.Visible);
        return;
      }
      const gaitMultiplier = updateZombieGait(zombie.organic, zombie.id, zombie.kind, zombie.mind.state, this.simulationTime);
      zombie.motion.desiredSpeed = 0;
      let motionUpdated = false;
      const readyReaction = zombie.mind.state !== "Stagger" ? consumeReadyZombieReaction(zombie.organic, this.simulationTime) : undefined;
      if (readyReaction?.kind === "visual") {
        const reactionTarget = targets.find((target) => target.id === readyReaction.targetId && target.alive);
        const stillVisible = Boolean(reactionTarget && this.collision.hasLineOfSight(zombie.position, reactionTarget.position));
        if (reactionTarget && stillVisible) zombie.mind = updateZombieMind(zombie.mind, {
          canSeeTarget: true,
          targetPosition: reactionTarget.position,
          targetId: reactionTarget.id,
          inAttackRange: distance(zombie.position, reactionTarget.position) <= 17,
          nowMs: this.simulationTime,
        });
        else zombie.mind = {
          ...zombie.mind,
          state: "SearchLastKnownPosition",
          lastSeenTargetPosition: { x: readyReaction.stimulusX, y: readyReaction.stimulusY },
          searchTicks: 2,
        };
      } else if (readyReaction?.kind === "noise") {
        zombie.mind = updateZombieMind(zombie.mind, {
          canSeeTarget: false,
          nowMs: this.simulationTime,
          heardNoise: {
            x: readyReaction.stimulusX,
            y: readyReaction.stimulusY,
            category: readyReaction.noiseCategory ?? "door",
            perceivedIntensity: readyReaction.stimulusStrength,
            intensity: readyReaction.stimulusStrength,
            distance: readyReaction.stimulusDistance,
            radius: Math.max(1, readyReaction.stimulusDistance * 2),
            createdAt: readyReaction.startedAt,
          },
        });
      }
      let perceivedTarget = targets.find((target) => target.id === zombie.mind.currentTargetId);
      if (this.simulationTime >= zombie.nextThinkAt && zombie.mind.state !== "Stagger") {
        const farFromPlayer = distance(zombie.position, this.player.position) > 360;
        zombie.nextThinkAt = this.simulationTime + 220 + (index % 5) * 47 + (farFromPlayer ? 380 : 0);
        const lockedTarget = zombie.mind.visualLock ? targets.find((target) => target.id === zombie.mind.currentTargetId) : undefined;
        const sightTarget = this.findVisibleZombieTarget(zombie, targets);
        const heardNoise = sightTarget || zombie.mind.visualLock ? undefined : this.noise.loudestHeard(zombie.position.x, zombie.position.y, zombie.definition.hearingMultiplier, this.simulationTime);
        const previousState = zombie.mind.state;
        if (zombie.mind.visualLock) {
          zombie.organic.reaction = undefined;
          const wasVisuallyLocked=zombie.mind.visualLock,lockedDistanceSquared=lockedTarget?squaredDistance(zombie.position,lockedTarget.position):Number.POSITIVE_INFINITY;
          zombie.mind = updateZombieMind(zombie.mind, {
            canSeeTarget: Boolean(sightTarget),
            targetPosition: sightTarget?.position ?? lockedTarget?.position,
            targetId: sightTarget?.id ?? lockedTarget?.id,
            inAttackRange: sightTarget ? distance(zombie.position, sightTarget.position) <= 17 : lockedTarget ? distance(zombie.position, lockedTarget.position) <= 17 : false,
            nowMs: this.simulationTime,
            targetAlive: lockedTarget?.alive ?? false,
            targetDistanceSquared:lockedDistanceSquared,zombieKind:zombie.kind,zombiePosition:zombie.position,lastDamagedAt:zombie.lastDamagedAt,
          });
          if(wasVisuallyLocked&&!zombie.mind.visualLock){zombie.path.length=0;zombie.pathIndex=0;zombie.nextPathAt=0;zombie.wanderTarget={...zombie.position};if(zombie.obstacleTargetId)this.cancelZombieObstacleTarget(zombie);zombie.organic.reaction=undefined;}
        } else if (sightTarget) {
          beginVisualReaction(
            zombie.organic,
            zombie.id,
            zombie.kind,
            this.simulationTime,
            sightTarget.id,
            sightTarget.position.x,
            sightTarget.position.y,
            distance(zombie.position, sightTarget.position),
            17,
          );
        } else if (heardNoise) {
          beginNoiseReaction(zombie.organic, zombie.id, this.simulationTime, heardNoise);
        } else if (!zombie.organic.reaction) {
          zombie.mind = updateZombieMind(zombie.mind, { canSeeTarget: false, nowMs: this.simulationTime });
        }
        perceivedTarget = sightTarget ?? targets.find((target) => target.id === zombie.mind.currentTargetId);
        if (zombie.kind === "runner" && zombie.mind.visualLock && previousState !== "Chase" && previousState !== "Attack") {
          zombie.chargeReadyAt = this.simulationTime + 360;
        }
      }

      const attackTarget = perceivedTarget ?? targets.find((target) => target.id === zombie.mind.currentTargetId);
      const reaction = zombie.organic.reaction;
      if (attackTarget) zombie.motion.desiredHeadAngle = Math.atan2(attackTarget.position.y - zombie.position.y, attackTarget.position.x - zombie.position.x);
      else if (reaction) zombie.motion.desiredHeadAngle = Math.atan2(reaction.stimulusY - zombie.position.y, reaction.stimulusX - zombie.position.x);
      if (reaction) {
        zombie.motion.desiredSpeed = zombie.definition.speed * 0.15;
      } else if (zombie.mind.state === "Attack" && attackTarget) this.updateZombieAttack(zombie, attackTarget);
      else {
        zombie.biteCompletesAt = 0;
        const goal = this.getZombieGoal(zombie, attackTarget);
        if (goal && this.simulationTime >= zombie.chargeReadyAt && zombie.mind.state !== "Stagger") {
          this.moveZombieToward(zombie, goal, deltaSeconds, index, gaitMultiplier);
          motionUpdated = true;
        }
      }
      if (!motionUpdated) {
        const profile = zombie.kind === "runner" ? RUNNER_MOTION_PROFILE : WALKER_MOTION_PROFILE;
        updateActorMotionSmoothing(zombie.motion, profile, deltaSeconds, zombie.organic.blockedSince > 0 ? 1.5 : 1);
        if (reaction && zombie.motion.currentSpeed > 0.5) {
          zombie.position = this.collision.moveCircle(
            zombie.position,
            Math.cos(zombie.motion.currentMoveAngle) * zombie.motion.currentSpeed * deltaSeconds,
            Math.sin(zombie.motion.currentMoveAngle) * zombie.motion.currentSpeed * deltaSeconds,
            BALANCE.zombieRadius,
          );
        }
      }
      if (zombie.chargeReadyAt > this.simulationTime && this.fog.getStateAtWorld(zombie.position.x, zombie.position.y) === VisibilityState.Visible) {
        drawPixelRing(this.telegraphGraphics, zombie.position.x, zombie.position.y, 11, 0xb74f43, 0.85, 2);
      }
      zombie.aimAngle = zombie.motion.headAngle;
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

  private moveZombieToward(zombie: Zombie, goal: Point, deltaSeconds: number, zombieIndex: number, gaitMultiplier: number): void {
    if (zombie.pathNavigationRevision !== this.collision.navigationRevision) {
      zombie.path = []; zombie.pathIndex = 0; zombie.pathNavigationRevision = this.collision.navigationRevision;
      zombie.nextPathAt = Math.min(zombie.nextPathAt, this.simulationTime + (zombieIndex % 4) * 20);
    }
    const direct = this.collision.canTraverseCircle(zombie.position, goal, BALANCE.zombieRadius);
    if (direct) {
      zombie.path = [{ x: goal.x, y: goal.y }]; zombie.pathIndex = 0; zombie.pathNavigationRevision = this.collision.navigationRevision;
    } else if (this.simulationTime >= zombie.nextPathAt) {
      const farFromPlayer = distance(zombie.position, this.player.position) > 360;
      const nextPath = this.tryFindZombiePath(zombie.position, goal, 650);
      if (nextPath) {
        zombie.nextPathAt = zombie.mind.visualLock
          ? this.simulationTime + 600 + (zombieIndex % 4) * 45
          : this.simulationTime + 650 + (zombieIndex % 5) * 65 + (farFromPlayer ? 500 : 0);
        zombie.path = nextPath;
        zombie.pathIndex = 0;
        zombie.pathNavigationRevision = this.collision.navigationRevision;
      } else {
        zombie.nextPathAt = this.simulationTime + 80 + (zombieIndex % 4) * 20;
      }
    }
    const waypoint = zombie.path[zombie.pathIndex] ?? goal;
    if (distance(zombie.position, waypoint) < 7 && zombie.pathIndex < zombie.path.length - 1) zombie.pathIndex += 1;
    let currentTarget = zombie.path[zombie.pathIndex] ?? goal;
    const zombieTileX=Math.floor(zombie.position.x/TILE_SIZE),zombieTileY=Math.floor(zombie.position.y/TILE_SIZE);
    const builtBlocker=chooseBlockingStructure(zombie.position,currentTarget,this.structureRegistry.queryTiles(zombieTileX-2,zombieTileY-2,zombieTileX+2,zombieTileY+2));
    if(builtBlocker){const attackSlot=getStructureAttackSlot(builtBlocker,zombie.id);zombie.motion.desiredHeadAngle=Math.atan2(getPlacedStructureCenter(builtBlocker).y-zombie.position.y,getPlacedStructureCenter(builtBlocker).x-zombie.position.x);if(distance(zombie.position,attackSlot)<=OBSTACLE_BALANCE.attackRange){zombie.obstacleTargetId=builtBlocker.id;zombie.mind={...zombie.mind,state:"AttackObstacle"};this.updateZombieObstacleAttack(zombie,deltaSeconds);return;}currentTarget=attackSlot;}
    const obstacle = this.destructibles.getBlockingAtTile(
      Math.floor(currentTarget.x / TILE_SIZE),
      Math.floor(currentTarget.y / TILE_SIZE),
    );
    if (obstacle) {
      const obstaclePosition = { x: tileCenter(obstacle.tileX), y: tileCenter(obstacle.tileY) };
      zombie.motion.desiredHeadAngle = Math.atan2(obstaclePosition.y - zombie.position.y, obstaclePosition.x - zombie.position.x);
      if (distance(zombie.position, obstaclePosition) <= OBSTACLE_BALANCE.attackRange) {
        zombie.obstacleTargetId = obstacle.id;
        zombie.mind = { ...zombie.mind, state: "AttackObstacle" };
        this.updateZombieObstacleAttack(zombie, deltaSeconds);
        return;
      }
    }
    const desiredMoveAngle = Math.atan2(currentTarget.y - zombie.position.y, currentTarget.x - zombie.position.x);
    zombie.motion.desiredMoveAngle = desiredMoveAngle;
    if (!zombie.mind.currentTargetId) zombie.motion.desiredHeadAngle = desiredMoveAngle;
    const chaseMultiplier = zombie.mind.state === "Chase" || zombie.mind.visualLock ? ZOMBIE_CHASE_MULTIPLIER[zombie.kind] : 1;
    const sharpCornerScale = Math.abs(motionAngleDifference(desiredMoveAngle, zombie.motion.currentMoveAngle)) >= Math.PI / 2 ? 0.78 : 1;
    zombie.motion.desiredSpeed = zombie.definition.speed * chaseMultiplier * gaitMultiplier * sharpCornerScale * this.clock.getZombieActivityMultiplier();
    const profile = zombie.kind === "runner" ? RUNNER_MOTION_PROFILE : WALKER_MOTION_PROFILE;
    const stuckTurnMultiplier = zombie.organic.blockedSince > 0 && this.simulationTime - zombie.organic.blockedSince >= 180 ? 1.75 : 1;
    updateActorMotionSmoothing(zombie.motion, profile, deltaSeconds, stuckTurnMultiplier);
    const previousX = zombie.position.x;
    const previousY = zombie.position.y;
    const stepDistance = zombie.motion.currentSpeed * deltaSeconds;
    zombie.position = this.collision.moveCircle(
      zombie.position,
      Math.cos(zombie.motion.currentMoveAngle) * stepDistance,
      Math.sin(zombie.motion.currentMoveAngle) * stepDistance,
      BALANCE.zombieRadius,
    );
    const actualDistance = Math.hypot(zombie.position.x - previousX, zombie.position.y - previousY);
    if (stepDistance > 0.2 && actualDistance < stepDistance * 0.15) {
      if (zombie.organic.blockedSince === 0) zombie.organic.blockedSince = this.simulationTime;
      zombie.nextPathAt = Math.min(zombie.nextPathAt, this.simulationTime + 80);
    } else zombie.organic.blockedSince = 0;
    zombie.aimAngle = zombie.motion.headAngle;
    if (distance(zombie.position, goal) < 10 && (zombie.mind.state === "InvestigateNoise" || zombie.mind.state === "SearchLastKnownPosition")) {
      zombie.mind = updateZombieMind(zombie.mind, { canSeeTarget: false, reachedDestination: true, nowMs: this.simulationTime });
      zombie.path = [];
    }
  }

  private tryFindPath(start: Point, goal: Point, maxVisited: number): Point[] | undefined {
    if (this.pathfindingWorkThisFrame >= MAX_PATHFINDING_PER_FRAME) return undefined;
    this.pathfindingWorkThisFrame += 1;
    this.performanceMonitor.recordPathfinding();
    return findAnyAnglePath(start, goal, this.companionNavigationQuery, maxVisited);
  }

  private tryFindZombiePath(start: Point, goal: Point, maxVisited: number): Point[] | undefined {
    if (this.pathfindingWorkThisFrame >= MAX_PATHFINDING_PER_FRAME) return undefined;
    this.pathfindingWorkThisFrame += 1;
    this.performanceMonitor.recordPathfinding();
    return findAnyAnglePath(start, goal, this.zombieNavigationQuery, maxVisited);
  }

  private updateZombieObstacleAttack(zombie: Zombie, deltaSeconds: number): boolean {
    const id = zombie.obstacleTargetId;
    const structure=id?this.structureRegistry.get(id):undefined;
    if(structure){if(structure.health<=0||(structure.kind==="wood-door"&&structure.doorOpen)){this.cancelZombieObstacleTarget(zombie);return false;}const position=getStructureAttackSlot(structure,zombie.id);const targetDistance=distance(zombie.position,position);if(targetDistance>OBSTACLE_BALANCE.attackRange+2){this.cancelZombieObstacleTarget(zombie);return false;}const center=getPlacedStructureCenter(structure);zombie.motion.desiredSpeed=0;zombie.motion.desiredHeadAngle=Math.atan2(center.y-zombie.position.y,center.x-zombie.position.x);updateActorMotionSmoothing(zombie.motion,zombie.kind==="runner"?RUNNER_MOTION_PROFILE:WALKER_MOTION_PROFILE,deltaSeconds,1.75);zombie.aimAngle=zombie.motion.headAngle;if(this.simulationTime<zombie.nextObstacleAttackAt)return true;const windup=Math.max(220,Math.round(zombie.definition.biteWindupMs*.75));if(zombie.obstacleAttackCompletesAt===0)zombie.obstacleAttackCompletesAt=this.simulationTime+windup;if(this.simulationTime<zombie.obstacleAttackCompletesAt)return true;const result=this.structureDurability.damage(structure,ZOMBIE_STRUCTURE_DAMAGE[zombie.kind]);this.effects.emitObstacleImpact(center.x,center.y,zombie.aimAngle,++this.ambientEffectSequence,this.simulationTime,result.destroyedNow);zombie.obstacleAttackCompletesAt=0;zombie.nextObstacleAttackAt=this.simulationTime+zombie.definition.attackCooldownMs;if(result.destroyedNow){this.destroyPlayerStructure(structure.id,true);this.cancelZombieObstacleTarget(zombie);return false;}this.structureViews.get(structure.id)?.refresh?.();return true;}
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
    zombie.motion.desiredSpeed = 0;
    zombie.motion.desiredHeadAngle = Math.atan2(position.y - zombie.position.y, position.x - zombie.position.x);
    updateActorMotionSmoothing(zombie.motion, zombie.kind === "runner" ? RUNNER_MOTION_PROFILE : WALKER_MOTION_PROFILE, deltaSeconds, 1.75);
    zombie.aimAngle = zombie.motion.headAngle;
    if (this.simulationTime < zombie.nextObstacleAttackAt) return true;
    const windup = Math.max(220, Math.round(zombie.definition.biteWindupMs * 0.75));
    if (zombie.obstacleAttackCompletesAt === 0) zombie.obstacleAttackCompletesAt = this.simulationTime + windup;
    const progress = 1 - (zombie.obstacleAttackCompletesAt - this.simulationTime) / windup;
    if (this.fog.getStateAtWorld(position.x, position.y) === VisibilityState.Visible) {
      drawPixelRing(this.telegraphGraphics, position.x, position.y, 8 + Math.max(0, progress) * 4, 0xb98a5b, 0.9);
    }
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
    if (this.fog.getStateAtWorld(zombie.position.x, zombie.position.y) === VisibilityState.Visible) {
      drawPixelRing(this.telegraphGraphics, zombie.position.x, zombie.position.y, 7 + Math.max(0, progress) * 6, 0xc84f43, 0.9, 2);
    }
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
    if (explicitFocus && !focusTarget) {
      this.companion.command = "follow";
      this.companion.focusTargetId = undefined;
      clearCompanionTargetCommitment(this.companion.targetCommitment);
      this.companion.navigation.catchUpMode = updateCatchUpMode(false, distanceToPlayer, "follow");
      explicitFocus = false;
    }
    const automaticTargetDistance = this.companion.navigation.catchUpMode || this.companion.command === "move"
      ? COMPANION_MOVEMENT.immediateThreatDistance
      : companionWeapon.range;
    const committedTarget = this.companion.targetCommitment.currentTargetId
      ? this.zombies.find((zombie) => zombie.id === this.companion.targetCommitment.currentTargetId && zombie.isAlive())
      : undefined;
    const targetUpdate = this.companion.targetCommitmentUpdate;
    targetUpdate.now = this.simulationTime;
    targetUpdate.origin = this.companion.position;
    targetUpdate.command = this.companion.command;
    targetUpdate.candidates = this.teamVisibleZombies;
    targetUpdate.currentTarget = committedTarget;
    targetUpdate.focusTarget = focusTarget;
    targetUpdate.maximumDistance = explicitFocus ? Number.POSITIVE_INFINITY : automaticTargetDistance;
    targetUpdate.immediateThreatDistance = COMPANION_MOVEMENT.immediateThreatDistance;
    const combatTargetId = updateCompanionTargetCommitment(this.companion.targetCommitment, targetUpdate);
    const combatTarget = combatTargetId
      ? this.zombies.find((zombie) => zombie.id === combatTargetId && zombie.isAlive())
      : undefined;

    const combatDistance = combatTarget ? distance(this.companion.position, combatTarget.position) : Number.POSITIVE_INFINITY;
    const combatHasLineOfSight = Boolean(combatTarget && this.collision.hasLineOfSight(this.companion.position, combatTarget.position));
    if (combatTarget) this.companion.motion.desiredHeadAngle = Math.atan2(
      combatTarget.position.y - this.companion.position.y,
      combatTarget.position.x - this.companion.position.x,
    );
    if (combatTarget && combatHasLineOfSight && combatDistance <= companionWeapon.range) {
      const targetAngle = Math.atan2(combatTarget.position.y - this.companion.position.y, combatTarget.position.x - this.companion.position.x);
      this.companion.motion.desiredHeadAngle = targetAngle;
      if (this.simulationTime >= this.companion.nextAttackAt
        && isCompanionAimAligned(this.companion.motion.headAngle, targetAngle, companionWeapon)) {
        this.companion.nextAttackAt = this.simulationTime + companionWeapon.cooldownMs;
        const shot = this.attackEffects.play({
          weapon: "pistol",
          originX: this.companion.position.x,
          originY: this.companion.position.y,
          angle: this.companion.motion.headAngle,
          startedAt: this.simulationTime,
          impacts: [],
        });
        const angle = deterministicProjectileAngle(this.companion.motion.headAngle, companionWeapon.spreadRadians ?? 0, shot.sequence, 0, 1);
        this.spawnProjectile("ally", this.companion.id, "pistol", this.companion.position, angle, shot.sequence, 0);
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
        : updateCompanionCombatMovement(this.companion.navigation, companionWeapon, combatDistance, this.companion.command, shouldChase, this.simulationTime);
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
    let motionUpdated = false;
    this.companion.motion.desiredSpeed = 0;
    if (goal && distance(this.companion.position, goal) > 10 && !(this.companion.command === "hold" && combatTarget)) {
      const goalTile = getWorldTileIndex(goal);
      if (goalTile !== this.companion.navigation.lastGoalTile) {
        this.companion.navigation.lastGoalTile = goalTile;
        this.companion.path = [];
        this.companion.pathIndex = 0;
        this.companion.nextPathAt = Math.min(this.companion.nextPathAt, this.simulationTime + this.companion.formationSlotIndex * 18);
      }
      if (this.companion.pathNavigationRevision !== this.collision.navigationRevision) {
        this.companion.path = [];
        this.companion.pathIndex = 0;
        this.companion.pathNavigationRevision = this.collision.navigationRevision;
        this.companion.nextPathAt = Math.min(this.companion.nextPathAt, this.simulationTime + this.companion.formationSlotIndex * 18);
      }
      const hasDirectPath = this.collision.canTraverseCircle(this.companion.position, goal, BALANCE.companionRadius);
      if (hasDirectPath) {
        this.companion.path = [{ x: goal.x, y: goal.y }];
        this.companion.pathIndex = 0;
        this.companion.pathNavigationRevision = this.collision.navigationRevision;
      }
      const currentWaypoint = this.companion.path[this.companion.pathIndex];
      if (currentWaypoint && !this.collision.canOccupyCircle(currentWaypoint.x, currentWaypoint.y, BALANCE.companionRadius)) {
        this.companion.path = [];
        this.companion.pathIndex = 0;
        this.companion.nextPathAt = this.simulationTime;
      }

      if (!hasDirectPath && this.simulationTime >= this.companion.nextPathAt) {
        const nextPath = this.tryFindPath(this.companion.position, goal, 700);
        if (nextPath !== undefined) {
          const repathDelay = stuckDuration > 0 ? 120 : this.companion.navigation.catchUpMode ? 280 : 500;
          this.companion.nextPathAt = this.simulationTime + repathDelay;
          this.companion.path = nextPath;
          this.companion.pathIndex = 0;
          this.companion.pathNavigationRevision = this.collision.navigationRevision;
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
        const probeDistance = Math.min(Math.max(this.companion.motion.currentSpeed, followSpeed * 0.5) * deltaSeconds, 7);
        const direction = chooseLocalSteering(
          this.companion.position,
          target,
          probeDistance,
          (x, y) => this.collision.canOccupyCircle(x, y, BALANCE.companionRadius),
          this.companion.steeringScratch,
        );
        if (direction) {
          const desiredMoveAngle = Math.atan2(direction.y, direction.x);
          this.companion.motion.desiredMoveAngle = desiredMoveAngle;
          if (!combatTarget) this.companion.motion.desiredHeadAngle = desiredMoveAngle;
          const cornerScale = Math.abs(motionAngleDifference(desiredMoveAngle, this.companion.motion.currentMoveAngle)) >= Math.PI / 2 ? 0.8 : 1;
          this.companion.motion.desiredSpeed = followSpeed * arrivalScale * cornerScale;
          updateActorMotionSmoothing(
            this.companion.motion,
            COMPANION_MOTION_PROFILE,
            deltaSeconds,
            stuckDuration >= COMPANION_MOVEMENT.stuckThresholdMs ? 1.6 : 1,
          );
          motionUpdated = true;
          const stepDistance = Math.min(this.companion.motion.currentSpeed * deltaSeconds, 7);
          const previousX = this.companion.position.x;
          const previousY = this.companion.position.y;
          this.companion.position = this.collision.moveCircle(
            this.companion.position,
            Math.cos(this.companion.motion.currentMoveAngle) * stepDistance,
            Math.sin(this.companion.motion.currentMoveAngle) * stepDistance,
            BALANCE.companionRadius,
          );
          moving = Math.hypot(this.companion.position.x - previousX, this.companion.position.y - previousY) >= 0.05;
          if (!moving) {
            markCompanionBlocked(this.companion.navigation);
            this.companion.nextPathAt = Math.min(this.companion.nextPathAt, this.simulationTime + 60);
          }
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
    if (!motionUpdated) updateActorMotionSmoothing(this.companion.motion, COMPANION_MOTION_PROFILE, deltaSeconds);
    this.companion.aimAngle = this.companion.motion.headAngle;
    this.companion.updateView(time, this.fog.getStateAtWorld(this.companion.position.x, this.companion.position.y) === VisibilityState.Visible, moving);
  }

  private chooseCompanionCommand(command: CompanionCommand): void {
    if (command === "follow") {
      for (const companion of this.rescuedCompanions) {
        companion.command = "follow";
        companion.focusTargetId = undefined;
        companion.commandTarget = undefined;
        clearCompanionTargetCommitment(companion.targetCommitment);
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
        clearCompanionTargetCommitment(companion.targetCommitment);
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
        clearCompanionTargetCommitment(companion.targetCommitment);
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
        const targetUpdate = companion.targetCommitmentUpdate;
        targetUpdate.now = this.simulationTime;
        targetUpdate.origin = companion.position;
        targetUpdate.command = "focus";
        targetUpdate.candidates = this.teamVisibleZombies;
        targetUpdate.currentTarget = undefined;
        targetUpdate.focusTarget = target;
        targetUpdate.maximumDistance = Number.POSITIVE_INFINITY;
        targetUpdate.immediateThreatDistance = COMPANION_MOVEMENT.immediateThreatDistance;
        updateCompanionTargetCommitment(companion.targetCommitment, targetUpdate);
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
      const added = this.inventory.add(container.equipment, 1);
      if (added > 0) { this.player.unlockWeapon(container.equipment, false); acquired.push(WEAPON_DEFINITIONS[container.equipment].name); }
      else this.spawnDrop(container.equipment, 1, tileCenter(container.tileX), tileCenter(container.tileY));
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
      const items=[...result.acquired].map(([id,amount])=>`${getInventoryObjectDefinition(id).name} ${amount}`);
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
    const result=grantCompendiumEntry(entry,{developerMode:this.settings.developerMode,canAdd:(id,amount)=>this.inventory.canAdd(id,amount),add:(id,amount)=>this.inventory.add(id,amount),hasWeapon:(id)=>this.inventory.count(id)>0,unlockWeapon:(id)=>this.player.unlockWeapon(id,false),syncObjectives:()=>this.syncCollectedParts()});
    this.pauseMenu.setDeveloperMode(this.settings.developerMode);
    if(result.success)this.hud.showMessage(`${entry.name} ${result.amount} 지급`);else this.hud.showMessage(result.reason==="developer-mode-off"?"개발자 모드에서만 지급할 수 있습니다.":result.reason==="already-unlocked"?"이미 보유한 무기입니다.":"인벤토리가 가득 찼습니다.");
    this.refreshInventoryPanel();
  }

  private craft(recipeId: string): void {
    const station = this.getCraftingStationContext(this.activeCraftingStationId);
    const result = this.crafting.craft(recipeId, this.inventory, { ignoreIngredients: this.settings.developerMode, stationKind: station.kind });
    if (!result.success) {
      this.hud.showMessage(result.reason === "station-missing" ? "필요한 등급의 제작대가 가까이 없습니다." : result.reason === "inventory-full" ? "제작품을 넣을 공간이 없습니다." : "재료가 부족합니다.");
      this.refreshInventoryPanel();
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

  private useInventoryItem(instanceId: string): void {
    const item = this.inventory.getItem(instanceId);
    if (!item) return;
    const buildableId=getItemBuildableId(item.itemId);
    if(buildableId){this.activeCraftingStationId=undefined;this.inventoryPanel.openBuildTabForPlacement({buildableId,source:{kind:"item",instanceId,itemId:item.itemId},requestedAt:Date.now()},this.getInventoryPanelState());return;}
    this.useItem(item.itemId);
  }

  private useQuickslot(index: number): void {
    const itemId = this.quickslots[index];
    if (!itemId) {
      this.hud.showMessage(`${index + 1}번 퀵슬롯이 비었습니다.`);
      return;
    }
    const instance=this.inventory.getItems().find((item)=>item.itemId===itemId&&item.quantity>0);
    if(instance&&getItemBuildableId(itemId)){this.beginBuildPlacement(getItemBuildableId(itemId)!,{kind:"item",instanceId:instance.instanceId,itemId});return;}
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
    const useAudioId = getItemDefinition(itemId).useAudioId;
    if (useAudioId) this.audio.play(useAudioId);
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

  private manageStructure(state:PlacedStructureState):void{if(state.source!=="player-built"||state.ownership!=="player"){this.hud.showMessage("도시의 기존 구조물은 철거하거나 환급받을 수 없습니다.");return;}if(state.health<state.maximumHealth){const costs=getRepairCost(state);if(this.structureDurability.repair(state,this.inventory)){this.structureViews.get(state.id)?.refresh?.();this.hud.showMessage(`${BUILDABLE_DEFINITIONS[state.kind].name} 수리 완료 · ${costs.map((cost)=>`${getItemDefinition(cost.itemId).name} ${cost.quantity}`).join(" · ")}`);this.refreshInventoryPanel();}else this.hud.showMessage("수리 재료가 부족하거나 수리가 필요하지 않습니다.");return;}const storage=this.structureStorage.get(state.id);if(storage&&!storage.isEmpty()){this.hud.showMessage("보관함을 비운 뒤 철거할 수 있습니다.");return;}if((this.demolitionConfirmUntil.get(state.id)??0)<this.simulationTime){this.demolitionConfirmUntil.set(state.id,this.simulationTime+2_000);this.hud.showMessage("2초 안에 Shift+E를 다시 눌러 철거를 확인하세요.");return;}const refund=getDemolitionRefund(state);this.destroyPlayerStructure(state.id,false);for(const item of refund){const added=this.inventory.add(item.itemId,item.quantity);if(added<item.quantity)this.spawnDrop(item.itemId,item.quantity-added,this.player.position.x,this.player.position.y);}this.hud.showMessage(`${BUILDABLE_DEFINITIONS[state.kind].name} 철거 완료`);}

  private beginBuildPlacement(buildableId:BuildableKind,source:BuildPlacementSource):void{if(!BUILDABLE_DEFINITIONS[buildableId])return;clearWallDrag(this.wallDrag);this.pendingBuildPlacement=createPendingBuildPlacement(buildableId,source);this.buildStartAnchor=undefined;this.commandPanel.hide();this.pendingCompanionCommand=undefined;this.cancelMeleeAction();}

  private startBuildPlacement(intent:BuildTabSelectionIntent):boolean{const definition=BUILDABLE_DEFINITIONS[intent.buildableId];if(!definition)return false;if(intent.source.kind==="developer"&&!this.settings.developerMode)return false;if(intent.source.kind==="item"){const item=this.inventory.getItem(intent.source.instanceId);if(!item||item.itemId!==intent.source.itemId||item.quantity<1||getItemBuildableId(item.itemId)!==intent.buildableId)return false;}else if(intent.source.kind==="materials"&&getBuildCostItems(definition).some((cost)=>this.inventory.count(cost.itemId)<cost.quantity))return false;this.beginBuildPlacement(intent.buildableId,intent.source);this.activeCraftingStationId=undefined;this.hud.showMessage(`${definition.name} 배치 · 좌클릭 드래그/확정 · R 회전 · 우클릭/ESC 취소`);return true;}

  private isBuildPlacementSourceValid(pending:PendingBuildPlacement):boolean{if(!BUILDABLE_DEFINITIONS[pending.buildableId])return false;if(pending.source.kind==="developer")return this.settings.developerMode;if(pending.source.kind==="materials")return true;const item=this.inventory.getItem(pending.source.instanceId);return Boolean(item&&item.itemId===pending.source.itemId&&item.quantity>0&&getItemBuildableId(item.itemId)===pending.buildableId);}
  private hasBuildPlacementCost(pending:PendingBuildPlacement,quantity=1):boolean{if(!this.isBuildPlacementSourceValid(pending))return false;if(pending.source.kind==="item"||pending.source.kind==="developer")return true;return getBuildCostItems(BUILDABLE_DEFINITIONS[pending.buildableId]).every((cost)=>this.inventory.count(cost.itemId)>=cost.quantity*quantity);}

  private isPendingWallChain():boolean{const kind=this.pendingBuildPlacement?.buildableId;return kind==="wood-wall"||kind==="metal-wall";}

  private startWallDrag(world:Point):void{
    const pending=this.pendingBuildPlacement;if(!pending||(pending.buildableId!=="wood-wall"&&pending.buildableId!=="metal-wall")||this.wallDrag.active)return;
    const anchor=snapStructureAnchor(world);beginWallDrag(this.wallDrag,pending.buildableId as WallBuildableKind,anchor,pending.rotation);this.refreshWallDragPreview(anchor);
  }

  private refreshWallDragPreview(end:Point):void{
    const pending=this.pendingBuildPlacement;if(!pending||!this.wallDrag.active||!this.wallDrag.startAnchor||!this.wallDrag.buildableId)return;
    const snapped=snapStructureAnchor(end),chain=createOrientedSegmentChain(this.wallDrag.buildableId,this.wallDrag.startAnchor,snapped,pending.rotation);
    const invalidReason=!this.hasBuildPlacementCost(pending,chain.length)?"missing-source":chain.length>0&&this.validateSegmentChain(chain)?undefined:"invalid-placement";
    updateWallDragPreview(this.wallDrag,snapped,chain,invalidReason);updatePendingBuildPlacement(pending,snapped.x,snapped.y,()=>invalidReason??null,true);
  }

  private finishWallDrag(reason:"commit"|"cancel"):void{
    if(!this.wallDrag.active)return;const sequence=this.wallDrag.dragSequence;
    if(reason==="cancel"){clearWallDrag(this.wallDrag,sequence);this.buildPreview?.clear();return;}
    this.refreshWallDragPreview(this.pointerWorldSnapshot);const snapshot=snapshotWallDrag(this.wallDrag),pending=this.pendingBuildPlacement;
    if(!snapshot||!pending||pending.buildableId!==snapshot.buildableId||!markWallDragCommitted(this.wallDrag,sequence))return;
    const inventoryBefore=this.inventory.snapshot(),definition=BUILDABLE_DEFINITIONS[snapshot.buildableId];
    const result=commitStructureSegmentChain({buildableId:snapshot.buildableId,source:pending.source,segments:snapshot.segments,dragSequence:snapshot.dragSequence,
      validateSegment:(_segment,index,all)=>index!==0||snapshot.valid&&this.validateSegmentChain(all as readonly StructureSegment[]),validateSource:(quantity)=>this.hasBuildPlacementCost(pending,quantity),reserveIds:(quantity)=>Array.from({length:quantity},()=>this.reserveStructureId()),
      consumeSource:(quantity)=>{if(pending.source.kind==="developer")return true;if(pending.source.kind==="item")return quantity===1&&this.inventory.dropInstance(pending.source.instanceId,1)?.quantity===1;for(const cost of getBuildCostItems(definition))if(this.inventory.count(cost.itemId)<cost.quantity*quantity)return false;for(const cost of getBuildCostItems(definition))if(!this.inventory.remove(cost.itemId,cost.quantity*quantity))return false;return true;},restoreSource:()=>this.inventory.restore(inventoryBefore),
      createAndRegister:(segment,id)=>{const state=createPlacedSegment(id,snapshot.buildableId,segment.startX,segment.startY,segment.endX,segment.endY,this.structureCounter);this.restoreStructure(state);const built=this.structureRegistry.get(id);if(!built)throw new Error("segment registration failed");this.registerStructureObject(built);},rollbackCreated:(id)=>{this.removeStructureRuntime(id);},
    });
    clearWallDrag(this.wallDrag,sequence);
    if(!result.success){this.reportBuildPlacementFailure(result.reason==="missing-source"?"missing-source":snapshot.invalidReason??"invalid-placement");this.refreshInventoryPanel();return;}
    this.afterStructureTopologyChange();const built=this.structureRegistry.get(result.createdIds[0]!);if(built){const center=getPlacedStructureCenter(built);this.effects.emitFootstepDust(center.x,center.y,0,false,"ground",++this.ambientEffectSequence,this.simulationTime);}this.audio.play("craft");this.hud.showMessage(`${definition.name} ${result.installedCount}칸 설치 완료`);
    if(pending.source.kind!=="developer")this.closeBuildMode();else{pending.snappedX=Number.NaN;pending.snappedY=Number.NaN;}this.refreshInventoryPanel();
  }

  private confirmBuildPlacement(world:Point):void{const pending=this.pendingBuildPlacement;if(!pending)return;const definition=BUILDABLE_DEFINITIONS[pending.buildableId];if(definition.placementClass==="furniture"){this.confirmFurniturePlacement(pending,world);return;}if(definition.placementKind==="segment"&&!this.buildStartAnchor){this.buildStartAnchor=snapStructureAnchor(world);pending.snappedX=Number.NaN;pending.snappedY=Number.NaN;this.hud.showMessage("끝 anchor를 선택하세요. 취소: 우클릭/ESC");return;}
    const footprint=definition.placementKind==="footprint"?getRotatedStructureFootprint(pending.buildableId,pending.rotation):undefined;const tileX=Math.floor(world.x/TILE_SIZE),tileY=Math.floor(world.y/TILE_SIZE);const segments=definition.placementKind==="segment"?createOrientedSegmentChain(pending.buildableId as SegmentBuildableKind,this.buildStartAnchor!,world,pending.rotation):[];const quantity=Math.max(1,segments.length);const placementFailure=()=>!this.hasBuildPlacementCost(pending,quantity)?"missing-source":definition.placementKind==="footprint"?this.validateFootprintPlacement(pending.buildableId,tileX,tileY,footprint!.width,footprint!.height):segments.length>0&&this.validateSegmentChain(segments)?null:"invalid-placement";const validate=()=>placementFailure()===null;updatePendingBuildPlacement(pending,definition.placementKind==="footprint"?tileX:Math.round(world.x),definition.placementKind==="footprint"?tileY:Math.round(world.y),placementFailure,true);
    const inventoryBefore=this.inventory.snapshot(),createdIds:string[]=[];const success=confirmPendingBuildPlacement(pending,{validateSource:()=>this.hasBuildPlacementCost(pending,quantity),validatePlacement:validate,consumeSource:()=>{if(pending.source.kind==="developer")return true;if(pending.source.kind==="item")return this.inventory.dropInstance(pending.source.instanceId,1)?.quantity===1;for(const cost of getBuildCostItems(definition)){if(this.inventory.count(cost.itemId)<cost.quantity*quantity)return false;}for(const cost of getBuildCostItems(definition))if(!this.inventory.remove(cost.itemId,cost.quantity*quantity))return false;return true;},restoreSource:()=>this.inventory.restore(inventoryBefore),create:()=>{if(definition.placementKind==="footprint"){const id=this.reserveStructureId();createdIds.push(id);const state=createPlacedStructure(id,pending.buildableId,tileX,tileY,pending.rotation,this.structureCounter);this.restoreStructure(state);if(!this.structureRegistry.get(id))throw new Error("structure registration failed");this.registerStructureObject(this.structureRegistry.get(id)!);}else for(const segment of segments){const id=this.reserveStructureId();createdIds.push(id);const state=createPlacedSegment(id,pending.buildableId as SegmentBuildableKind,segment.startX,segment.startY,segment.endX,segment.endY,this.structureCounter,pending.hingeSide);this.restoreStructure(state);if(!this.structureRegistry.get(id))throw new Error("segment registration failed");this.registerStructureObject(this.structureRegistry.get(id)!);}},rollbackCreate:()=>{for(const id of createdIds)this.removeStructureRuntime(id);}});
    if(!success){this.reportBuildPlacementFailure(pending.invalidReason??(this.hasBuildPlacementCost(pending,quantity)?"invalid-placement":"missing-source"));return;}this.afterStructureTopologyChange();const built=this.structureRegistry.get(createdIds[0]!);if(built){const center=getPlacedStructureCenter(built);this.effects.emitFootstepDust(center.x,center.y,0,false,"ground",++this.ambientEffectSequence,this.simulationTime);}this.audio.play("craft");this.hud.showMessage(`${definition.name} 설치 완료`);if(pending.source.kind==="developer"){this.buildStartAnchor=undefined;pending.snappedX=Number.NaN;pending.snappedY=Number.NaN;}else this.closeBuildMode();this.refreshInventoryPanel();}

  private confirmFurniturePlacement(pending:PendingBuildPlacement,world:Point):void{
    const definition=BUILDABLE_DEFINITIONS[pending.buildableId],placement=getFurniturePlacement(world,this.player.position,pending.placementMode,pending.angle,TILE_SIZE);pending.x=placement.x;pending.y=placement.y;pending.angle=placement.angle;
    const placementFailure=()=>!this.hasBuildPlacementCost(pending)?"missing-source":this.validateFurniturePlacement(pending.buildableId,placement.x,placement.y,placement.angle);updatePendingBuildPlacement(pending,placement.x,placement.y,placementFailure,true);
    const inventoryBefore=this.inventory.snapshot();let createdId:string|undefined;const success=confirmPendingBuildPlacement(pending,{validateSource:()=>this.hasBuildPlacementCost(pending),validatePlacement:()=>placementFailure()===null,consumeSource:()=>{if(pending.source.kind==="developer")return true;if(pending.source.kind==="item")return this.inventory.dropInstance(pending.source.instanceId,1)?.quantity===1;const costs=getBuildCostItems(definition);if(costs.some((cost)=>this.inventory.count(cost.itemId)<cost.quantity))return false;for(const cost of costs)this.inventory.remove(cost.itemId,cost.quantity);return true;},restoreSource:()=>this.inventory.restore(inventoryBefore),create:()=>{createdId=this.reserveStructureId();const state=createPlacedFurniture(createdId,pending.buildableId,placement.x,placement.y,placement.angle,this.structureCounter);this.restoreStructure(state);const built=this.structureRegistry.get(createdId);if(!built)throw new Error("furniture registration failed");this.registerStructureObject(built);},rollbackCreate:()=>{if(createdId)this.removeStructureRuntime(createdId);}});
    if(!success){this.reportBuildPlacementFailure(pending.invalidReason??"invalid-placement");return;}this.afterStructureTopologyChange();this.effects.emitFootstepDust(placement.x,placement.y,0,false,"ground",++this.ambientEffectSequence,this.simulationTime);this.audio.play("craft");this.hud.showMessage(`${definition.name} 설치 완료`);if(pending.source.kind!=="developer")this.closeBuildMode();else{pending.snappedX=Number.NaN;pending.snappedY=Number.NaN;}this.refreshInventoryPanel();
  }

  private validateFurniturePlacement(kind:BuildableKind,x:number,y:number,angle:number):string|null{
    const definition=BUILDABLE_DEFINITIONS[kind],size=definition.furnitureSize!,obb:OrientedRectangle={x,y,angle,halfWidth:size.width/2,halfHeight:size.height/2},bounds=getObbAabb(obb),minTileX=Math.floor(bounds.minX/TILE_SIZE),minTileY=Math.floor(bounds.minY/TILE_SIZE),maxTileX=Math.floor(bounds.maxX/TILE_SIZE),maxTileY=Math.floor(bounds.maxY/TILE_SIZE);
    const nearby=this.structureRegistry.queryTiles(minTileX,minTileY,maxTileX,maxTileY),occupied=nearby.some((state)=>{if(state.placement.kind==="furniture"){const otherSize=BUILDABLE_DEFINITIONS[state.kind].furnitureSize!;return obbIntersectsObb(obb,{x:state.placement.x,y:state.placement.y,angle:state.placement.angle,halfWidth:otherSize.width/2,halfHeight:otherSize.height/2});}if(state.placement.kind==="segment")return circleIntersectsThickSegment(x,y,Math.max(size.width,size.height)/2,{...state.placement,thickness:BUILDABLE_DEFINITIONS[state.kind].segment!.thickness});return false;});
    const covered:Array<{x:number;y:number}>=[];for(let tileY=minTileY;tileY<=maxTileY;tileY+=1)for(let tileX=minTileX;tileX<=maxTileX;tileX+=1)covered.push({x:tileX,y:tileY});
    return getBuildablePlacementFailure(kind,{inBounds:bounds.minX>=0&&bounds.minY>=0&&bounds.maxX<=WORLD_WIDTH&&bounds.maxY<=WORLD_HEIGHT,blocked:covered.some((tile)=>this.collision.isTileBlocked(tile.x,tile.y)),occupiedByStructure:occupied,doorway:this.map.doors.some((door)=>circleIntersectsObb((door.tileX+.5)*TILE_SIZE,(door.tileY+.5)*TILE_SIZE,6,obb)),objective:this.map.containers.some((container)=>Boolean(container.part)&&circleIntersectsObb((container.tileX+.5)*TILE_SIZE,(container.tileY+.5)*TILE_SIZE,7,obb)),extraction:squaredDistance({x,y},this.map.extractionZone)<=(this.map.extractionZone.radius+Math.max(size.width,size.height)/2)**2,actorOccupied:[this.player,...this.companions.filter((actor)=>actor.alive),...this.zombies.filter((actor)=>actor.isAlive())].some((actor)=>circleIntersectsObb(actor.position.x,actor.position.y,7,obb)),indoor:covered.some((tile)=>this.indoorTiles[tile.y*this.map.widthTiles+tile.x]===1),roadLane:false,withinRange:isWithinBuildRange(this.player.position,{x,y}),visible:this.fog.getStateAtWorld(x,y)===VisibilityState.Visible,lineOfSight:this.collision.hasLineOfSight(this.player.position,{x,y})});
  }

  private validateFootprintPlacement(kind: BuildableKind, tileX: number, tileY: number, width: number, height: number): string | null {
    const center={x:(tileX+width/2)*TILE_SIZE,y:(tileY+height/2)*TILE_SIZE}; const covered: Array<{x:number;y:number}>=[];
    for(let y=tileY;y<tileY+height;y+=1)for(let x=tileX;x<tileX+width;x+=1)covered.push({x,y});
    return getBuildablePlacementFailure(kind,{inBounds:tileX>=0&&tileY>=0&&tileX+width<=this.map.widthTiles&&tileY+height<=this.map.heightTiles,blocked:covered.some((tile)=>this.collision.isTileBlocked(tile.x,tile.y)),occupiedByStructure:this.structures.some((state)=>structureFootprintsOverlap(tileX,tileY,width,height,state)),doorway:covered.some((tile)=>this.map.doors.some((door)=>door.tileX===tile.x&&door.tileY===tile.y)),objective:covered.some((tile)=>this.map.containers.some((container)=>Boolean(container.part)&&container.tileX===tile.x&&container.tileY===tile.y)),extraction:squaredDistance(center,this.map.extractionZone)<=this.map.extractionZone.radius**2,actorOccupied:[this.player,...this.companions.filter((actor)=>actor.alive),...this.zombies.filter((actor)=>actor.isAlive())].some((actor)=>actor.position.x>=tileX*TILE_SIZE-5&&actor.position.x<=(tileX+width)*TILE_SIZE+5&&actor.position.y>=tileY*TILE_SIZE-5&&actor.position.y<=(tileY+height)*TILE_SIZE+5),indoor:covered.some((tile)=>this.indoorTiles[tile.y*this.map.widthTiles+tile.x]===1),roadLane:false,withinRange:isWithinBuildRange(this.player.position,center),visible:this.fog.getStateAtWorld(center.x,center.y)===VisibilityState.Visible,lineOfSight:this.collision.hasLineOfSight(this.player.position,center)});
  }

  private validateSegmentChain(segments: readonly StructureSegment[]): boolean {
    const existing:SegmentGeometry[]=this.structures.flatMap((state)=>state.placement.kind==="segment"?[{startX:state.placement.startX,startY:state.placement.startY,endX:state.placement.endX,endY:state.placement.endY,thickness:BUILDABLE_DEFINITIONS[state.kind].segment!.thickness}]:[]);
    for(const segment of segments){const midpoint={x:(segment.startX+segment.endX)/2,y:(segment.startY+segment.endY)/2};
      if(!isWithinBuildRange(this.player.position,segment.startX===segments[0]!.startX&&segment.startY===segments[0]!.startY?{x:segment.startX,y:segment.startY}:midpoint)||!isWithinBuildRange(this.player.position,{x:segment.endX,y:segment.endY}))return false;
      if(midpoint.x<0||midpoint.y<0||midpoint.x>WORLD_WIDTH||midpoint.y>WORLD_HEIGHT||this.fog.getStateAtWorld(midpoint.x,midpoint.y)!==VisibilityState.Visible||!this.collision.hasLineOfSight(this.player.position,midpoint)||segmentConflicts(segment,existing))return false;
      if(this.collision.isMovementBlockedWorld(midpoint.x,midpoint.y,1))return false;
      if([this.player,...this.companions.filter((actor)=>actor.alive),...this.zombies.filter((actor)=>actor.isAlive())].some((actor)=>circleIntersectsThickSegment(actor.position.x,actor.position.y,6,segment)))return false;
      existing.push(segment);
    } return true;
  }

  private updateBuildPreview(): void {
    const graphics=this.buildPreview,pending=this.pendingBuildPlacement;if(!graphics)return;graphics.clear();if(!pending)return;if(!this.isBuildPlacementSourceValid(pending)){this.cancelBuildPlacement();this.hud.showMessage("배치할 아이템이 없어 건축을 취소했습니다.");return;}const definition=BUILDABLE_DEFINITIONS[pending.buildableId];
    if(definition.placementKind==="segment"){const snapped=snapStructureAnchor(this.pointerWorldSnapshot);let chain:readonly StructureSegment[];if(this.wallDrag.active&&this.wallDrag.startAnchor){this.refreshWallDragPreview(snapped);chain=this.wallDrag.previewSegments as readonly StructureSegment[];}else if(this.buildStartAnchor)chain=createOrientedSegmentChain(pending.buildableId as SegmentBuildableKind,this.buildStartAnchor,snapped,pending.rotation);else{const length=definition.segment!.length,directions=[{x:length,y:0},{x:length,y:length},{x:0,y:length},{x:length,y:-length}],direction=directions[pending.rotation]!;chain=[{kind:pending.buildableId as SegmentBuildableKind,startX:snapped.x,startY:snapped.y,endX:snapped.x+direction.x,endY:snapped.y+direction.y,thickness:definition.segment!.thickness}];updatePendingBuildPlacement(pending,snapped.x,snapped.y,()=>!this.hasBuildPlacementCost(pending,chain.length)?"missing-source":chain.length>0&&this.validateSegmentChain(chain as readonly StructureSegment[])?null:"invalid-placement");}for(const segment of chain)drawStructureRenderModel(graphics,createStructureRenderModel(pending.buildableId,{kind:"segment",startX:segment.startX,startY:segment.startY,endX:segment.endX,endY:segment.endY,hingeSide:pending.hingeSide},{alpha:pending.valid?BUILD_PREVIEW_ALPHA:INVALID_BUILD_PREVIEW_ALPHA,invalid:!pending.valid}));const anchor=this.wallDrag.startAnchor??this.buildStartAnchor??snapped;graphics.fillStyle(pending.valid?0x80d18b:0xd65d57,.9).fillRect(anchor.x-1,anchor.y-1,3,3);return;}
    if(definition.placementClass==="furniture"){const previousAngleBucket=Math.round(pending.angle*180/Math.PI),placement=getFurniturePlacement(this.pointerWorldSnapshot,this.player.position,pending.placementMode,pending.angle,TILE_SIZE),structureChanged=pending.validatedStructureRevision!==this.structureRegistry.revision;pending.x=placement.x;pending.y=placement.y;pending.angle=placement.angle;updatePendingBuildPlacement(pending,placement.x,placement.y,()=>!this.hasBuildPlacementCost(pending)?"missing-source":this.validateFurniturePlacement(pending.buildableId,placement.x,placement.y,placement.angle),structureChanged||previousAngleBucket!==Math.round(placement.angle*180/Math.PI));pending.validatedStructureRevision=this.structureRegistry.revision;const color=pending.valid?0x80d18b:0xd65d57,alpha=pending.valid?BUILD_PREVIEW_ALPHA:INVALID_BUILD_PREVIEW_ALPHA;drawStructureRenderModel(graphics,createStructureRenderModel(pending.buildableId,{kind:"furniture",...placement},{alpha,invalid:!pending.valid}));const size=definition.furnitureSize!;graphics.lineStyle(1,color,.9);drawObbOutline(graphics,{x:placement.x,y:placement.y,angle:placement.angle,halfWidth:size.width/2,halfHeight:size.height/2});return;}
    const footprint=getRotatedStructureFootprint(pending.buildableId,pending.rotation),tileX=Math.floor(this.pointerWorldSnapshot.x/TILE_SIZE),tileY=Math.floor(this.pointerWorldSnapshot.y/TILE_SIZE);updatePendingBuildPlacement(pending,tileX,tileY,()=>!this.hasBuildPlacementCost(pending)?"missing-source":this.validateFootprintPlacement(pending.buildableId,tileX,tileY,footprint.width,footprint.height));const color=pending.valid?0x80d18b:0xd65d57,alpha=pending.valid?BUILD_PREVIEW_ALPHA:INVALID_BUILD_PREVIEW_ALPHA;drawStructureRenderModel(graphics,createStructureRenderModel(pending.buildableId,{kind:"footprint",tileX,tileY,rotation:pending.rotation},{alpha,invalid:!pending.valid}));graphics.lineStyle(1,color,.9).strokeRect(tileX*TILE_SIZE,tileY*TILE_SIZE,footprint.width*TILE_SIZE,footprint.height*TILE_SIZE);
  }

  private reserveStructureId(): string { let id:string; do id=`structure-${this.seed}-${++this.structureCounter}`;while(this.structureRegistry.get(id));return id; }
  private afterStructureTopologyChange(): void { this.rebuildPowerTopology();this.fogInvalidation.invalidate();this.noise.emit({x:this.player.position.x,y:this.player.position.y,intensity:24,category:"craft",createdAt:this.simulationTime}); }
  private reportBuildPlacementFailure(reason:string):void{if(!shouldReportBuildPlacementFailure(this.simulationTime,this.lastBuildFailureMessageAt))return;this.lastBuildFailureMessageAt=this.simulationTime;this.audio.play("ui");const message:Record<string,string>={"out-of-bounds":"맵 밖에는 설치할 수 없습니다.",occupied:"다른 구조물과 겹칩니다.",actor:"생존자나 좀비와 겹칩니다.",unseen:"보이지 않는 위치에는 설치할 수 없습니다.","out-of-range":"너무 멀리 떨어져 있습니다.","line-of-sight":"벽 너머에는 설치할 수 없습니다.","missing-source":"배치할 아이템 또는 재료가 없습니다."};this.hud.showMessage(message[reason]??"이 위치에는 설치할 수 없습니다.");}
  private cancelBuildPlacement():void{clearWallDrag(this.wallDrag);this.pendingBuildPlacement=undefined;this.buildStartAnchor=undefined;this.buildPreview?.clear();}
  private closeBuildMode(): void { this.cancelBuildPlacement(); }
  private removeStructureRuntime(id:string):PlacedStructureState|undefined{const state=this.structureRegistry.remove(id);if(!state)return undefined;this.structures=this.structures.filter((candidate)=>candidate.id!==id);const markerIndex=this.minimapStructureSources.findIndex((marker)=>marker.id===id);if(markerIndex>=0)this.minimapStructureSources.splice(markerIndex,1);if(state.placement.kind==="segment")this.collision.removeDynamicSegment(id);else if(state.placement.kind==="furniture")this.collision.removeDynamicFurniture(id);else this.collision.removeDynamicObstacle(id);this.structureViews.get(id)?.destroy();this.structureViews.delete(id);this.worldObjects.unregister(id);this.craftingStations.unregister(id);this.turretRuntime.delete(id);this.structureStorage.delete(id);return state;}
  private destroyPlayerStructure(id:string,dropStorage:boolean):void{const state=this.structureRegistry.get(id);if(!state)return;const center=getPlacedStructureCenter(state);const storage=this.structureStorage.get(id);const items=dropStorage&&storage?storage.drainForDestruction():[];const offsets=deterministicStorageDropOffsets(items.length);this.removeStructureRuntime(id);items.forEach((item,index)=>{const offset=offsets[index]!;this.spawnDrop(item.itemId,item.quantity,Math.max(6,Math.min(WORLD_WIDTH-6,center.x+offset.x)),Math.max(6,Math.min(WORLD_HEIGHT-6,center.y+offset.y)));});this.cancelZombieObstacleTargets(id);this.rebuildPowerTopology();this.fogInvalidation.invalidate();this.interactionSystem.invalidate();this.demolitionConfirmUntil.delete(id);}

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

  private dropInventoryItem(instanceId: string): void {
    const dropped = this.inventory.dropInstance(instanceId, 1);
    if (!dropped) return;
    this.spawnDrop(dropped.itemId, dropped.quantity, this.player.position.x + Math.cos(this.player.aimAngle) * 14, this.player.position.y + Math.sin(this.player.aimAngle) * 14);
    this.audio.play("inventory-drop");
    this.syncCollectedParts();
    this.refreshInventoryPanel();
  }

  private assignQuickslot(instanceId: string, quickslot: number): void {
    const item = this.inventory.getItem(instanceId);
    if (!item || item.containerId === null || quickslot < 0 || quickslot >= 5) return;
    this.quickslots[quickslot] = item.itemId;
    this.hud.showMessage(`${quickslot + 1}번 퀵슬롯: ${getItemDefinition(item.itemId).name}`);
    this.refreshInventoryPanel();
  }

  private equipInventoryItem(instanceId: string): void {
    const item = this.inventory.getItem(instanceId);
    if (!item) return;
    const success = this.inventory.equip(instanceId);
    if (success) this.audio.play(getItemDefinition(item.itemId).storageEquipment?.slot === "backpack" ? "equip-backpack" : "equip-clothing");
    this.hud.showMessage(success ? `${getItemDefinition(item.itemId).name} 장착` : "수납공간을 비우거나 장비를 넣을 공간을 확보하세요.");
    this.refreshInventoryPanel();
  }

  private rotateInventoryItem(instanceId: string): boolean {
    const success = this.inventory.rotateItem(instanceId);
    this.hud.showMessage(success ? "아이템을 회전했습니다." : "이 위치에서는 아이템을 회전할 수 없습니다.");
    this.refreshInventoryPanel();
    return success;
  }

  private unequipInventoryItem(slot: StorageSlot): void {
    const itemId = this.inventory.getEquipment()[slot];
    const item = itemId ? this.inventory.getItem(itemId) : null;
    if (!item) return;
    const success = this.inventory.unequip(slot);
    if (success) this.audio.play("unequip-clothing");
    this.hud.showMessage(success ? `${getItemDefinition(item.itemId).name} 해제` : "장비 수납공간을 먼저 비워야 합니다.");
    this.refreshInventoryPanel();
  }

  private equipWeapon(instanceId: string, slot: WeaponEquipmentSlot): boolean {
    const success = this.inventory.equipWeapon(instanceId, slot);
    if (success) this.syncEquippedWeaponFromInventory();
    const item = this.inventory.getItem(instanceId);
    this.hud.showMessage(success && item ? `${getInventoryObjectDefinition(item.itemId).name} ${slot === "primary" ? "주무기" : "보조무기"} 장착` : "교체할 무기를 넣을 공간이 없습니다.");
    this.refreshInventoryPanel();
    return success;
  }

  private unequipWeapon(slot: WeaponEquipmentSlot): boolean {
    const success = this.inventory.unequipWeapon(slot); if (success) this.syncEquippedWeaponFromInventory();
    this.hud.showMessage(success ? "무기를 인벤토리로 옮겼습니다." : "무기를 넣을 공간이 없습니다."); this.refreshInventoryPanel(); return success;
  }

  private activateWeapon(slot: WeaponEquipmentSlot): boolean {
    const success = this.inventory.setActiveWeaponSlot(slot); if (success) this.syncEquippedWeaponFromInventory();
    this.refreshInventoryPanel(); return success;
  }

  private syncEquippedWeaponFromInventory(): void {
    const next = this.inventory.getActiveWeaponId();
    if (this.player.equippedWeapon !== next) { this.player.reloadingUntil = 0; this.weaponAccuracy.bloomRadians = 0; this.cancelMeleeAction(); }
    this.player.equippedWeapon = next;
    for (const item of this.inventory.getItems()) if (isWeaponItemId(item.itemId)) this.player.unlockWeapon(item.itemId, false);
  }

  private getInventoryPanelState(preferredStationId?: string): InventoryPanelState {
    const recipes = this.crafting.getRecipes();
    const station = this.getCraftingStationContext(preferredStationId);
    const itemIds = new Set(recipes.flatMap((recipe) => [...Object.keys(recipe.ingredients), recipe.resultItemId]));
    return {
      containers: this.inventory.getContainers(),
      items: this.inventory.getItems(),
      equipment: this.inventory.getEquipment(),
      quickslots: [...this.quickslots],
      recipes,
      craftAvailability: Object.fromEntries(recipes.map((recipe) => [recipe.id, this.crafting.getAvailability(recipe.id, this.inventory, { ignoreIngredients: this.settings.developerMode, stationKind: station.kind })])),
      itemCounts: Object.fromEntries([...itemIds].map((itemId) => [itemId, this.inventory.count(itemId)])),
      weaponEquipment: this.inventory.getWeaponEquipment(),
      developerMode: this.settings.developerMode,
      inventoryRevision: this.inventory.revision,
      craftingStationKind: station.kind,
      craftingStationName: station.name,
    };
  }

  private getCraftingStationContext(preferredStationId?: string): { kind: CraftingStationKind; name: string } {
    const query = { hasLineOfSight: (from: Point, to: Point) => this.collision.hasLineOfSight(from, to) };
    let station: CraftingStationRegistration | undefined;
    if (preferredStationId) {
      const preferred = this.craftingStations.get(preferredStationId);
      if (preferred && squaredDistance(this.player.position, preferred) <= 72 ** 2 && query.hasLineOfSight(this.player.position, preferred)) station = preferred;
    }
    station ??= this.craftingStations.findBest(this.player.position, query);
    return station ? { kind: station.kind, name: `${CRAFTING_STATION_LABEL[station.kind]} · ${station.id}` } : { kind: "hand", name: CRAFTING_STATION_LABEL.hand };
  }

  private setDeveloperMode(enabled: boolean): void {
    this.settings = this.settingsStore.setDeveloperMode(enabled);
    this.pauseMenu.setDeveloperMode(enabled);
    if(!enabled&&this.pendingBuildPlacement?.source.kind==="developer"){const costs=getBuildCostItems(BUILDABLE_DEFINITIONS[this.pendingBuildPlacement.buildableId]);if(costs.every((cost)=>this.inventory.count(cost.itemId)>=cost.quantity))this.pendingBuildPlacement.source={kind:"materials"};else{this.cancelBuildPlacement();this.hud.showMessage("재료가 없어 개발자 건축 배치를 취소했습니다.");}}
    this.refreshInventoryPanel();
    this.refreshInventoryPanel();
    this.minimap.invalidateMarkers();
    this.hud.showMessage(`개발자 모드 ${enabled ? "켜짐" : "꺼짐"}`);
  }

  private setZombieSpawningEnabled(enabled: boolean): void {
    const change = setZombieSpawnToggle(this.zombieSpawnToggle, enabled, this.simulationTime);
    this.settings = this.settingsStore.setZombieSpawningEnabled(enabled);
    this.pauseMenu.setZombieSpawningEnabled(enabled);
    if (change === "disabled") this.clearZombiesForTestToggle();
    if (change === "enabled") {
      this.nextDormantActivationAt = this.simulationTime;
      this.nextHordeActivationAt = this.simulationTime;
      this.nextNightSpawnAt = this.simulationTime;
      this.nextDefenseSpawnAt = this.simulationTime;
    }
    if (change !== "unchanged") this.hud.showMessage(`테스트용 좀비 스폰 ${enabled ? "ON" : "OFF"}`);
  }

  private clearZombiesForTestToggle(): void {
    const dormantSpawnIds = new Set(this.map.zombieSpawns.map((spawn) => spawn.id));
    for (const zombie of this.zombies) {
      this.worldObjects.unregister(zombie.id);
      zombie.view.destroy();
      if (dormantSpawnIds.has(zombie.id)) this.consumedZombieSpawnIds.delete(zombie.id);
    }
    this.zombies.length = 0;
    this.minimapZombieSources.length = 0;
    this.teamVisibleZombies.length = 0;
    this.projectileTargets.length = 0;
    this.turretTargetScratch.length = 0;
    this.activeZombieCount = 0;
    this.nextDormantActivationAt = Number.POSITIVE_INFINITY;
    this.nextHordeActivationAt = Number.POSITIVE_INFINITY;
    this.nextNightSpawnAt = Number.POSITIVE_INFINITY;
    this.nextDefenseSpawnAt = Number.POSITIVE_INFINITY;
    this.hordeSpawnCursor = 0;
    this.noise.clear();
    this.minimap.invalidateMarkers();
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
    if (!canSpawnZombies(this.zombieSpawnToggle)) return;
    const restoreBatch = consumeZombieRestoreBatch(this.zombieSpawnToggle, this.simulationTime);
    if (restoreBatch > 0) this.activateDormantZombieSpawns(this.countActiveLivingZombies() + restoreBatch, ZOMBIE_ACTIVATION_RADIUS);
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
    if (!canSpawnZombies(this.zombieSpawnToggle)) return;
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
    if (!canSpawnZombies(this.zombieSpawnToggle)) return;
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
    if (!canSpawnZombies(this.zombieSpawnToggle)) return 0;
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
    this.powerGrid.rebuild(this.structures, getPlacedStructureCenter);
    const graphics = this.powerWireGraphics;
    if (!graphics) return;
    graphics.clear().lineStyle(1, 0x777d7a, 0.82);
    const byId = new Map(this.structures.map((state) => [state.id, state]));
    for (const edge of this.powerGrid.getEdges()) {
      const first = byId.get(edge.fromId); const second = byId.get(edge.toId);
      if (!first || !second) continue;
      const fromCenter = getPlacedStructureCenter(first);
      const toCenter = getPlacedStructureCenter(second);
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
        for (const id of changed) this.structureViews.get(id)?.updateStatus?.();
        this.fogInvalidation.invalidate();
      }
    }
    for (const turret of this.structures) {
      if (turret.kind !== "turret") continue;
      const runtime = this.turretRuntime.get(turret.id)!;
      if (!turret.powered) { runtime.target = undefined; continue; }
      const origin = getPlacedStructureCenter(turret);
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
      this.structureViews.get(turret.id)?.setAim?.(turret.aimAngle);
      if (Math.abs(angleDifference(targetAngle, turret.aimAngle)) > TURRET_AIM_TOLERANCE || this.simulationTime < runtime.nextFireAt) continue;
      runtime.nextFireAt = this.simulationTime + TURRET_COOLDOWN_MS;
      this.noise.emitGunshot("turret", origin.x, origin.y, 72, this.simulationTime);
      const shot = this.attackEffects.play({ weapon: "turret", originX: origin.x, originY: origin.y, angle: turret.aimAngle, startedAt: this.simulationTime, impacts: [], alwaysShowCore: false });
      this.spawnProjectile("turret", turret.id, "turret", origin, turret.aimAngle, shot.sequence, 0);
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
      flashlightAimBucket: flashlightActive ? Math.round(this.player.aimAngle / (Math.PI * 2 / FLASHLIGHT_AIM_BUCKETS)) : -1,
      visionRevision: this.collision.visionRevision,
      ambientRadiusBucket: Math.round(vision.ambientRadius / FOG_CELL_SIZE),
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
      id: `turret:${turret.id}`, ...getPlacedStructureCenter(turret), radius: TURRET_RANGE, intensity: 1, sourceType: "turret",
    });
    this.fog.recompute(sources, this.collision);
    const calculationFinished = performance.now();
    this.fogRenderer.render();
    this.occluderSurfaceRenderer.render(this.fog,sources,this.structures,this.structureRegistry.revision*1_000_000+this.collision.visionRevision);
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
    const weapon = this.player.equippedWeapon ? WEAPON_DEFINITIONS[this.player.equippedWeapon] : null;
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
      weaponId: weapon?.id ?? "knife",
      weapon: weapon?.name ?? "비무장",
      magazine: this.player.magazine,
      reserveAmmo: weapon?.ammoItemId ? this.inventory.count(weapon.ammoItemId) : 0,
      showAmmo: weapon?.kind === "ranged",
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
      mapGenerationVersion:this.map.mapGenerationVersion,
      mapSeed: this.map.mapSeed,
      seed: this.seed,
      rngState: this.rng.getSeedState(),
      savedAt: Date.now(),
      player: {
        x: this.player.position.x,
        y: this.player.position.y,
        health: this.player.vitals.health,
        infection: this.player.vitals.infection,
        equippedWeapon: this.player.equippedWeapon ?? "",
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
      structures: this.structures.map(({ powered: _powered, ...state }) => ({ ...state, storage: this.structureStorage.get(state.id)?.snapshot() ?? state.storage })),
      nextStructureId: this.structureCounter,
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
        postureValue: zombie.posture.value,
        postureRecoveryRemainingMs: Math.max(0, zombie.posture.recoveryStartsAt - this.simulationTime),
        postureStaggerRemainingMs: Math.max(0, zombie.posture.staggerUntil - this.simulationTime),
        postureBreakImmunityRemainingMs: Math.max(0, zombie.posture.breakImmunityUntil - this.simulationTime),
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
    this.cancelBuildPlacement();
    this.cancelMeleeAction();
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
    this.cancelBuildPlacement();
    this.game.canvas.removeEventListener("contextmenu", this.preventCanvasContextMenu);
    window.removeEventListener("pointerup", this.handleWindowBuildPointerUp);
    this.game.canvas.removeEventListener("pointercancel", this.handleBuildPointerCancel);
    this.game.canvas.removeEventListener("lostpointercapture", this.handleBuildPointerCancel);
    this.audio?.destroy();
    this.cameraController?.destroy();
    this.performanceMonitor?.destroy();
    this.projectiles?.destroy();
    this.effects?.destroy();
    this.fogRenderer?.destroy();
    this.occluderSurfaceRenderer?.destroy();
    this.hud?.destroy();
    this.dayAnnouncement?.destroy();
    this.inventoryPanel?.destroy();
    this.commandPanel?.destroy();
    this.pauseMenu?.destroy();
    this.minimap?.destroy();
    this.crosshair?.destroy();
    this.worldStoragePanel?.destroy();
    this.buildPreview?.destroy();
    this.structureChunks?.destroy();
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

function structureFootprintsOverlap(tileX: number, tileY: number, width: number, height: number, state: PlacedStructureState): boolean {
  if (state.placement.kind !== "footprint") return false;
  const footprint = getRotatedStructureFootprint(state.kind, state.placement.rotation);
  return tileX < state.tileX + footprint.width && tileX + width > state.tileX && tileY < state.tileY + footprint.height && tileY + height > state.tileY;
}

function drawObbOutline(graphics:Phaser.GameObjects.Graphics,obb:OrientedRectangle):void{const c=Math.cos(obb.angle),s=Math.sin(obb.angle),ux=c*obb.halfWidth,uy=s*obb.halfWidth,vx=-s*obb.halfHeight,vy=c*obb.halfHeight,corners=[{x:obb.x-ux-vx,y:obb.y-uy-vy},{x:obb.x+ux-vx,y:obb.y+uy-vy},{x:obb.x+ux+vx,y:obb.y+uy+vy},{x:obb.x-ux+vx,y:obb.y-uy+vy}];for(let index=0;index<4;index+=1){const a=corners[index]!,b=corners[(index+1)%4]!;graphics.lineBetween(a.x,a.y,b.x,b.y);}}

function rotateAngleToward(current: number, target: number, maximumStep: number): number {
  const difference = angleDelta(target, current);
  if (Math.abs(difference) <= maximumStep) return target;
  return current + Math.sign(difference) * Math.max(0, maximumStep);
}
