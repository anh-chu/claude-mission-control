#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

async function buildCli() {
	// Ensure bin directory exists
	const binDir = path.join(rootDir, "bin");
	if (!fs.existsSync(binDir)) {
		fs.mkdirSync(binDir, { recursive: true });
		console.log(`Created directory: ${binDir}`);
	}

	const srcPath = path.join(rootDir, "bin/cli.ts");
	const distPath = path.join(rootDir, "bin/cli.js");

	console.log(`Building: bin/cli.ts → bin/cli.js`);

	await build({
		entryPoints: [srcPath],
		bundle: true,
		platform: "node",
		target: "node18",
		format: "esm",
		outfile: distPath,
		external: ["@anthropic-ai/claude-agent-sdk", "tree-kill"],
		sourcemap: false,
		minify: false,
	});

	const stats = fs.statSync(distPath);
	console.log(`  ✓ bin/cli.js (${(stats.size / 1024).toFixed(1)} KB)`);
}

buildCli()
	.then(() => {
		console.log("\n✅ CLI build complete");
	})
	.catch((err) => {
		console.error("❌ Build failed:", err);
		process.exit(1);
	});
