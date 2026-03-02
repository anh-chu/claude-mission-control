import { getItem } from "@/items/item-registry";

interface FloatingText {
  el: HTMLDivElement;
  timer: number;
  duration: number;
}

const FLOAT_DURATION = 1.5; // seconds
const FLOAT_DISTANCE = 60;  // pixels upward

export class PickupText {
  private container: HTMLDivElement;
  private texts: FloatingText[] = [];

  constructor() {
    this.container = document.createElement("div");
    Object.assign(this.container.style, {
      position: "fixed",
      top: "45%",
      left: "50%",
      transform: "translateX(-50%)",
      pointerEvents: "none",
      zIndex: "50",
      textAlign: "center",
    });
  }

  mount(): void { document.body.appendChild(this.container); }
  unmount(): void { this.container.remove(); this.texts = []; }

  /** Call when an item is picked up */
  show(itemId: string, quantity: number): void {
    const def = getItem(itemId);
    const name = def?.name ?? itemId;
    const color = def?.color ?? "#FFFFFF";

    const el = document.createElement("div");
    const label = quantity > 1 ? `+${quantity} ${name}` : `+1 ${name}`;
    el.textContent = label;
    Object.assign(el.style, {
      color,
      fontFamily: "monospace",
      fontSize: "16px",
      fontWeight: "bold",
      textShadow: "1px 1px 3px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.5)",
      whiteSpace: "nowrap",
      opacity: "1",
      transition: "none",
      position: "relative",
      top: "0px",
    });

    this.container.appendChild(el);
    this.texts.push({ el, timer: 0, duration: FLOAT_DURATION });
  }

  update(dt: number): void {
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const ft = this.texts[i];
      ft.timer += dt;
      const progress = ft.timer / ft.duration;

      if (progress >= 1) {
        ft.el.remove();
        this.texts.splice(i, 1);
        continue;
      }

      // Float upward and fade out
      const yOffset = -progress * FLOAT_DISTANCE;
      const opacity = 1 - progress * progress; // ease-out fade
      ft.el.style.top = `${yOffset}px`;
      ft.el.style.opacity = String(opacity);
    }
  }
}
