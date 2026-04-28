import type { Config } from "tailwindcss";

const config: Config = {
	darkMode: ["class"],
	content: ["./src/**/*.{ts,tsx}"],
	theme: {
		extend: {
			colors: {
				background: "var(--background)",
				foreground: "var(--foreground)",
				card: {
					DEFAULT: "var(--card)",
					foreground: "var(--card-foreground)",
				},
				popover: {
					DEFAULT: "var(--popover)",
					foreground: "var(--popover-foreground)",
				},
				primary: {
					DEFAULT: "var(--primary)",
					foreground: "var(--primary-foreground)",
					soft: "var(--primary-soft)",
				},
				secondary: {
					DEFAULT: "var(--secondary)",
					foreground: "var(--secondary-foreground)",
				},
				muted: {
					DEFAULT: "var(--muted)",
					foreground: "var(--muted-foreground)",
				},
				accent: {
					DEFAULT: "var(--accent)",
					foreground: "var(--accent-foreground)",
					soft: "var(--accent-soft)",
				},
				destructive: {
					DEFAULT: "var(--destructive)",
					foreground: "var(--destructive-foreground)",
					soft: "var(--destructive-soft)",
				},
				border: "var(--border)",
				input: "var(--input)",
				ring: "var(--ring)",
				chart: {
					"1": "var(--chart-1)",
					"2": "var(--chart-2)",
					"3": "var(--chart-3)",
					"4": "var(--chart-4)",
					"5": "var(--chart-5)",
				},
				sidebar: {
					DEFAULT: "var(--sidebar-background)",
					foreground: "var(--sidebar-foreground)",
					primary: "var(--sidebar-primary)",
					"primary-foreground": "var(--sidebar-primary-foreground)",
					accent: "var(--sidebar-accent)",
					"accent-foreground": "var(--sidebar-accent-foreground)",
					border: "var(--sidebar-border)",
					ring: "var(--sidebar-ring)",
				},
				// Eisenhower quadrant colors
				"quadrant-do": "var(--quadrant-do)",
				"quadrant-do-soft": "var(--quadrant-do-soft)",
				"quadrant-schedule": "var(--quadrant-schedule)",
				"quadrant-schedule-soft": "var(--quadrant-schedule-soft)",
				"quadrant-delegate": "var(--quadrant-delegate)",
				"quadrant-delegate-soft": "var(--quadrant-delegate-soft)",
				"quadrant-eliminate": "var(--quadrant-eliminate)",
				"quadrant-eliminate-soft": "var(--quadrant-eliminate-soft)",
				// Status colors
				"status-not-started": "var(--status-not-started)",
				"status-in-progress": "var(--status-in-progress)",
				"status-done": "var(--status-done)",
				// Semantic colors
				success: {
					DEFAULT: "var(--success)",
					soft: "var(--success-soft)",
				},
				warning: {
					DEFAULT: "var(--warning)",
					soft: "var(--warning-soft)",
					ink: "var(--warning-ink)",
				},
				info: "var(--info)",
				// Warm palette — direct use in Phase 2-4 components
				mistral: {
					orange: "#fa520f",
					flame: "#fb6424",
					black: "#1f1f1f",
				},
				sunshine: {
					900: "#ff8a00",
					700: "#ffa110",
					500: "#ffb83e",
					300: "#ffd06a",
				},
				cream: "#fff0c2",
				ivory: "#fffaeb",
				"block-gold": "#ffe295",
				"bright-yellow": "#ffd900",
			},
			borderRadius: {
				sm: "calc(var(--radius) - 4px)",
				md: "calc(var(--radius) - 2px)",
				lg: "var(--radius)",
				xl: "calc(var(--radius) + 4px)",
			},
			boxShadow: {
				golden:
					"-8px 16px 39px rgba(127, 99, 21, 0.12), -33px 64px 72px rgba(127, 99, 21, 0.1), -73px 144px 97px rgba(127, 99, 21, 0.06), -130px 256px 115px rgba(127, 99, 21, 0.02), -203px 400px 126px rgba(127, 99, 21, 0)",
				// e-tier elevation system
				"e-0": "none",
				"e-1": "0 1px 2px 0 rgb(0 0 0 / 0.05)", // input
				"e-2":
					"var(--shadow-golden-card, 0 4px 12px -2px rgba(127, 99, 21, 0.10))", // card — falls back if var not set
				"e-3":
					"var(--shadow-golden-pop, 0 8px 24px -4px rgba(127, 99, 21, 0.15))", // dropdown/popover
				"e-4":
					"var(--shadow-golden-dialog, 0 16px 48px -8px rgba(127, 99, 21, 0.20))", // dialog
				"e-5":
					"var(--shadow-golden-toast, 0 24px 64px -12px rgba(127, 99, 21, 0.25))", // toast
			},
			fontFamily: {
				sans: [
					"Arial",
					"ui-sans-serif",
					"system-ui",
					"-apple-system",
					"sans-serif",
				],
			},
			fontSize: {
				// Display typography — reserved for future hero, utility classes only
				display: ["5.125rem", { lineHeight: "1", letterSpacing: "-2.05px" }],
				section: ["3.5rem", { lineHeight: "0.95" }],
				"subheading-lg": ["3rem", { lineHeight: "0.95" }],
				subheading: ["2rem", { lineHeight: "1.15" }],
				"card-title": ["1.875rem", { lineHeight: "1.2" }],
				feature: ["1.5rem", { lineHeight: "1.33" }],
			},
			transitionDuration: {
				fast: "var(--motion-fast)",
				base: "var(--motion-base)",
				slow: "var(--motion-slow)",
			},
			zIndex: {
				sticky: "var(--z-sticky)",
				sidebar: "var(--z-sidebar)",
				overlay: "var(--z-overlay)",
				float: "var(--z-float)",
			},
		},
	},
	plugins: [],
};

export default config;
