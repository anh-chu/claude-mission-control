/**
 * Zone indicator HUD — shows current zone name and progress through
 * the game world. Displayed in the top-right corner.
 *
 * Zones (based on player X position in world coords):
 *   Highway:    0  – 140m
 *   Collapse:   140 – 176m
 *   Streets:    176m+
 *   Underground: when Y < 0
 */

interface ZoneDef {
  name: string;
  minX: number;
  maxX: number;
  color: string;
}

const ZONE_DEFS: ZoneDef[] = [
  { name: "HIGHWAY", minX: -Infinity, maxX: 140, color: "#7A7A7A" },
  { name: "COLLAPSE ZONE", minX: 140, maxX: 176, color: "#B85C2F" },
  { name: "STREETS", minX: 176, maxX: Infinity, color: "#5A8A5A" },
];

const UNDERGROUND_THRESHOLD_Y = 0;

const COLORS = {
  bg: "rgba(0, 0, 0, 0.5)",
  text: "#E8E4DC",
  textDim: "rgba(232,228,220,0.5)",
  gold: "#F5C518",
  underground: "#4A3A6A",
  barBg: "rgba(255,255,255,0.1)",
};

// Total world length for progress calculation (0 to ~300m)
const WORLD_START = 0;
const WORLD_END = 300;

export class ZoneIndicator {
  private container: HTMLDivElement;
  private zoneName: HTMLDivElement;
  private progressBar: HTMLDivElement;
  private progressFill: HTMLDivElement;
  private compassEl: HTMLDivElement;

  constructor() {
    this.container = document.createElement("div");
    this.container.id = "zone-indicator";
    Object.assign(this.container.style, {
      position: "fixed",
      top: "16px",
      right: "16px",
      zIndex: "50",
      fontFamily: "monospace",
      userSelect: "none",
      pointerEvents: "none",
      textAlign: "right",
    } satisfies Partial<CSSStyleDeclaration>);

    // Zone name
    this.zoneName = document.createElement("div");
    Object.assign(this.zoneName.style, {
      fontSize: "12px",
      fontWeight: "bold",
      letterSpacing: "2px",
      color: COLORS.text,
      marginBottom: "4px",
    } satisfies Partial<CSSStyleDeclaration>);
    this.container.appendChild(this.zoneName);

    // Progress bar container
    this.progressBar = document.createElement("div");
    Object.assign(this.progressBar.style, {
      width: "140px",
      height: "4px",
      background: COLORS.barBg,
      borderRadius: "2px",
      overflow: "hidden",
      marginLeft: "auto",
      marginBottom: "4px",
    } satisfies Partial<CSSStyleDeclaration>);

    // Progress fill
    this.progressFill = document.createElement("div");
    Object.assign(this.progressFill.style, {
      height: "100%",
      width: "0%",
      borderRadius: "2px",
      transition: "width 0.3s ease, background 0.3s ease",
    } satisfies Partial<CSSStyleDeclaration>);
    this.progressBar.appendChild(this.progressFill);
    this.container.appendChild(this.progressBar);

    // Compass
    this.compassEl = document.createElement("div");
    Object.assign(this.compassEl.style, {
      fontSize: "10px",
      color: COLORS.textDim,
    } satisfies Partial<CSSStyleDeclaration>);
    this.container.appendChild(this.compassEl);
  }

  mount(): void {
    document.body.appendChild(this.container);
  }

  unmount(): void {
    this.container.remove();
  }

  /**
   * Update the zone indicator based on player position and yaw.
   * @param x Player world X position
   * @param y Player world Y position
   * @param yaw Player yaw in radians (0 = +Z, PI = -Z)
   */
  update(x: number, y: number, yaw: number): void {
    // Determine zone
    const isUnderground = y < UNDERGROUND_THRESHOLD_Y;

    let zoneDef = ZONE_DEFS[0];
    if (!isUnderground) {
      for (const z of ZONE_DEFS) {
        if (x >= z.minX && x < z.maxX) {
          zoneDef = z;
          break;
        }
      }
    }

    const displayName = isUnderground ? "UNDERGROUND" : zoneDef.name;
    const displayColor = isUnderground ? COLORS.underground : zoneDef.color;

    this.zoneName.textContent = displayName;
    this.zoneName.style.color = displayColor;

    // Progress (0-100% through the world)
    const progress = Math.max(0, Math.min(1, (x - WORLD_START) / (WORLD_END - WORLD_START)));
    this.progressFill.style.width = `${progress * 100}%`;
    this.progressFill.style.background = displayColor;

    // Compass direction from yaw
    // yaw=0 → looking +Z (South), yaw=PI → looking -Z (North)
    // In this game, +X = East (toward streets), -X = West (toward highway start)
    const deg = (((-yaw * 180) / Math.PI) % 360 + 360) % 360;
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const idx = Math.round(deg / 45) % 8;
    this.compassEl.textContent = directions[idx];
  }
}
