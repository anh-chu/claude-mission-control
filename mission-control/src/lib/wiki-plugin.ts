import { execSync } from "child_process";

export type WikiPluginStatus = "installed" | "already-installed";

export interface WikiPluginInstall {
	status: WikiPluginStatus;
	installPath: string;
}

interface ListedPlugin {
	id?: string;
	scope?: string;
	installPath?: string;
	projectPath?: string;
}

const REPO = "anh-chu/llm-wiki-pm";
const PKG = "llm-wiki-pm@anh-chu-plugins";

function listPlugins(cwd: string): ListedPlugin[] {
	try {
		const out = execSync("claude plugin list --json", {
			cwd,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
		});
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

export function ensureWikiPluginInstalledDetailed(
	cwd: string,
): WikiPluginInstall {
	const existing = getInstalledPlugin(cwd);
	if (existing?.installPath) {
		return {
			status: "already-installed",
			installPath: existing.installPath,
		};
	}

	try {
		execSync(`claude plugin marketplace add ${REPO}`, {
			cwd,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "pipe"],
		});
	} catch {
		// benign if already added
	}

	execSync(`claude plugin install ${PKG} --scope project`, {
		cwd,
		encoding: "utf-8",
		stdio: ["ignore", "pipe", "pipe"],
	});

	const installed = getInstalledPlugin(cwd);
	if (!installed?.installPath) {
		throw new Error(
			"llm-wiki-pm installed but installPath not found via claude plugin list --json",
		);
	}

	return {
		status: "installed",
		installPath: installed.installPath,
	};
}

export function ensureWikiPluginInstalled(cwd: string): WikiPluginStatus {
	return ensureWikiPluginInstalledDetailed(cwd).status;
}
