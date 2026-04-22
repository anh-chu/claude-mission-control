import { execFileSync, execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import path from "path";

export type WikiPluginStatus = "installed" | "already-installed";
export type WikiBootstrapStatus = "bootstrapped" | "already-initialized";

export interface WikiPluginInstall {
	status: WikiPluginStatus;
	installPath: string;
	version: string | null;
	updated: boolean;
}

export interface WikiBootstrapResult {
	status: WikiBootstrapStatus;
	scaffoldScript: string;
	lockFile: string | null;
	coverageReport: string | null;
}

export interface WikiReconcileResult {
	lintScript: string;
}

interface ListedPlugin {
	id?: string;
	scope?: string;
	installPath?: string;
	projectPath?: string;
	version?: string;
}

const REPO = "anh-chu/llm-wiki-pm";
const PKG = "llm-wiki-pm@anh-chu-plugins";
const MIN_PLUGIN_VERSION = "2.5.0";

function parseVersionParts(version: string): [number, number, number] {
	const [majorRaw = "0", minorRaw = "0", patchRaw = "0"] = version
		.split(".")
		.slice(0, 3);
	const major = Number.parseInt(majorRaw, 10);
	const minor = Number.parseInt(minorRaw, 10);
	const patch = Number.parseInt(patchRaw, 10);
	return [
		Number.isFinite(major) ? major : 0,
		Number.isFinite(minor) ? minor : 0,
		Number.isFinite(patch) ? patch : 0,
	];
}

function compareVersions(a: string, b: string): number {
	const av = parseVersionParts(a);
	const bv = parseVersionParts(b);
	for (let i = 0; i < 3; i += 1) {
		if (av[i] > bv[i]) return 1;
		if (av[i] < bv[i]) return -1;
	}
	return 0;
}

function runClaude(command: string, cwd: string): string {
	return execSync(command, {
		cwd,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	});
}

function listPlugins(cwd: string): ListedPlugin[] {
	try {
		const out = runClaude("claude plugin list --json", cwd);
		const parsed = JSON.parse(out) as unknown;
		return Array.isArray(parsed) ? (parsed as ListedPlugin[]) : [];
	} catch {
		return [];
	}
}

function getInstalledPlugin(cwd: string): ListedPlugin | null {
	const plugins = listPlugins(cwd);
	for (const plugin of plugins) {
		if (plugin.id !== PKG) continue;
		if (plugin.scope !== "project") continue;
		if (plugin.installPath && plugin.installPath.trim()) return plugin;
	}
	return null;
}

function resolveBootstrapScript(pluginInstallPath: string): string {
	const sessionStartHook = path.join(
		pluginInstallPath,
		"hooks",
		"session-start.sh",
	);
	if (existsSync(sessionStartHook)) return sessionStartHook;

	const legacyScaffold = path.join(
		pluginInstallPath,
		"skills",
		"llm-wiki-pm",
		"scripts",
		"scaffold.py",
	);
	if (existsSync(legacyScaffold)) return legacyScaffold;

	throw new Error(
		`llm-wiki-pm bootstrap script not found in hooks/session-start.sh or legacy scaffold.py under ${pluginInstallPath}`,
	);
}

function resolveLintScript(pluginInstallPath: string): string {
	const candidate = path.join(
		pluginInstallPath,
		"skills",
		"llm-wiki-pm",
		"scripts",
		"lint.py",
	);
	if (!existsSync(candidate)) {
		throw new Error(`llm-wiki-pm lint script not found: ${candidate}`);
	}
	return candidate;
}

export function ensureWikiPluginInstalledDetailed(
	cwd: string,
	options?: { update?: boolean },
): WikiPluginInstall {
	let plugin = getInstalledPlugin(cwd);
	let status: WikiPluginStatus = "already-installed";
	let updated = false;

	if (!plugin) {
		try {
			runClaude(`claude plugin marketplace add ${REPO}`, cwd);
		} catch {
			// benign if already added
		}

		runClaude(`claude plugin install ${PKG} --scope project`, cwd);
		plugin = getInstalledPlugin(cwd);
		status = "installed";
	}

	if (!plugin?.installPath) {
		throw new Error(
			"llm-wiki-pm installed but installPath not found via claude plugin list --json",
		);
	}

	if (options?.update) {
		try {
			runClaude(`claude plugin update ${PKG}`, cwd);
			updated = true;
			plugin = getInstalledPlugin(cwd) ?? plugin;
		} catch {
			// ignore if already latest / unsupported on current claude version
		}
	}

	const installPath = plugin.installPath;
	if (!installPath) {
		throw new Error("llm-wiki-pm installPath missing after install/update");
	}

	const version = typeof plugin.version === "string" ? plugin.version : null;
	if (!version) {
		throw new Error(
			`llm-wiki-pm version missing. Require >= ${MIN_PLUGIN_VERSION}`,
		);
	}
	if (compareVersions(version, MIN_PLUGIN_VERSION) < 0) {
		throw new Error(
			`llm-wiki-pm version ${version} unsupported. Update plugin to >= ${MIN_PLUGIN_VERSION}`,
		);
	}

	return {
		status,
		installPath,
		version,
		updated,
	};
}

export function ensureWikiPluginInstalled(cwd: string): WikiPluginStatus {
	return ensureWikiPluginInstalledDetailed(cwd).status;
}

/**
 * Resolve the .wiki-path file content if present in the workspace directory.
 * v2.5.0: plugin reads this file to discover the wiki dir during SessionStart.
 */
function resolveWikiPathFromFile(workspaceDir: string): string | null {
	const sentinel = path.join(workspaceDir, ".wiki-path");
	if (!existsSync(sentinel)) return null;
	try {
		const content = readFileSync(sentinel, "utf-8").trim();
		return content && path.isAbsolute(content) ? content : null;
	} catch {
		return null;
	}
}

/**
 * Resolve lock file path from wiki dir.
 * v2.5.0: plugin writes .wiki-lock after successful bootstrap/reconcile.
 */
function resolveLockFile(wikiDir: string): string | null {
	const lockPath = path.join(wikiDir, ".wiki-lock");
	return existsSync(lockPath) ? lockPath : null;
}

/**
 * Resolve coverage report path from wiki dir.
 * v2.5.0: plugin writes .coverage.json after lint/reconcile runs.
 */
function resolveCoverageReport(wikiDir: string): string | null {
	const covPath = path.join(wikiDir, ".coverage.json");
	return existsSync(covPath) ? covPath : null;
}

export function ensureWikiBootstrappedFromPlugin(
	wikiDir: string,
	pluginInstallPath: string,
	domain: string,
	options?: { workspaceDir?: string },
): WikiBootstrapResult {
	const schemaPath = path.join(wikiDir, "SCHEMA.md");
	const bootstrapScript = resolveBootstrapScript(pluginInstallPath);
	if (existsSync(schemaPath)) {
		return {
			status: "already-initialized",
			scaffoldScript: bootstrapScript,
			lockFile: resolveLockFile(wikiDir),
			coverageReport: resolveCoverageReport(wikiDir),
		};
	}

	// v2.5.0 SessionStart env contract: include WIKI_LOCK_PATH, WIKI_COVERAGE_PATH,
	// and prefer .wiki-path sentinel for WIKI_PATH when available.
	const wikiPathOverride = options?.workspaceDir
		? resolveWikiPathFromFile(options.workspaceDir)
		: null;
	const effectiveWikiPath = wikiPathOverride ?? wikiDir;

	if (bootstrapScript.endsWith("session-start.sh")) {
		execFileSync("bash", [bootstrapScript], {
			cwd: wikiDir,
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
			input: "{}",
			env: {
				...process.env,
				WIKI_PATH: effectiveWikiPath,
				WIKI_LOCK_PATH: path.join(wikiDir, ".wiki-lock"),
				WIKI_COVERAGE_PATH: path.join(wikiDir, ".coverage.json"),
				CLAUDE_PLUGIN_ROOT: pluginInstallPath,
				CLAUDE_PLUGIN_OPTION_wiki_path: effectiveWikiPath,
				CLAUDE_PLUGIN_OPTION_wiki_domain: domain,
			},
		});
	} else {
		execFileSync("python3", [bootstrapScript, wikiDir, domain], {
			cwd: wikiDir,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
		});
	}
	if (!existsSync(schemaPath)) {
		throw new Error("Plugin bootstrap finished but SCHEMA.md missing");
	}

	return {
		status: "bootstrapped",
		scaffoldScript: bootstrapScript,
		lockFile: resolveLockFile(wikiDir),
		coverageReport: resolveCoverageReport(wikiDir),
	};
}

export function reconcileWikiWithPlugin(
	wikiDir: string,
	pluginInstallPath: string,
): WikiReconcileResult {
	const lintScript = resolveLintScript(pluginInstallPath);
	execFileSync("python3", [lintScript, wikiDir, "--auto-fix"], {
		cwd: wikiDir,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	});
	return { lintScript };
}
