/**
 * Main menu screen — displayed on game load.
 *
 * Options: NEW GAME, CONTROLS
 * Styled to match the game's dark + gold (#F5C518) theme.
 */

import { ControlsHelp } from "@/ui/controls-help";

const COLORS = {
  bg: "rgba(26, 23, 20, 0.97)",
  gold: "#F5C518",
  text: "#E8E4DC",
  textDim: "rgba(232,228,220,0.5)",
  buttonBg: "rgba(60,58,55,0.8)",
  buttonHover: "rgba(245,197,24,0.2)",
  buttonBorder: "rgba(255,255,255,0.15)",
};

export class MainMenu {
  private overlay: HTMLDivElement | null = null;
  private onStartCallback: (() => void) | null = null;
  private controlsHelp: ControlsHelp;

  constructor() {
    this.controlsHelp = new ControlsHelp();
  }

  onStart(callback: () => void): void {
    this.onStartCallback = callback;
  }

  mount(): void {
    this.overlay = this.build();
    document.body.appendChild(this.overlay);
  }

  unmount(): void {
    this.overlay?.remove();
    this.overlay = null;
    this.controlsHelp.hide();
  }

  get isVisible(): boolean {
    return this.overlay !== null;
  }

  private build(): HTMLDivElement {
    const overlay = document.createElement("div");
    overlay.id = "main-menu";
    Object.assign(overlay.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      background: COLORS.bg,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      zIndex: "200",
      fontFamily: "monospace",
      color: COLORS.text,
    } satisfies Partial<CSSStyleDeclaration>);

    // Title
    const title = document.createElement("h1");
    title.textContent = "VOXEL TRAFFIC ESCAPE";
    Object.assign(title.style, {
      fontSize: "36px",
      color: COLORS.gold,
      marginBottom: "8px",
      letterSpacing: "4px",
      textAlign: "center",
    } satisfies Partial<CSSStyleDeclaration>);
    overlay.appendChild(title);

    // Subtitle
    const subtitle = document.createElement("p");
    subtitle.textContent = "Escape Atlanta traffic... or die trying";
    Object.assign(subtitle.style, {
      fontSize: "14px",
      color: COLORS.textDim,
      marginBottom: "48px",
      textAlign: "center",
    } satisfies Partial<CSSStyleDeclaration>);
    overlay.appendChild(subtitle);

    // Button container
    const buttons = document.createElement("div");
    Object.assign(buttons.style, {
      display: "flex",
      flexDirection: "column",
      gap: "12px",
      width: "260px",
    } satisfies Partial<CSSStyleDeclaration>);

    // NEW GAME
    buttons.appendChild(
      this.createButton("NEW GAME", () => {
        this.unmount();
        this.onStartCallback?.();
      }, true)
    );

    // CONTROLS
    buttons.appendChild(
      this.createButton("CONTROLS", () => {
        this.controlsHelp.show();
      })
    );

    overlay.appendChild(buttons);

    // Version
    const version = document.createElement("div");
    version.textContent = "v0.1.0 — Early Alpha";
    Object.assign(version.style, {
      position: "absolute",
      bottom: "16px",
      right: "16px",
      fontSize: "11px",
      color: COLORS.textDim,
    } satisfies Partial<CSSStyleDeclaration>);
    overlay.appendChild(version);

    return overlay;
  }

  private createButton(
    text: string,
    onClick: () => void,
    primary = false
  ): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.textContent = text;
    Object.assign(btn.style, {
      padding: "14px 24px",
      border: primary
        ? `2px solid ${COLORS.gold}`
        : `1px solid ${COLORS.buttonBorder}`,
      borderRadius: "4px",
      background: primary ? "rgba(245,197,24,0.15)" : COLORS.buttonBg,
      color: primary ? COLORS.gold : COLORS.text,
      fontFamily: "monospace",
      fontSize: "16px",
      fontWeight: "bold",
      letterSpacing: "3px",
      cursor: "pointer",
      transition: "all 0.15s ease",
    } satisfies Partial<CSSStyleDeclaration>);

    btn.addEventListener("mouseenter", () => {
      btn.style.background = primary
        ? "rgba(245,197,24,0.3)"
        : COLORS.buttonHover;
      btn.style.borderColor = COLORS.gold;
    });

    btn.addEventListener("mouseleave", () => {
      btn.style.background = primary
        ? "rgba(245,197,24,0.15)"
        : COLORS.buttonBg;
      btn.style.borderColor = primary ? COLORS.gold : COLORS.buttonBorder;
    });

    btn.addEventListener("click", onClick);
    return btn;
  }
}
