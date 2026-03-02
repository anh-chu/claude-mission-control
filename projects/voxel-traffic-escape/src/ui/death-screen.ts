/**
 * Death screen overlay — shown when the player dies.
 * Displays "YOU DIED" and a respawn button.
 */

const COLORS = {
  bg: "rgba(80, 0, 0, 0.7)",
  text: "#E8E4DC",
  textDim: "rgba(232,228,220,0.5)",
  gold: "#F5C518",
  red: "#CC2222",
};

export class DeathScreen {
  private overlay: HTMLDivElement | null = null;
  private onRespawnCallback: (() => void) | null = null;

  onRespawn(callback: () => void): void {
    this.onRespawnCallback = callback;
  }

  show(scrapLost: number): void {
    if (this.overlay) return;
    this.overlay = this.build(scrapLost);
    document.body.appendChild(this.overlay);

    // Fade in
    requestAnimationFrame(() => {
      if (this.overlay) this.overlay.style.opacity = "1";
    });
  }

  hide(): void {
    this.overlay?.remove();
    this.overlay = null;
  }

  get isVisible(): boolean {
    return this.overlay !== null;
  }

  private build(scrapLost: number): HTMLDivElement {
    const overlay = document.createElement("div");
    overlay.id = "death-screen";
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
      zIndex: "160",
      fontFamily: "monospace",
      color: COLORS.text,
      opacity: "0",
      transition: "opacity 1s ease",
    } satisfies Partial<CSSStyleDeclaration>);

    // Death text
    const title = document.createElement("div");
    title.textContent = "YOU DIED";
    Object.assign(title.style, {
      fontSize: "48px",
      fontWeight: "bold",
      color: COLORS.red,
      letterSpacing: "8px",
      marginBottom: "16px",
      textShadow: "0 0 20px rgba(200, 0, 0, 0.5)",
    } satisfies Partial<CSSStyleDeclaration>);
    overlay.appendChild(title);

    // Scrap penalty
    if (scrapLost > 0) {
      const penalty = document.createElement("div");
      penalty.textContent = `-${scrapLost} scrap lost`;
      Object.assign(penalty.style, {
        fontSize: "14px",
        color: COLORS.textDim,
        marginBottom: "32px",
      } satisfies Partial<CSSStyleDeclaration>);
      overlay.appendChild(penalty);
    } else {
      const spacer = document.createElement("div");
      spacer.style.height = "32px";
      overlay.appendChild(spacer);
    }

    // Respawn button
    const btn = document.createElement("button");
    btn.textContent = "RESPAWN";
    Object.assign(btn.style, {
      padding: "14px 32px",
      border: `2px solid ${COLORS.gold}`,
      borderRadius: "4px",
      background: "rgba(245,197,24,0.15)",
      color: COLORS.gold,
      fontFamily: "monospace",
      fontSize: "16px",
      fontWeight: "bold",
      letterSpacing: "3px",
      cursor: "pointer",
      transition: "all 0.15s ease",
    } satisfies Partial<CSSStyleDeclaration>);

    btn.addEventListener("mouseenter", () => {
      btn.style.background = "rgba(245,197,24,0.3)";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = "rgba(245,197,24,0.15)";
    });
    btn.addEventListener("click", () => {
      this.hide();
      this.onRespawnCallback?.();
    });

    overlay.appendChild(btn);

    // Hint
    const hint = document.createElement("div");
    hint.textContent = "Press [SPACE] to respawn";
    Object.assign(hint.style, {
      fontSize: "11px",
      color: COLORS.textDim,
      marginTop: "12px",
    } satisfies Partial<CSSStyleDeclaration>);
    overlay.appendChild(hint);

    // Allow spacebar to respawn
    const onKey = (e: KeyboardEvent): void => {
      if (e.code === "Space") {
        this.hide();
        this.onRespawnCallback?.();
        window.removeEventListener("keydown", onKey);
      }
    };
    setTimeout(() => window.addEventListener("keydown", onKey), 500);

    return overlay;
  }
}
