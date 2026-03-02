/**
 * Procedural sound effects for all game actions.
 *
 * Each function synthesizes a short sound using oscillators and noise.
 * Grouped by category: mining, combat, pickup, UI.
 */

import { audioEngine } from "./audio-engine";

// ── Mining & Building ─────────────────────────────────────────────────

/** Mining chip — short stony tap. */
export function playMiningChip(): void {
  if (!audioEngine.initialized) return;
  audioEngine.playNoise(0.06, 0.15, 2500, "highpass");
  audioEngine.playTone(300 + Math.random() * 200, 0.05, "square", 0.08);
}

/** Block destroyed — crunchy impact burst. */
export function playBlockBreak(): void {
  if (!audioEngine.initialized) return;
  audioEngine.playNoise(0.15, 0.3, 800, "lowpass");
  audioEngine.playTone(120, 0.12, "square", 0.15);
  audioEngine.playSweep(400, 80, 0.15, "sawtooth", 0.1);
}

/** Block placed — solid thunk. */
export function playBlockPlace(): void {
  if (!audioEngine.initialized) return;
  audioEngine.playTone(200, 0.08, "square", 0.2);
  audioEngine.playNoise(0.05, 0.15, 600, "lowpass");
}

// ── Combat ────────────────────────────────────────────────────────────

/** Melee swing — whoosh. */
export function playMeleeSwing(): void {
  if (!audioEngine.initialized) return;
  audioEngine.playFilteredNoise(0.2, 0.2, 300, 2000, "bandpass");
}

/** Melee hit on enemy — impact thud. */
export function playMeleeHit(): void {
  if (!audioEngine.initialized) return;
  audioEngine.playNoise(0.1, 0.35, 400, "lowpass");
  audioEngine.playTone(100, 0.08, "square", 0.2);
}

/** Lethal hit on enemy — deeper, more satisfying. */
export function playLethalHit(): void {
  if (!audioEngine.initialized) return;
  audioEngine.playNoise(0.2, 0.4, 300, "lowpass");
  audioEngine.playSweep(200, 60, 0.25, "square", 0.25);
  audioEngine.playTone(80, 0.15, "sawtooth", 0.15);
}

/** Enemy death — descending tone + noise burst. */
export function playEnemyDeath(): void {
  if (!audioEngine.initialized) return;
  audioEngine.playSweep(400, 80, 0.4, "square", 0.2);
  audioEngine.playNoise(0.3, 0.25, 500, "lowpass");
}

/** Ranged weapon fire (nail gun, throwing). */
export function playRangedFire(): void {
  if (!audioEngine.initialized) return;
  audioEngine.playSweep(800, 1200, 0.08, "square", 0.2);
  audioEngine.playNoise(0.06, 0.15, 3000, "highpass");
}

/** Projectile impact. */
export function playProjectileHit(): void {
  if (!audioEngine.initialized) return;
  audioEngine.playNoise(0.1, 0.25, 600, "lowpass");
  audioEngine.playTone(150, 0.06, "square", 0.15);
}

/** Player takes damage — low crunch. */
export function playPlayerDamage(): void {
  if (!audioEngine.initialized) return;
  audioEngine.playSweep(300, 100, 0.2, "sawtooth", 0.3);
  audioEngine.playNoise(0.15, 0.3, 500, "lowpass");
}

/** Player death — dramatic descending. */
export function playPlayerDeath(): void {
  if (!audioEngine.initialized) return;
  audioEngine.playSweep(500, 50, 0.8, "sawtooth", 0.3);
  audioEngine.playNoise(0.5, 0.2, 300, "lowpass");

  const ctx = audioEngine.ctx;
  // Low rumble undertone
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 40;
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
  osc.connect(gain);
  gain.connect(audioEngine.sfxGain);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 1.1);
}

/** Player respawn — ascending chime. */
export function playRespawn(): void {
  if (!audioEngine.initialized) return;
  audioEngine.playSweep(200, 600, 0.3, "sine", 0.2);
  // Delayed second tone for "ding ding" effect
  setTimeout(() => {
    if (!audioEngine.initialized) return;
    audioEngine.playTone(800, 0.2, "sine", 0.15);
  }, 150);
}

/** Player heal — gentle rising tone. */
export function playHeal(): void {
  if (!audioEngine.initialized) return;
  audioEngine.playSweep(400, 700, 0.15, "sine", 0.15);
}

