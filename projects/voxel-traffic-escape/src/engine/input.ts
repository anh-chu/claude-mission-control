/**
 * Keyboard input handler with edge detection (just-pressed / just-released).
 */

export type Action =
  | "hotbar1" | "hotbar2" | "hotbar3" | "hotbar4"
  | "hotbar5" | "hotbar6" | "hotbar7" | "hotbar8"
  | "inventory" | "interact" | "drop"
  | "moveForward" | "moveBack" | "moveLeft" | "moveRight"
  | "jump" | "sprint" | "attack" | "place";

const DEFAULT_BINDINGS: Record<string, Action> = {
  Digit1: "hotbar1",
  Digit2: "hotbar2",
  Digit3: "hotbar3",
  Digit4: "hotbar4",
  Digit5: "hotbar5",
  Digit6: "hotbar6",
  Digit7: "hotbar7",
  Digit8: "hotbar8",
  KeyE: "inventory",
  KeyF: "interact",
  KeyQ: "drop",
  KeyW: "moveForward",
  KeyS: "moveBack",
  KeyA: "moveLeft",
  KeyD: "moveRight",
  Space: "jump",
  ShiftLeft: "sprint",
  ShiftRight: "sprint",
};

export class Input {
  private held = new Set<Action>();
  private justPressed = new Set<Action>();
  private justReleased = new Set<Action>();
  private bindings: Record<string, Action>;
  private enabled = true;

  /** Maps mouse buttons to actions. 0=left, 1=middle, 2=right */
  private mouseBindings: Record<number, Action> = {
    0: "attack",
    2: "place",
  };

  constructor(bindings?: Record<string, Action>) {
    this.bindings = bindings ?? { ...DEFAULT_BINDINGS };
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("contextmenu", this.onContextMenu);
  }

  private onContextMenu = (e: Event): void => {
    e.preventDefault();
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.enabled) return;
    const action = this.bindings[e.code];
    if (action && !this.held.has(action)) {
      this.held.add(action);
      this.justPressed.add(action);
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const action = this.bindings[e.code];
    if (action && this.held.has(action)) {
      this.held.delete(action);
      this.justReleased.add(action);
    }
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (!this.enabled) return;
    const action = this.mouseBindings[e.button];
    if (action && !this.held.has(action)) {
      this.held.add(action);
      this.justPressed.add(action);
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    const action = this.mouseBindings[e.button];
    if (action && this.held.has(action)) {
      this.held.delete(action);
      this.justReleased.add(action);
    }
  };

  /** True while the action key is held down. */
  isHeld(action: Action): boolean {
    return this.held.has(action);
  }

  /** True only on the first frame the key is pressed. */
  isJustPressed(action: Action): boolean {
    return this.justPressed.has(action);
  }

  /** True only on the frame the key is released. */
  isJustReleased(action: Action): boolean {
    return this.justReleased.has(action);
  }

  /** Call once per frame after all input checks. */
  endFrame(): void {
    this.justPressed.clear();
    this.justReleased.clear();
  }

  /** Disable input processing (e.g., when typing in a UI field). */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.held.clear();
      this.justPressed.clear();
      this.justReleased.clear();
    }
  }

  destroy(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("contextmenu", this.onContextMenu);
  }
}
