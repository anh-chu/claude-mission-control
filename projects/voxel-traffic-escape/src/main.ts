import * as THREE from "three";
import { createRenderer, handleResize } from "@/engine/renderer";
import { createScene, createLighting } from "@/engine/scene";
import { createCamera } from "@/engine/camera";
import { GameLoop } from "@/engine/game-loop";
import { Input } from "@/engine/input";
import { HealthSystem } from "@/player/health";
import { HealthBar } from "@/hud/health-bar";
import { ScrapCounter } from "@/hud/scrap-counter";
import { ScreenShake, InvincibilityFlash } from "@/effects/damage-effects";
import { FallDamageTracker } from "@/player/fall-damage";
import { PlayerController } from "@/player/player-controller";
import { InventoryController } from "@/items/inventory-controller";
import { LootSystem } from "@/loot/loot-system";
import { CombatController } from "@/combat/combat-controller";
import { EnemyManager } from "@/enemies/enemy-manager";
import { Enemy } from "@/enemies/enemy";
import { CombatParticles } from "@/effects/combat-particles";
import { ChunkManager } from "@/world/chunk-manager";
import { TrafficManager } from "@/entities/traffic";
import { BlockInteraction } from "@/world/block-interaction";
import { Crosshair } from "@/hud/crosshair";
import { EnemyHealthBar } from "@/hud/enemy-health-bar";
import { GameStats } from "@/game/game-stats";
import { WinCondition } from "@/game/win-condition";
import { WinScreen } from "@/ui/win-screen";
import { MainMenu } from "@/ui/main-menu";
import { PauseMenu } from "@/ui/pause-menu";
import { DeathScreen } from "@/ui/death-screen";
import { ZoneIndicator } from "@/ui/zone-indicator";
import { TutorialSystem } from "@/ui/tutorial-system";
import { ToastSystem, RecipeDiscoveryTracker } from "@/ui/toast";
import { ShieldSystem } from "@/combat/shield-system";
import { Minimap } from "@/hud/minimap";
import { PickupText } from "@/hud/pickup-text";
import { getItem } from "@/items/item-registry";
import { audioEngine } from "@/audio/audio-engine";
import { AmbientManager } from "@/audio/ambient-manager";
import { MusicManager } from "@/audio/music-manager";
import { VolumeUI } from "@/audio/volume-ui";
import {
  playPlayerDamage, playPlayerDeath, playHeal, playRespawn,
  playMeleeSwing, playMeleeHit, playLethalHit, playEnemyDeath,
  playRangedFire, playProjectileHit,
  playMiningChip, playBlockBreak, playBlockPlace,
  playItemPickup, playItemDrop,
  playSlotSelect, playInventoryToggle,
  playFootstep, playJump, playLanding, playFallDamage,
} from "@/audio/sfx";

// ── Game states ──────────────────────────────────────────────────────

type GameState = "menu" | "playing" | "paused" | "dead";

// ── Init ─────────────────────────────────────────────────────────────

