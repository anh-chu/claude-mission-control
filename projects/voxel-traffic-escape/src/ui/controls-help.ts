/**
 * Controls help overlay — shows all keybindings.
 * Used by both main menu and pause menu.
 */

const COLORS = {
  bg: "rgba(0, 0, 0, 0.85)",
  panelBg: "rgba(30, 28, 26, 0.95)",
  gold: "#F5C518",
  text: "#E8E4DC",
  textDim: "rgba(232,228,220,0.5)",
  keyBg: "rgba(80, 78, 75, 0.8)",
  keyBorder: "rgba(255,255,255,0.2)",
};

interface ControlBinding {
  keys: string;
  action: string;
}

const CONTROL_SECTIONS: { title: string; bindings: ControlBinding[] }[] = [
  {
    title: "MOVEMENT",
    bindings: [
      { keys: "W A S D", action: "Move" },
      { keys: "SPACE", action: "Jump" },
      { keys: "SHIFT", action: "Sprint" },
      { keys: "MOUSE", action: "Look around" },
    ],
  },
  {
    title: "COMBAT",
    bindings: [
      { keys: "LEFT CLICK", action: "Attack / Mine block" },
      { keys: "RIGHT CLICK", action: "Place block" },
    ],
  },
  {
    title: "INVENTORY",
    bindings: [
      { keys: "E", action: "Open/close inventory" },
      { keys: "1-8", action: "Select hotbar slot" },
      { keys: "F", action: "Interact / Pick up" },
      { keys: "Q", action: "Drop item" },
    ],
  },
  {
    title: "SYSTEM",
    bindings: [
      { keys: "ESC", action: "Pause game" },
    ],
  },
];

export class ControlsHelp {
  private overlay: HTMLDivElement | null = null;

  show(): void {
    if (this.overlay) return;
    this.overlay = this.build();
    document.body.appendChild(this.overlay);
  }

  hide(): void {
    this.overlay?.remove();
    this.overlay = null;
  }

  get isVisible(): boolean {
    return this.overlay !== null;
  }

  private build(): HTMLDivElement {
    const overlay = document.createElement("div");
    overlay.id = "controls-help";
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
      zIndex: "300",
      fontFamily: "monospace",
      color: COLORS.text,
    } satisfies Partial<CSSStyleDeclaration>);

    // Close on click outside panel
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this.hide();
    });

    const panel = document.createElement("div");
    Object.assign(panel.style, {
      background: COLORS.panelBg,
      borderRadius: "8px",
      padding: "24px 32px",
      border: "1px solid rgba(255,255,255,0.1)",
      maxWidth: "420px",
      width: "90%",
      maxHeight: "80vh",
      overflowY: "auto",
    } satisfies Partial<CSSStyleDeclaration>);

    // Title
    const title = document.createElement("div");
    title.textContent = "CONTROLS";
    Object.assign(title.style, {
      fontSize: "18px",
      fontWeight: "bold",
      color: COLORS.gold,
      letterSpacing: "3px",
      textAlign: "center",
      marginBottom: "20px",
    } satisfies Partial<CSSStyleDeclaration>);
    panel.appendChild(title);

    // Sections
    for (const section of CONTROL_SECTIONS) {
      panel.appendChild(this.buildSection(section.title, section.bindings));
    }

    // Close hint
    const hint = document.createElement("div");
    hint.textContent = "Click outside or press any key to close";
    Object.assign(hint.style, {
      fontSize: "11px",
      color: COLORS.textDim,
      textAlign: "center",
      marginTop: "16px",
    } satisfies Partial<CSSStyleDeclaration>);
    panel.appendChild(hint);

    overlay.appendChild(panel);

    // Close on any keypress
    const onKey = (): void => {
      this.hide();
      window.removeEventListener("keydown", onKey);
    };
    // Delay listener to avoid the key that opened this from closing it
    setTimeout(() => window.addEventListener("keydown", onKey), 100);

    return overlay;
  }

  private buildSection(
    sectionTitle: string,
    bindings: ControlBinding[]
  ): HTMLDivElement {
    const section = document.createElement("div");
    section.style.marginBottom = "16px";

    // Section header
    const header = document.createElement("div");
    header.textContent = sectionTitle;
    Object.assign(header.style, {
      fontSize: "11px",
      fontWeight: "bold",
      color: COLORS.textDim,
      letterSpacing: "1px",
      marginBottom: "8px",
      borderBottom: `1px solid rgba(255,255,255,0.1)`,
      paddingBottom: "4px",
    } satisfies Partial<CSSStyleDeclaration>);
    section.appendChild(header);

    // Bindings
    for (const binding of bindings) {
      const row = document.createElement("div");
      Object.assign(row.style, {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "6px",
      } satisfies Partial<CSSStyleDeclaration>);

      // Key badge(s)
      const keysEl = document.createElement("div");
      keysEl.style.display = "flex";
      keysEl.style.gap = "4px";

      for (const key of binding.keys.split(" ")) {
        const badge = document.createElement("span");
        badge.textContent = key;
        Object.assign(badge.style, {
          background: COLORS.keyBg,
          border: `1px solid ${COLORS.keyBorder}`,
          borderRadius: "3px",
          padding: "2px 8px",
          fontSize: "11px",
          fontWeight: "bold",
          color: COLORS.text,
        } satisfies Partial<CSSStyleDeclaration>);
        keysEl.appendChild(badge);
      }

      row.appendChild(keysEl);

      // Action label
      const actionEl = document.createElement("span");
      actionEl.textContent = binding.action;
      Object.assign(actionEl.style, {
        fontSize: "12px",
        color: COLORS.textDim,
      } satisfies Partial<CSSStyleDeclaration>);
      row.appendChild(actionEl);

      section.appendChild(row);
    }

    return section;
  }
}
