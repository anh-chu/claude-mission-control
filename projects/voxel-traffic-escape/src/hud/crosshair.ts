/**
 * Simple crosshair overlay — centered on screen.
 * Changes color when targeting a block, shows break progress ring.
 */

export class Crosshair {
  private el: HTMLDivElement;
  private progressRing: HTMLDivElement;

  constructor() {
    // Crosshair container
    this.el = document.createElement("div");
    this.el.style.cssText =
      "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);" +
      "width:24px;height:24px;pointer-events:none;z-index:9998";

    // Vertical line
    const v = document.createElement("div");
    v.style.cssText =
      "position:absolute;left:50%;top:2px;transform:translateX(-50%);" +
      "width:2px;height:20px;background:rgba(255,255,255,0.8);" +
      "mix-blend-mode:difference";
    this.el.appendChild(v);

    // Horizontal line
    const h = document.createElement("div");
    h.style.cssText =
      "position:absolute;top:50%;left:2px;transform:translateY(-50%);" +
      "width:20px;height:2px;background:rgba(255,255,255,0.8);" +
      "mix-blend-mode:difference";
    this.el.appendChild(h);

    // Break progress ring (conic gradient)
    this.progressRing = document.createElement("div");
    this.progressRing.style.cssText =
      "position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);" +
      "width:28px;height:28px;border-radius:50%;opacity:0;" +
      "pointer-events:none";
    this.el.appendChild(this.progressRing);
  }

  mount(): void {
    document.body.appendChild(this.el);
  }

  /** Update the break progress indicator (0..1) */
  setProgress(progress: number): void {
    if (progress <= 0) {
      this.progressRing.style.opacity = "0";
      return;
    }

    const pct = Math.round(progress * 100);
    this.progressRing.style.opacity = "1";
    this.progressRing.style.background =
      `conic-gradient(rgba(255,80,80,0.9) ${pct}%, transparent ${pct}%)`;
  }

  destroy(): void {
    this.el.remove();
  }
}