function init(): void {
  // Core engine setup
  const renderer = createRenderer();
  const scene = createScene();
  const camera = createCamera();

  // Lighting
  createLighting(scene);

  // Handle window resize
  handleResize(renderer, camera);

  const canvas = renderer.domElement;

  // --- Input (disabled until game starts) ---
  const input = new Input();
  input.setEnabled(false);

  // --- Audio system ---
  // Init on first user click (required by browser autoplay policy)
  const initAudio = (): void => {
    audioEngine.init();
    audioEngine.resume();
    document.removeEventListener("click", initAudio);
    document.removeEventListener("keydown", initAudio);
  };
  document.addEventListener("click", initAudio);
  document.addEventListener("keydown", initAudio);

  const ambientManager = new AmbientManager();
  const musicManager = new MusicManager();
  const volumeUI = new VolumeUI();

  // --- Inventory system ---
  const inventoryCtrl = new InventoryController(input, scene);

  // --- Loot system ---
  const lootSystem = new LootSystem(scene, inventoryCtrl, input);
  // Tutorial item: tire iron near spawn so player learns to pick up & mine
  spawnTutorialItems(lootSystem);
  // Spawn street zone loot containers and items
  spawnStreetZoneLoot(lootSystem);
  // Spawn underground zone loot (sewer, MARTA, caves)
  spawnUndergroundLoot(lootSystem);

  // --- Voxel world ---
  const chunkManager = new ChunkManager(scene, 4);

  // --- Highway traffic ---
  const trafficManager = new TrafficManager(scene);

  // --- Player controller (FPS camera + movement + collision) ---
  const player = new PlayerController(camera, input, chunkManager);
  // Initial chunk load around spawn position
  chunkManager.update(camera.position.x, camera.position.y, camera.position.z);

  // --- Block interaction (break/place) ---
  const blockInteraction = new BlockInteraction(input, chunkManager, scene, camera);
  blockInteraction.setInventory(inventoryCtrl.inventory);

  // --- Crosshair ---
  const crosshair = new Crosshair();

  // --- Player health system ---
  const health = new HealthSystem();
  const screenShake = new ScreenShake();
  const _invincibilityFlash = new InvincibilityFlash();
  const fallDamage = new FallDamageTracker(health);

  // --- Shield system ---
  const shieldSystem = new ShieldSystem(inventoryCtrl.inventory);
  health.setShieldSystem(shieldSystem);

  // --- Combat system ---
  const combatCtrl = new CombatController(
    input,
    inventoryCtrl.inventory,
    scene,
    camera,
    screenShake
  );

  // --- Combat particles ---
  const combatParticles = new CombatParticles(scene);

  // --- Enemy AI system ---
  const enemyManager = new EnemyManager(scene, chunkManager);
  enemyManager.setCombatCallbacks(
    (target) => combatCtrl.registerTarget(target),
    (id) => combatCtrl.unregisterTarget(id)
  );
  enemyManager.generateSpawnPoints();

  // --- Tutorial system ---
  const tutorialSystem = new TutorialSystem();

  // --- Toast system + recipe discovery ---
  const toastSystem = new ToastSystem();
  const recipeTracker = new RecipeDiscoveryTracker(
    toastSystem, inventoryCtrl.inventory, inventoryCtrl.crafting
  );

  // --- Minimap ---
  const minimap = new Minimap();

  // --- Pickup text ---
  const pickupText = new PickupText();

  // --- HUD ---
  HealthBar.injectStyles();
  const healthBar = new HealthBar(health);
  const scrapCounter = new ScrapCounter(health);
  const enemyHealthBar = new EnemyHealthBar();
  const zoneIndicator = new ZoneIndicator();

  // --- UI Screens ---
  const mainMenu = new MainMenu();
  const pauseMenu = new PauseMenu();
  const deathScreen = new DeathScreen();

  // ── Game State Machine ─────────────────────────────────────────────

  let gameState: GameState = "menu";
  let hudMounted = false;

  function mountHUD(): void {
    if (hudMounted) return;
    hudMounted = true;
    healthBar.mount();
    scrapCounter.mount();
    crosshair.mount();
    enemyHealthBar.mount();
    zoneIndicator.mount();
    tutorialSystem.mount();
    toastSystem.mount();
    minimap.mount();
    pickupText.mount();
  }

  function unmountHUD(): void {
    if (!hudMounted) return;
    hudMounted = false;
    healthBar.unmount();
    scrapCounter.unmount();
    crosshair.destroy();
    enemyHealthBar.unmount();
    zoneIndicator.unmount();
    tutorialSystem.unmount();
    toastSystem.unmount();
    minimap.unmount();
    pickupText.unmount();
  }

  function startGame(): void {
    gameState = "playing";
    input.setEnabled(true);
    mountHUD();
    canvas.requestPointerLock();
    showControlsHint();
  }

  function pauseGame(): void {
    if (gameState !== "playing") return;
    gameState = "paused";
    input.setEnabled(false);
    if (inventoryCtrl.isInventoryOpen) {
      inventoryCtrl.closeInventory();
    }
    pauseMenu.show();
  }

  function resumeGame(): void {
    gameState = "playing";
    input.setEnabled(true);
    pauseMenu.hide();
    canvas.requestPointerLock();
  }

  function quitToMenu(): void {
    gameState = "menu";
    pauseMenu.hide();
    unmountHUD();
    mainMenu.mount();
  }

  function handleDeath(): void {
    gameState = "dead";
    input.setEnabled(false);
    document.exitPointerLock();
    const scrapLost = Math.floor(health.scrap * 0.25);
    deathScreen.show(scrapLost);
  }

  function handleRespawn(): void {
    const checkpoint = health.respawn();
    if (checkpoint) {
      player.position.set(
        checkpoint.position.x,
        checkpoint.position.y,
        checkpoint.position.z
      );
    }
    deathScreen.hide();
    gameState = "playing";
    input.setEnabled(true);
    canvas.requestPointerLock();
  }

  // Wire up UI callbacks
  mainMenu.onStart(startGame);
  pauseMenu.onResume(resumeGame);
  pauseMenu.onQuit(quitToMenu);
  deathScreen.onRespawn(handleRespawn);

  // React to health events with screen shake + audio
  health.on((type, data) => {
    if (type === "damage" && data && "actualDamage" in data) {
      const intensity = Math.min(0.5, data.actualDamage / 50);
      screenShake.shake(intensity, 0.3);
      playPlayerDamage();
    }
    if (type === "heal" && data && "isTick" in data && !data.isTick) {
      playHeal();
    }
    if (type === "death") {
      screenShake.shake(0.8, 0.6);
      playPlayerDeath();
      handleDeath();
    }
    if (type === "respawn") {
      playRespawn();
    }
  });

  // React to combat events with audio + particles
  combatCtrl.combat.on((event) => {
    if (event.type === "attack_start") {
      if (event.weapon.type === "ranged") {
        playRangedFire();
      } else {
        playMeleeSwing();
      }
    }
    if (event.type === "attack_hit") {
      for (const hit of event.hits) {
        const pos = hit.target.position;
        const color = (hit.target as Enemy).typeDef?.color ?? "#ff6633";
        if (hit.lethal) {
          playLethalHit();
          playEnemyDeath();
          combatParticles.spawnDeathBurst(pos.x, pos.y, pos.z, color);
        } else {
          playMeleeHit();
          combatParticles.spawnHitSparks(pos.x, pos.y, pos.z, color);
        }
      }
    }
  });

  // React to projectile hits with audio + particles
  combatCtrl.projectiles.on((event) => {
    if (event.type === "projectile_hit") {
      for (const hit of event.hits) {
        const pos = hit.target.position;
        const color = (hit.target as Enemy).typeDef?.color ?? "#ff6633";
        if (hit.lethal) {
          playLethalHit();
          playEnemyDeath();
          combatParticles.spawnDeathBurst(pos.x, pos.y, pos.z, color);
        } else {
          playProjectileHit();
          combatParticles.spawnHitSparks(pos.x, pos.y, pos.z, color);
        }
      }
    }
  });

  // React to inventory events with audio + tutorial + recipe discovery
  inventoryCtrl.inventory.onChange((type) => {
    if (type === "item_added") {
      playItemPickup();
      tutorialSystem.onItemAdded();
      recipeTracker.checkNewRecipes();

      // Count crafting materials for tutorial
      let craftMatCount = 0;
      const inv = inventoryCtrl.inventory;
      for (const slot of [...inv.hotbar, ...inv.backpack]) {
        if (slot) {
          const def = getItem(slot.itemId);
          if (def?.category === "crafting_material") craftMatCount += slot.quantity;
        }
      }
      tutorialSystem.onCraftingMaterialCount(craftMatCount);
    }
    if (type === "selected_changed") playSlotSelect();
    if (type === "item_removed") playItemDrop();
  });

  // React to item pickups with floating text
  inventoryCtrl.onItemPickup = (itemId, quantity) => {
    pickupText.show(itemId, quantity);
  };

  // --- Game stats + win condition ---
  const gameStats = new GameStats();
  const winCondition = new WinCondition();
  const winScreen = new WinScreen();
  let gameWon = false;

  // Track enemy kills via combat events
  combatCtrl.combat.on((event) => {
    if (event.type === "attack_hit") {
      for (const hit of event.hits) {
        if (hit.lethal) gameStats.recordEnemyKill();
      }
    }
  });
  combatCtrl.projectiles.on((event) => {
    if (event.type === "projectile_hit") {
      for (const hit of event.hits) {
        if (hit.lethal) gameStats.recordEnemyKill();
      }
    }
  });

  // Track block mining/placing (stats + audio)
  blockInteraction.onBlockBroken = () => {
    gameStats.recordBlockMined();
    playBlockBreak();
  };
  blockInteraction.onBlockPlaced = () => {
    gameStats.recordBlockPlaced();
    playBlockPlace();
  };
  blockInteraction.onMiningChip = () => playMiningChip();

  // Win handler
  winCondition.onWin(() => {
    gameWon = true;
    gameStats.stop();
    winScreen.show(gameStats);
  });

  // ── Escape key handling ────────────────────────────────────────────

  window.addEventListener("keydown", (e) => {
    if (e.code === "Escape") {
      if (gameState === "paused") {
        resumeGame();
      }
      // When playing: ESC releases pointer lock (browser behavior),
      // which triggers pointerlockchange → pauseGame().
    }
  });

  // Pointer lock loss → auto-pause
  document.addEventListener("pointerlockchange", () => {
    if (!document.pointerLockElement && gameState === "playing") {
      pauseGame();
    }
  });

  // --- Footstep tracking ---
  let footstepTimer = 0;
  const WALK_STEP_INTERVAL = 0.45;
  const SPRINT_STEP_INTERVAL = 0.3;
  let wasOnGround = true;

  // --- FPS counter (bottom-left, below hotbar) ---
  const fpsEl = document.createElement("div");
  fpsEl.style.cssText =
    "position:fixed;bottom:8px;left:8px;color:#0f0;font:bold 12px monospace;" +
    "background:rgba(0,0,0,0.5);padding:3px 6px;z-index:9999;pointer-events:none;" +
    "border-radius:2px";
  document.body.appendChild(fpsEl);
  let fpsFrames = 0;
  let fpsTime = 0;

  // ── Controls hint (fades out on first play) ────────────────────────

  let controlsHintShown = false;

  function showControlsHint(): void {
    if (controlsHintShown) return;
    controlsHintShown = true;

    const hint = document.createElement("div");
    Object.assign(hint.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      background: "rgba(0,0,0,0.7)",
      padding: "16px 24px",
      borderRadius: "8px",
      fontFamily: "monospace",
      fontSize: "14px",
      color: "#E8E4DC",
      textAlign: "center",
      zIndex: "60",
      pointerEvents: "none",
      opacity: "1",
      transition: "opacity 1s ease",
      border: "1px solid rgba(255,255,255,0.1)",
      lineHeight: "2",
    } satisfies Partial<CSSStyleDeclaration>);

    hint.innerHTML = [
      '<span style="color:#F5C518">WASD</span> Move',
      '<span style="color:#F5C518">MOUSE</span> Look',
      '<br>',
      '<span style="color:#F5C518">LEFT CLICK</span> Attack',
      '<span style="color:#F5C518">E</span> Inventory',
      '<br>',
      '<span style="color:#F5C518">F</span> Interact',
      '<span style="color:#F5C518">ESC</span> Pause',
    ].join(" &nbsp; ");

    document.body.appendChild(hint);

    setTimeout(() => {
      hint.style.opacity = "0";
      setTimeout(() => hint.remove(), 1000);
    }, 4000);
  }

  // ── Game loop ──────────────────────────────────────────────────────

  const gameLoop = new GameLoop(renderer, scene, camera);

  gameLoop.onUpdate((dt) => {
    // FPS counting (always runs)
    fpsFrames++;
    fpsTime += dt;
    if (fpsTime >= 1) {
      const fps = Math.round(fpsFrames / fpsTime);
      const info = renderer.info;
      fpsEl.textContent =
        `${fps} FPS | ${info.render.triangles} tris | ` +
        `${info.render.calls} draws | ${chunkManager.loadedCount} chunks`;
      fpsFrames = 0;
      fpsTime = 0;
    }

    // Skip gameplay updates when not playing
    if (gameState !== "playing") {
      input.endFrame();
      return;
    }

    // Player controller: movement, physics, collision, camera
    player.update(dt);

    // Apply screen shake on top of player camera position
    const shakeOffset = screenShake.update(dt);
    player.applyShakeOffset(shakeOffset);

    // Update chunk loading based on player position
    chunkManager.update(camera.position.x, camera.position.y, camera.position.z);

    // Update block interaction (break/place)
    blockInteraction.update(dt);
    crosshair.setProgress(blockInteraction.progress);

    // Update inventory system
    inventoryCtrl.update(dt);

    // Update loot system (container interaction, prompts)
    lootSystem.update(dt);

    // Update combat system + weapon viewmodel bob
    const isMovingForViewmodel = input.isHeld("moveForward") || input.isHeld("moveBack") ||
                                 input.isHeld("moveLeft") || input.isHeld("moveRight");
    combatCtrl.viewmodel.setMovement(
      isMovingForViewmodel && player.isOnGround,
      input.isHeld("sprint") && input.isHeld("moveForward"),
    );
    combatCtrl.update(dt);

    // Update shield blocking state (right-click = block when not placing blocks)
    const isBlockInput = input.isHeld("place") && !inventoryCtrl.isInventoryOpen;
    shieldSystem.update(dt, isBlockInput);

    // Update enemy AI system
    enemyManager.update(dt, player.position, health);

    // Update highway traffic
    trafficManager.update(dt, player.position.x, player.position.z, health);

    // Update health systems
    health.update(dt);
    healthBar.update(dt);
    scrapCounter.update();

    // Update combat particles
    combatParticles.update(dt);

    // Update enemy health bar targeting overlay
    enemyHealthBar.update(dt, camera, enemyManager.getActiveEnemies());

    // Fall damage tracker (with audio)
    const dmg = fallDamage.update(player.position.y, player.isOnGround);
    if (dmg > 0) {
      playFallDamage();
    }

    // --- Audio: footsteps, jump, landing ---
    const isMoving = input.isHeld("moveForward") || input.isHeld("moveBack") ||
                     input.isHeld("moveLeft") || input.isHeld("moveRight");
    const isSprinting = input.isHeld("sprint") && input.isHeld("moveForward");
    const stepInterval = isSprinting ? SPRINT_STEP_INTERVAL : WALK_STEP_INTERVAL;

    // Landing sound
    if (!wasOnGround && player.isOnGround) {
      playLanding(1.0);
    }
    // Jump sound
    if (input.isJustPressed("jump") && player.isOnGround) {
      playJump();
    }
    // Footsteps while moving on ground
    if (player.isOnGround && isMoving) {
      footstepTimer += dt;
      if (footstepTimer >= stepInterval) {
        footstepTimer -= stepInterval;
        playFootstep(isSprinting);
      }
    } else {
      footstepTimer = 0;
    }

    wasOnGround = player.isOnGround;

    // --- Audio: inventory toggle ---
    if (input.isJustPressed("inventory")) {
      playInventoryToggle();
      if (inventoryCtrl.isInventoryOpen) {
        tutorialSystem.onInventoryOpened();
      }
    }

    // --- Audio: ambient + music ---
    ambientManager.update(dt, player.position.x, player.position.y);
    musicManager.update(dt, player.position.x, player.position.y);

    // --- Game stats + win condition ---
    gameStats.update(dt);
    if (!gameWon) {
      winCondition.update(player.position);
    }

    // --- Zone indicator ---
    zoneIndicator.update(
      player.position.x,
      player.position.y,
      camera.rotation.y
    );

    // --- Tutorial system ---
    tutorialSystem.update(dt, player.position.x, player.position.y);

    // --- Toast system ---
    toastSystem.update(dt);

    // --- Pickup text ---
    pickupText.update(dt);

    // --- Minimap ---
    minimap.update(
      dt,
      player.position.x,
      player.position.z,
      camera.rotation.y,
      enemyManager.getActiveEnemies()
    );

    // End-of-frame input bookkeeping
    input.endFrame();
  });

  // --- Debug: expose systems for console testing ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as unknown as Record<string, unknown>;
  win["health"] = health;
  win["healthBar"] = healthBar;
  win["inventory"] = inventoryCtrl.inventory;
  win["crafting"] = inventoryCtrl.crafting;
  win["inventoryCtrl"] = inventoryCtrl;
  win["lootSystem"] = lootSystem;
  win["combat"] = combatCtrl;
  win["enemyManager"] = enemyManager;
  win["chunkManager"] = chunkManager;
  win["trafficManager"] = trafficManager;
  win["player"] = player;
  win["blockInteraction"] = blockInteraction;
  win["audioEngine"] = audioEngine;
  win["gameStats"] = gameStats;
  win["winCondition"] = winCondition;

  // --- Boot sequence: hide loading → show main menu ---
  const loadingEl = document.getElementById("loading");
  if (loadingEl) {
    loadingEl.style.display = "none";
  }

  mainMenu.mount();
  gameLoop.start();
}

