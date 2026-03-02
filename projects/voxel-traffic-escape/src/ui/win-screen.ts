/**
 * End-game win screen overlay.
 *
 * Shows victory message, gameplay stats, and a restart button.
 * Exits pointer lock and displays as a full-screen HTML overlay.
 */

import type { GameStats } from "@/game/game-stats";

const STYLES = `
  .win-overlay {
    position: fixed;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    font-family: monospace;
    color: #E8E4DC;
    pointer-events: all;
    transition: background 1.5s ease;
  }
  .win-overlay.active {
    background: rgba(0, 0, 0, 0.85);
  }
  .win-title {
    font-size: 48px;
    font-weight: bold;
    color: #F5C518;
    margin-bottom: 8px;
    opacity: 0;
    transform: translateY(-20px);
    transition: opacity 0.8s ease 0.5s, transform 0.8s ease 0.5s;
  }
  .win-overlay.active .win-title {
    opacity: 1;
    transform: translateY(0);
  }
  .win-subtitle {
    font-size: 18px;
    color: #B0A890;
    margin-bottom: 40px;
    opacity: 0;
    transition: opacity 0.8s ease 1s;
  }
  .win-overlay.active .win-subtitle {
    opacity: 1;
  }
  .win-stats {
    display: grid;
    grid-template-columns: auto auto;
    gap: 12px 32px;
    margin-bottom: 48px;
    opacity: 0;
    transition: opacity 0.8s ease 1.5s;
  }
  .win-overlay.active .win-stats {
    opacity: 1;
  }
  .stat-label {
    text-align: right;
    color: #908878;
    font-size: 16px;
  }
  .stat-value {
    text-align: left;
    font-size: 20px;
    font-weight: bold;
    color: #F5C518;
  }
  .win-buttons {
    display: flex;
    gap: 16px;
    opacity: 0;
    transition: opacity 0.8s ease 2s;
  }
  .win-overlay.active .win-buttons {
    opacity: 1;
  }
  .win-btn {
    padding: 14px 32px;
    font-family: monospace;
    font-size: 16px;
    font-weight: bold;
    border: 2px solid #F5C518;
    background: transparent;
    color: #F5C518;
    cursor: pointer;
    transition: background 0.2s, color 0.2s;
  }
  .win-btn:hover {
    background: #F5C518;
    color: #1A1714;
  }
`;

export class WinScreen {
  private el: HTMLDivElement | null = null;

  show(stats: GameStats): void {
    // Exit pointer lock
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }

    // Inject styles
    const style = document.createElement("style");
    style.textContent = STYLES;
    document.head.appendChild(style);

    // Build overlay
    const overlay = document.createElement("div");
    overlay.className = "win-overlay";
    overlay.innerHTML = `
      <div class="win-title">YOU MADE IT HOME!</div>
      <div class="win-subtitle">You escaped the Atlanta traffic nightmare.</div>
      <div class="win-stats">
        <span class="stat-label">Time</span>
        <span class="stat-value">${stats.formattedTime}</span>
        <span class="stat-label">Enemies Defeated</span>
        <span class="stat-value">${stats.enemiesDefeated}</span>
        <span class="stat-label">Blocks Mined</span>
        <span class="stat-value">${stats.blocksMined}</span>
        <span class="stat-label">Blocks Placed</span>
        <span class="stat-value">${stats.blocksPlaced}</span>
      </div>
      <div class="win-buttons">
        <button class="win-btn" id="win-play-again">PLAY AGAIN</button>
      </div>
    `;

    document.body.appendChild(overlay);
    this.el = overlay;

    // Trigger entrance animation on next frame
    requestAnimationFrame(() => {
      overlay.classList.add("active");
    });

    // Wire up restart button
    const btn = document.getElementById("win-play-again");
    if (btn) {
      btn.addEventListener("click", () => {
        window.location.reload();
      });
    }
  }
}
