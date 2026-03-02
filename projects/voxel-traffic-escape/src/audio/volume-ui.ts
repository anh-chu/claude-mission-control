/**
 * In-game volume settings panel.
 *
 * Opens with M key — shows sliders for master, SFX, music, and ambient volume.
 * Settings are persisted to localStorage via AudioEngine.
 */

import { audioEngine, type VolumeCategory } from "./audio-engine";

const CATEGORIES: { key: VolumeCategory; label: string }[] = [
  { key: "master", label: "Master" },
  { key: "sfx", label: "SFX" },
  { key: "music", label: "Music" },
  { key: "ambient", label: "Ambient" },
];

export class VolumeUI {
  private container: HTMLDivElement;
  private isOpen = false;
  private sliders: Map<VolumeCategory, HTMLInputElement> = new Map();

  constructor() {
    this.container = document.createElement("div");
    this.container.style.cssText = `
      position: fixed;
      top: 50%;
      right: 20px;
      transform: translateY(-50%);
      background: rgba(0, 0, 0, 0.85);
      border: 2px solid #444;
      border-radius: 8px;
      padding: 16px;
      z-index: 10000;
      display: none;
      font-family: monospace;
      color: #fff;
      min-width: 200px;
      pointer-events: auto;
    `;

    // Title
    const title = document.createElement("div");
    title.textContent = "VOLUME";
    title.style.cssText = `
      font-size: 14px;
      font-weight: bold;
      text-align: center;
      margin-bottom: 12px;
      color: #0f0;
      letter-spacing: 2px;
    `;
    this.container.appendChild(title);

    // Sliders
    for (const { key, label } of CATEGORIES) {
      const row = document.createElement("div");
      row.style.cssText = "margin-bottom: 10px;";

      const labelEl = document.createElement("div");
      labelEl.style.cssText = "font-size: 11px; margin-bottom: 2px; color: #aaa;";
      labelEl.textContent = label;
      row.appendChild(labelEl);

      const sliderRow = document.createElement("div");
      sliderRow.style.cssText = "display: flex; align-items: center; gap: 8px;";

      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = "0";
      slider.max = "100";
      slider.value = String(Math.round(audioEngine.getVolume(key) * 100));
      slider.style.cssText = `
        flex: 1;
        height: 4px;
        accent-color: #0f0;
        cursor: pointer;
      `;

      const valueEl = document.createElement("span");
      valueEl.style.cssText = "font-size: 11px; min-width: 28px; text-align: right; color: #0f0;";
      valueEl.textContent = slider.value + "%";

      slider.addEventListener("input", () => {
        const vol = parseInt(slider.value) / 100;
        audioEngine.setVolume(key, vol);
        valueEl.textContent = slider.value + "%";
      });

      this.sliders.set(key, slider);
      sliderRow.appendChild(slider);
      sliderRow.appendChild(valueEl);
      row.appendChild(sliderRow);
      this.container.appendChild(row);
    }

    // Hint
    const hint = document.createElement("div");
    hint.textContent = "[M] to close";
    hint.style.cssText = `
      font-size: 10px;
      text-align: center;
      color: #666;
      margin-top: 8px;
    `;
    this.container.appendChild(hint);

    document.body.appendChild(this.container);

    // Listen for M key
    window.addEventListener("keydown", this.onKeyDown);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === "KeyM") {
      this.toggle();
    }
  };

  toggle(): void {
    this.isOpen = !this.isOpen;
    this.container.style.display = this.isOpen ? "block" : "none";

    // Sync slider values when opening
    if (this.isOpen) {
      for (const { key } of CATEGORIES) {
        const slider = this.sliders.get(key);
        if (slider) {
          slider.value = String(Math.round(audioEngine.getVolume(key) * 100));
          const valueEl = slider.nextElementSibling as HTMLSpanElement;
          if (valueEl) valueEl.textContent = slider.value + "%";
        }
      }
    }
  }

  destroy(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    this.container.remove();
  }
}