/** Spawn a tire iron (crowbar) and health pickup right near spawn as a tutorial.
 *  Player starts at (0, 6, 0) facing +X. Place items a few meters ahead
 *  so the player immediately sees them and learns to pick up items and mine. */
function spawnTutorialItems(lootSystem: LootSystem): void {
  const gy = 4.5; // slightly above ground level (4m) so items are visible
  lootSystem.spawnWorldItems([
    // Tire iron right in the player's path — the "crowbar" tutorial
    { itemId: "tire_iron", quantity: 1, position: new THREE.Vector3(4, gy, 1) },
    // A health pickup nearby to teach healing
    { itemId: "gas_station_snack", quantity: 2, position: new THREE.Vector3(6, gy, -1) },
    // An energy drink a bit further ahead to reward exploration
    { itemId: "energy_drink", quantity: 1, position: new THREE.Vector3(12, gy, 0) },
  ]);
}

/** Spawn loot containers and items throughout the street zone */
function spawnStreetZoneLoot(lootSystem: LootSystem): void {
  // GROUND_Y = 8 voxels, voxel size = 0.5m => 4m world height
  const gy = 4;

  // Dumpsters along streets
  lootSystem.spawnContainers([
    { type: "dumpster", position: new THREE.Vector3(190, gy, -8), zone: "street" },
    { type: "dumpster", position: new THREE.Vector3(210, gy, 6), zone: "street" },
    { type: "dumpster", position: new THREE.Vector3(230, gy, -12), zone: "street" },
    { type: "dumpster", position: new THREE.Vector3(250, gy, 10), zone: "street" },
    { type: "dumpster", position: new THREE.Vector3(265, gy, -5), zone: "street" },
    { type: "dumpster", position: new THREE.Vector3(280, gy, 8), zone: "street" },
  ]);

  // Toolboxes in construction areas
  lootSystem.spawnContainers([
    { type: "toolbox", position: new THREE.Vector3(273, gy, -5), zone: "street" },
    { type: "toolbox", position: new THREE.Vector3(275, gy, 3), zone: "street" },
    { type: "toolbox", position: new THREE.Vector3(278, gy, -8), zone: "street" },
  ]);

  // Crates inside buildings
  lootSystem.spawnContainers([
    { type: "crate", position: new THREE.Vector3(195, gy, -3), zone: "street" },
    { type: "crate", position: new THREE.Vector3(220, gy, 4), zone: "street" },
    { type: "crate", position: new THREE.Vector3(245, gy, -6), zone: "street" },
    { type: "crate", position: new THREE.Vector3(260, gy, 7), zone: "street" },
  ]);

  // Special chest near construction zone with Tier 3 loot
  lootSystem.spawnContainers([
    {
      type: "chest",
      position: new THREE.Vector3(272, gy, 0),
      fixedLoot: [
        { itemId: "jackhammer", quantity: 1 },
        { itemId: "energy_drink", quantity: 2 },
        { itemId: "scrap", quantity: 30 },
      ],
    },
  ]);

  // Placed items (health pickups along the route)
  lootSystem.spawnWorldItems([
    { itemId: "energy_drink", quantity: 1, position: new THREE.Vector3(200, gy, 0) },
    { itemId: "first_aid_kit", quantity: 1, position: new THREE.Vector3(235, gy, -5) },
    { itemId: "energy_drink", quantity: 1, position: new THREE.Vector3(255, gy, 3) },
    { itemId: "first_aid_kit", quantity: 1, position: new THREE.Vector3(270, gy, -2) },
  ]);
}

