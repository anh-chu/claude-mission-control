/**
 * Tracks gameplay statistics for the end-game stats screen.
 *
 * Counters: enemies defeated, blocks mined, blocks placed.
 * Timer: total play time in seconds.
 */

export class GameStats {
  private _enemiesDefeated = 0;
  private _blocksMined = 0;
  private _blocksPlaced = 0;
  private _elapsedSec = 0;
  private _running = true;

  /** Increment enemies defeated counter */
  recordEnemyKill(): void {
    this._enemiesDefeated++;
  }

  /** Increment blocks mined counter */
  recordBlockMined(): void {
    this._blocksMined++;
  }

  /** Increment blocks placed counter */
  recordBlockPlaced(): void {
    this._blocksPlaced++;
  }

  /** Call each frame to accumulate play time */
  update(dt: number): void {
    if (this._running) {
      this._elapsedSec += dt;
    }
  }

  /** Stop the timer (e.g. on win) */
  stop(): void {
    this._running = false;
  }

  get enemiesDefeated(): number {
    return this._enemiesDefeated;
  }

  get blocksMined(): number {
    return this._blocksMined;
  }

  get blocksPlaced(): number {
    return this._blocksPlaced;
  }

  get elapsedSec(): number {
    return this._elapsedSec;
  }

  /** Formatted time as MM:SS */
  get formattedTime(): string {
    const mins = Math.floor(this._elapsedSec / 60);
    const secs = Math.floor(this._elapsedSec % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
}