/** Enemy aggro alert — short aggressive tone. */
export function playEnemyAggro(): void {
  if (!audioEngine.initialized) return;
  audioEngine.playTone(250, 0.1, "square", 0.12);
  audioEngine.playTone(350, 0.1, "square", 0.1);
}

/** Enemy melee attack — grunting swing. */
export function playEnemyAttack(): void {
  if (!audioEngine.initialized) return;
  audioEngine.playFilteredNoise(0.12, 0.15, 200, 800, "bandpass");
  audioEngine.playTone(120, 0.08, "sawtooth", 0.1);
}

/** Enemy ranged attack — whoosh + pew. */
export function playEnemyRangedAttack(): void {
  if (!audioEngine.initialized) return;
  audioEngine.playSweep(600, 1000, 0.08, "square", 0.12);
  audioEngine.playNoise(0.04, 0.1, 2000, "highpass");
}

/** Shield block — metallic clang. */
export function playShieldBlock(): void {
  if (!audioEngine.initialized) return;
  audioEngine.playTone(800, 0.06, "square", 0.2);
  audioEngine.playTone(1200, 0.04, "sine", 0.12);
  audioEngine.playNoise(0.05, 0.1, 3000, "highpass");
}

/** Traffic vehicle pass — doppler whoosh. */
export function playTrafficPass(): void {
  if (!audioEngine.initialized) return;
  audioEngine.playFilteredNoise(0.4, 0.06, 200, 1500, "bandpass");
}

// ── Pickups & Items ───────────────────────────────────────────────────

/** Item pickup — short cheerful bloop. */
export function playItemPickup(): void {
  if (!audioEngine.initialized) return;
  audioEngine.playSweep(400, 800, 0.1, "sine", 0.2);
}

/** Loot container opened — creaky/mechanical. */
export function playContainerOpen(): void {
  if (!audioEngine.initialized) return;
  audioEngine.playFilteredNoise(0.15, 0.15, 400, 1200, "bandpass");
  audioEngine.playSweep(150, 300, 0.12, "square", 0.1);
}

/** Item drop — soft thud. */
export function playItemDrop(): void {
  if (!audioEngine.initialized) return;
  audioEngine.playTone(150, 0.08, "square", 0.12);
  audioEngine.playNoise(0.05, 0.1, 400, "lowpass");
}

// ── UI Sounds ─────────────────────────────────────────────────────────

/** Hotbar slot select — tiny click. */
export function playSlotSelect(): void {
  if (!audioEngine.initialized) return;
  audioEngine.playTone(1000, 0.03, "square", 0.1);
}

/** Inventory open/close — soft whoosh. */
export function playInventoryToggle(): void {
  if (!audioEngine.initialized) return;
  audioEngine.playFilteredNoise(0.1, 0.1, 600, 2000, "bandpass");
}

/** Craft success — satisfying two-note chime. */
export function playCraftSuccess(): void {
  if (!audioEngine.initialized) return;
  audioEngine.playTone(523, 0.1, "sine", 0.2); // C5
  setTimeout(() => {
    if (!audioEngine.initialized) return;
    audioEngine.playTone(659, 0.15, "sine", 0.2); // E5
  }, 100);
}

/** Craft failure — buzzer. */
export function playCraftFailure(): void {
  if (!audioEngine.initialized) return;
  audioEngine.playTone(150, 0.2, "square", 0.15);
}

// ── Movement ──────────────────────────────────────────────────────────

/** Footstep — varies per surface. */
export function playFootstep(isSprinting: boolean): void {
  if (!audioEngine.initialized) return;
  const vol = isSprinting ? 0.1 : 0.06;
  const freq = 200 + Math.random() * 100;
  audioEngine.playNoise(0.05, vol, freq, "lowpass");
}

/** Jump — small burst. */
export function playJump(): void {
  if (!audioEngine.initialized) return;
  audioEngine.playSweep(200, 400, 0.1, "sine", 0.1);
}

/** Landing — thud proportional to fall speed. */
export function playLanding(intensity: number): void {
  if (!audioEngine.initialized) return;
  const vol = Math.min(0.3, intensity * 0.15);
  audioEngine.playNoise(0.1, vol, 300, "lowpass");
  audioEngine.playTone(80, 0.08, "square", vol * 0.5);
}

/** Fall damage impact. */
export function playFallDamage(): void {
  if (!audioEngine.initialized) return;
  audioEngine.playNoise(0.2, 0.35, 200, "lowpass");
  audioEngine.playTone(60, 0.15, "square", 0.2);
}