/** Spawn loot containers and items throughout the underground zone */
function spawnUndergroundLoot(lootSystem: LootSystem): void {
  // Voxel-to-world helper: voxel * 0.5 = world meters
  const v = (vx: number, vy: number, vz: number) =>
    new THREE.Vector3(vx * 0.5, vy * 0.5, vz * 0.5);

  // MARTA station lockers and crates (on platform at vy=-14)
  lootSystem.spawnContainers([
    { type: "locker", position: v(310, -14, -8), zone: "underground" },
    { type: "locker", position: v(305, -14, -8), zone: "underground" },
    { type: "crate", position: v(315, -14, 8), zone: "underground" },
  ]);

  // Main tunnel crates at junction points (floor at vy=-19)
  lootSystem.spawnContainers([
    { type: "crate", position: v(240, -19, 3), zone: "underground" },
    { type: "crate", position: v(300, -19, 4), zone: "underground" },
    { type: "crate", position: v(360, -19, -3), zone: "underground" },
    { type: "crate", position: v(420, -19, 2), zone: "underground" },
  ]);

  // Pipe stashes in branch tunnels (vy=-17)
  lootSystem.spawnContainers([
    { type: "pipe_stash", position: v(280, -17, 30), zone: "underground" },
    { type: "pipe_stash", position: v(320, -17, -30), zone: "underground" },
    { type: "pipe_stash", position: v(350, -17, 15), zone: "underground" },
  ]);

  // Utility corridor lockers
  lootSystem.spawnContainers([
    { type: "locker", position: v(290, -17, -15), zone: "underground" },
    { type: "locker", position: v(340, -17, 15), zone: "underground" },
  ]);

  // Hidden chest in cave area (rare loot)
  lootSystem.spawnContainers([
    {
      type: "chest",
      position: v(310, -22, 20),
      fixedLoot: [
        { itemId: "rebar_sword", quantity: 1 },
        { itemId: "first_aid_kit", quantity: 2 },
        { itemId: "scrap", quantity: 30 },
      ],
    },
  ]);

  // MARTA station chest (key item)
  lootSystem.spawnContainers([
    {
      type: "chest",
      position: v(310, -14, 0),
      fixedLoot: [
        { itemId: "marta_pass", quantity: 1 },
        { itemId: "energy_drink", quantity: 1 },
      ],
    },
  ]);

  // Near manhole exits — supply caches
  lootSystem.spawnContainers([
    { type: "crate", position: v(418, -19, 2), zone: "underground" },
    { type: "pipe_stash", position: v(260, -17, 14), zone: "underground" },
  ]);

  // Placed health pickups in tunnels
  lootSystem.spawnWorldItems([
    { itemId: "energy_drink", quantity: 1, position: v(260, -19, 0) },
    { itemId: "first_aid_kit", quantity: 1, position: v(330, -19, 0) },
    { itemId: "energy_drink", quantity: 1, position: v(380, -19, 0) },
    { itemId: "energy_drink", quantity: 1, position: v(310, -14, 5) },
  ]);
}

init();
