/** Shared color swatch palette used across project, initiative, and map dialogs. */
export const COLOR_SWATCHES = [
	"#fa520f",
	"#fb6424",
	"#ff8105",
	"#ffa110",
	"#ffb83e",
	"#ffd06a",
	"#ffd900",
	"#1f1f1f",
] as const;

export type ColorSwatch = (typeof COLOR_SWATCHES)[number];
