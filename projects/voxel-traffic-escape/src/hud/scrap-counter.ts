import { type HealthSystem } from "@/player/health";

export class ScrapCounter {
  private el: HTMLDivElement;
  private health: HealthSystem;
  private _lastScrap = -1;

  constructor(health: HealthSystem) {
    this.health = health;
    this.el = document.createElement("div");
    // Style: positioned below HP bar (which is top-left).
    // Use monospace font, gold color (#F5C518), small size.
    // Icon: gear symbol before the number
    Object.assign(this.el.style, {
      position: "fixed",
      top: "90px", // below HP bar
      left: "16px",
      color: "#F5C518",
      fontFamily: "monospace",
      fontSize: "14px",
      fontWeight: "bold",
      textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
      pointerEvents: "none",
      zIndex: "50",
    });
  }

  mount(): void {
    document.body.appendChild(this.el);
  }

  unmount(): void {
    this.el.remove();
  }

  update(): void {
    const s = this.health.scrap;
    if (s !== this._lastScrap) {
      this._lastScrap = s;
      this.el.textContent = `\u2699 ${s}`;
    }
  }
}
