#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

// Files to build
const daemonFiles = [
	{ src: "scripts/daemon/index.ts", dist: "dist/daemon.js" },
	{ src: "scripts/daemon/run-task.ts", dist: "dist/run-task.js" },
	{
		src: "scripts/daemon/run-task-comment.ts",
		dist: "dist/run-task-comment.js",
	},
	{
		src: "scripts/daemon/run-brain-dump-triage.ts",
		dist: "dist/run-brain-dump-triage.js",
	},
];

async function buildDaemon() {
	// Create dist directory if needed
	const distDir = path.join(rootDir, "dist");
	if (!fs.existsSync(distDir)) {
		fs.mkdirSync(distDir, { recursive: true });
		console.log(`Created directory: ${distDir}`);
	}

	// Build each daemon file
	for (const file of daemonFiles) {
		const srcPath = path.join(rootDir, file.src);
		const distPath = path.join(rootDir, file.dist);

		console.log(`Building: ${file.src} → ${file.dist}`);

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
			// ESM bundles can't `require()` natively. Inject a real `require` via
			// createRequire so bundled CJS deps (gray-matter, etc.) keep working.
			// The shebang stays on the daemon entry only.
			banner: {
				// Note: __dirname / __filename are declared at the source-file level
				// via import.meta.url so both tsx (raw .ts) and esbuild bundles work.
				// We only inject `require` here for bundled CJS deps (gray-matter, etc.).
				js: [
					file.src.includes("index") ? "#!/usr/bin/env node" : "",
					"import { createRequire as __mandioCreateRequire } from 'node:module';",
					"const require = __mandioCreateRequire(import.meta.url);",
				]
					.filter(Boolean)
					.join("\n"),
			},
		});

		const stats = fs.statSync(distPath);
		console.log(`  ✓ ${file.dist} (${(stats.size / 1024).toFixed(1)} KB)`);
	}
}

buildDaemon()
	.then(() => {
		console.log("\n✅ Daemon build complete");
	})
	.catch((err) => {
		console.error("❌ Build failed:", err);
		process.exit(1);
	});
