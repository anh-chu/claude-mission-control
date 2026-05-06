import { existsSync } from "node:fs";
import path from "node:path";
import { getBaseDir } from "./paths";

export type ScriptName =
	| "run-task"
	| "wiki-processor"
	| "run-brain-dump-triage"
	| "run-task-comment";

/**
 * Resolve the entrypoint for a daemon script.
 *
 * Production (npm install / standalone): the `scripts/` directory is not
 * shipped, but `dist/*.js` files are compiled and bundled by `build:scripts`.
 * Development: `dist/` may not exist yet, so we fall back to the TypeScript
 * source via `--import tsx`.
 *
 * Returns `{ runner, args }` ready to spread into spawn():
 *   spawn(runner, [...args, ...extraArgs], spawnOptions)
 */
export function resolveScriptEntrypoint(name: ScriptName): {
	runner: string;
	args: string[];
} {
	const base = getBaseDir();
	const distPath = path.join(base, "dist", `${name}.js`);

	if (existsSync(distPath)) {
		return { runner: process.execPath, args: [distPath] };
	}

	const tsPath = path.join(base, "scripts", "daemon", `${name}.ts`);
	return { runner: process.execPath, args: ["--import", "tsx", tsPath] };
}
