/** Shared color swatch palette used across project, initiative, and map dialogs. */
export const COLOR_SWATCHES = [
	"#E2F1EA", // mint
	"#FDE8E1", // peach
	"#EAE6F3", // lavender
	"#E1EDF8", // sky
	"#F8E6E9", // rose
	"#1f1f1f", // ink
] as const;

export type ColorSwatch = (typeof COLOR_SWATCHES)[number];
