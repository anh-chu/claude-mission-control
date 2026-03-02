/**
 * Floating damage numbers that pop up when hitting targets.
 * Rendered as HTML overlays projected from 3D world positions.
 */

import * as THREE from "three";

interface FloatingNumber {
  id: number;
  element: HTMLDivElement;
  worldPos: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  maxAge: number;
}

let nextId = 0;

export class DamageNumbers {
  private camera: THREE.PerspectiveCamera;
  private container: HTMLDivElement;
  private active: FloatingNumber[] = [];

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;

    this.container = document.createElement("div");
    this.container.id = "damage-numbers";
    Object.assign(this.container.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: "15",
      overflow: "hidden",
    } satisfies Partial<CSSStyleDeclaration>);

    document.body.appendChild(this.container);
  }

  /**
   * Spawn a damage number at a world position.
   */
  spawn(
    damage: number,
    worldPos: THREE.Vector3,
    isCrit: boolean = false
  ): void {
    const el = document.createElement("div");
    el.textContent = String(Math.round(damage));
    Object.assign(el.style, {
      position: "absolute",
      fontFamily: "monospace",
      fontWeight: "bold",
      fontSize: isCrit ? "22px" : "16px",
      color: isCrit ? "#FF4444" : "#FFCC00",
      textShadow: "2px 2px 0 #000, -1px -1px 0 #000",
      whiteSpace: "nowrap",
      pointerEvents: "none",
      transition: "none",
    } satisfies Partial<CSSStyleDeclaration>);

    this.container.appendChild(el);

    const floater: FloatingNumber = {
      id: nextId++,
      element: el,
      worldPos: worldPos.clone(),
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        3 + Math.random() * 2,
        (Math.random() - 0.5) * 2
      ),
      age: 0,
      maxAge: 1.2,
    };

    this.active.push(floater);
  }

  /**
   * Update all floating numbers. Call once per frame.
   */
  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const num = this.active[i];
      num.age += dt;

      if (num.age >= num.maxAge) {
        num.element.remove();
        this.active.splice(i, 1);
        continue;
      }

      // Float upward — inline math avoids Vector3.clone() allocation per frame
      num.worldPos.x += num.velocity.x * dt;
      num.worldPos.y += num.velocity.y * dt;
      num.worldPos.z += num.velocity.z * dt;
      num.velocity.y -= 5 * dt; // Slight gravity

      // Project to screen
      const screenPos = this.worldToScreen(num.worldPos);

      if (screenPos) {
        num.element.style.left = `${screenPos.x}px`;
        num.element.style.top = `${screenPos.y}px`;
        num.element.style.display = "block";
      } else {
        num.element.style.display = "none";
      }

      // Fade out
      const fadeProgress = num.age / num.maxAge;
      num.element.style.opacity = String(1 - fadeProgress * fadeProgress);
    }
  }

  // Reusable vector for projection (avoids per-call clone)
  private _projVec = new THREE.Vector3();

  private worldToScreen(pos: THREE.Vector3): { x: number; y: number } | null {
    this._projVec.copy(pos).project(this.camera);

    // Behind camera
    if (this._projVec.z > 1) return null;

    return {
      x: (this._projVec.x * 0.5 + 0.5) * window.innerWidth,
      y: (-this._projVec.y * 0.5 + 0.5) * window.innerHeight,
    };
  }

  destroy(): void {
    for (const num of this.active) {
      num.element.remove();
    }
    this.active = [];
    this.container.remove();
  }
}
