/**
 * Pause menu overlay — shown when the game is paused (Escape key).
 *
 * Options: RESUME, CONTROLS, QUIT TO MENU
 */

import { ControlsHelp } from "@/ui/controls-help";

const COLORS = {
  bg: "rgba(0, 0, 0, 0.75)",
  panelBg: "rgba(30, 28, 26, 0.95)",
  gold: "#F5C518",
  text: "#E8E4DC",
  textDim: "rgba(232,228,220,0.5)",
  buttonBg: "rgba(60,58,55,0.8)",
  buttonHover: "rgba(245,197,24,0.2)",
  buttonBorder: "rgba(255,255,255,0.15)",
  dangerText: "#E05555",
  dangerHover: "rgba(224,85,85,0.2)",
};

export class PauseMenu {
  private overlay: HTMLDivElement | null = null;
  private onResumeCallback: (() => void) | null = null;
  private onQuitCallback: (() => void) | null = null;
  private controlsHelp: ControlsHelp;

  constructor() {
    this.controlsHelp = new ControlsHelp();
  }

  onResume(callback: () => void): void {
    this.onResumeCallback = callback;
  }

  onQuit(callback: () => void): void {
    this.onQuitCallback = callback;
  }

  show(): void {
    if (this.overlay) return;
    this.overlay = this.build();
    document.body.appendChild(this.overlay);
  }

  hide(): void {
    this.overlay?.remove();
    this.overlay = null;
    this.controlsHelp.hide();
  }

  get isVisible(): boolean {
    return this.overlay !== null;
  }

  private build(): HTMLDivElement {
    const overlay = document.createElement("div");
    overlay.id = "pause-menu";
    Object.assign(overlay.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      background: COLORS.bg,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "150",
      fontFamily: "monospace",
      color: COLORS.text,
    } satisfies Partial<CSSStyleDeclaration>);

    const panel = document.createElement("div");
    Object.assign(panel.style, {
      background: COLORS.panelBg,
      borderRadius: "8px",
      padding: "32px 40px",
      border: `1px solid rgba(255,255,255,0.1)`,
      minWidth: "280px",
      textAlign: "center",
    } satisfies Partial<CSSStyleDeclaration>);

    // Title
    const title = document.createElement("div");
    title.textContent = "PAUSED";
    Object.assign(title.style, {
      fontSize: "20px",
      fontWeight: "bold",
      color: COLORS.gold,
      letterSpacing: "4px",
      marginBottom: "24px",
    } satisfies Partial<CSSStyleDeclaration>);
    panel.appendChild(title);

    // Buttons
    const buttons = document.createElement("div");
    Object.assign(buttons.style, {
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    } satisfies Partial<CSSStyleDeclaration>);

    // RESUME
    buttons.appendChild(
      this.createButton("RESUME", () => {
        this.hide();
        this.onResumeCallback?.();
      }, true)
    );

    // CONTROLS
    buttons.appendChild(
      this.createButton("CONTROLS", () => {
        this.controlsHelp.show();
      })
    );

    // QUIT TO MENU
    buttons.appendChild(
      this.createButton("QUIT TO MENU", () => {
        this.hide();
        this.onQuitCallback?.();
      }, false, true)
    );

    panel.appendChild(buttons);

    // Hint
    const hint = document.createElement("div");
    hint.textContent = "Press [ESC] to resume";
    Object.assign(hint.style, {
      fontSize: "11px",
      color: COLORS.textDim,
      marginTop: "16px",
    } satisfies Partial<CSSStyleDeclaration>);
    panel.appendChild(hint);

    overlay.appendChild(panel);
    return overlay;
  }

  private createButton(
    text: string,
    onClick: () => void,
    primary = false,
    danger = false
  ): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.textContent = text;

    const textColor = danger ? COLORS.dangerText : primary ? COLORS.gold : COLORS.text;
    const borderColor = primary ? COLORS.gold : COLORS.buttonBorder;

    Object.assign(btn.style, {
      padding: "12px 24px",
      border: primary
        ? `2px solid ${COLORS.gold}`
        : `1px solid ${borderColor}`,
      borderRadius: "4px",
      background: primary ? "rgba(245,197,24,0.15)" : COLORS.buttonBg,
      color: textColor,
      fontFamily: "monospace",
      fontSize: "14px",
      fontWeight: "bold",
      letterSpacing: "2px",
      cursor: "pointer",
      transition: "all 0.15s ease",
    } satisfies Partial<CSSStyleDeclaration>);

    btn.addEventListener("mouseenter", () => {
      btn.style.background = danger
        ? COLORS.dangerHover
        : primary
          ? "rgba(245,197,24,0.3)"
          : COLORS.buttonHover;
      btn.style.borderColor = danger ? COLORS.dangerText : COLORS.gold;
    });

    btn.addEventListener("mouseleave", () => {
      btn.style.background = primary
        ? "rgba(245,197,24,0.15)"
        : COLORS.buttonBg;
      btn.style.borderColor = borderColor;
    });

    btn.addEventListener("click", onClick);
    return btn;
  }
}
