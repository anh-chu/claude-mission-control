import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		globals: true,
		include: ["__tests__/**/*.test.ts"],
		fileParallelism: false,
		testTimeout: 15000,
		globalSetup: "./__tests__/global-setup.ts",
		env: {
			MANDIO_DATA_DIR: path.join(__dirname, ".test-data"),
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "src"),
		},
	},
});
