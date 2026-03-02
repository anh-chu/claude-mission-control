import * as THREE from "three";

export type UpdateCallback = (deltaTime: number) => void;

export class GameLoop {
  private clock: THREE.Clock;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private updateCallbacks: UpdateCallback[] = [];
  private animationFrameId: number | null = null;

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera
  ) {
    this.clock = new THREE.Clock();
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
  }

  onUpdate(callback: UpdateCallback): void {
    this.updateCallbacks.push(callback);
  }

  start(): void {
    this.clock.start();
    this.tick();
  }

  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private tick = (): void => {
    this.animationFrameId = requestAnimationFrame(this.tick);

    const delta = this.clock.getDelta();
    // Clamp delta to prevent spiral of death on tab-away
    const clampedDelta = Math.min(delta, 1 / 20);

    for (const callback of this.updateCallbacks) {
      callback(clampedDelta);
    }

    this.renderer.render(this.scene, this.camera);
  };
}
