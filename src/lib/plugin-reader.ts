import { existsSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface PluginInfo {
	id: string; // e.g. "github@claude-plugins-official"
	name: string; // e.g. "github"
	marketplace: string; // e.g. "claude-plugins-official"
	description: string;
	version: string;
	author: string;
	homepage?: string;
	repository?: string;
	keywords: string[];
	enabled: boolean; // merged from settings + local settings
	scope: "user" | "project";
	projectPath?: string; // for project-scoped plugins
	installedAt: string;
	installPath: string;
	capabilities: {
		hooks: string[]; // e.g. ["SessionStart", "UserPromptSubmit"]
		hasMcp: boolean; // .mcp.json exists
		hasSkills: boolean; // skills/ dir exists
		hasAgents: boolean; // agents/ or .claude/agents/ exists
	};
}

// ─── Paths ─────────────────────────────────────────────────────────────────────

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const PLUGINS_DIR = path.join(CLAUDE_DIR, "plugins");
const INSTALLED_PLUGINS_FILE = path.join(PLUGINS_DIR, "installed_plugins.json");
const SETTINGS_FILE = path.join(CLAUDE_DIR, "settings.json");
const SETTINGS_LOCAL_FILE = path.join(CLAUDE_DIR, "settings.local.json");

// ─── Types for raw JSON files ────────────────────────────────────────────────

interface InstalledPluginEntry {
	scope: "user" | "project";
	installPath: string;
	version: string;
	installedAt: string;
	projectPath?: string;
}

interface InstalledPluginsFile {
	version: 2;
	plugins: Record<string, InstalledPluginEntry>;
}

interface SettingsFile {
	enabledPlugins?: Record<string, boolean>;
}

interface PluginMetadata {
	name?: string;
	description?: string;
	version?: string;
	author?: string;
	homepage?: string;
	repository?: string;
	keywords?: string[];
	hooks?: Record<string, unknown>;
	userConfig?: Record<string, unknown>;
}

// ─── Helper functions ────────────────────────────────────────────────────

/**
 * Read JSON file safely, returning null if missing or invalid.
 */
function readJSONFile<T>(filePath: string): T | null {
	try {
		if (!existsSync(filePath)) return null;
		return JSON.parse(readFileSync(filePath, "utf-8")) as T;
	} catch {
		return null;
	}
}

/**
 * Parse plugin ID into name and marketplace.
 * ID format: <plugin-name>@<marketplace-id>
 */
function parsePluginId(id: string): { name: string; marketplace: string } {
	const atIndex = id.indexOf("@");
	if (atIndex === -1) {
		return { name: id, marketplace: "unknown" };
	}
	return {
		name: id.slice(0, atIndex),
		marketplace: id.slice(atIndex + 1),
	};
}

/**
 * Check plugin capabilities by inspecting the plugin directory.
 */
async function getPluginCapabilities(
	pluginDir: string,
): Promise<PluginInfo["capabilities"]> {
	const capabilities: PluginInfo["capabilities"] = {
		hooks: [],
		hasMcp: false,
		hasSkills: false,
		hasAgents: false,
	};

	// Check for .mcp.json
	const mcpPath = path.join(pluginDir, ".mcp.json");
	if (existsSync(mcpPath)) {
		capabilities.hasMcp = true;
	}

	// Check for skills/ directory
	const skillsPath = path.join(pluginDir, "skills");
	if (existsSync(skillsPath)) {
		try {
			const stats = await readdir(skillsPath);
			capabilities.hasSkills = stats.length > 0;
		} catch {
			capabilities.hasSkills = false;
		}
	}

	// Check for agents/ directory
	const agentsPath = path.join(pluginDir, "agents");
	const claudeAgentsPath = path.join(pluginDir, ".claude", "agents");
	if (existsSync(agentsPath) || existsSync(claudeAgentsPath)) {
		capabilities.hasAgents = true;
	}

	// Read plugin.json for hooks
	const pluginJsonPath = path.join(pluginDir, ".claude-plugin", "plugin.json");
	const pluginJson = readJSONFile<PluginMetadata>(pluginJsonPath);
	if (pluginJson?.hooks) {
		capabilities.hooks = Object.keys(pluginJson.hooks);
	}

	return capabilities;
}

/**
 * Get enabled status from settings, merging global and local settings.
 * Logic: local settings override global settings.
 * Missing = enabled (true), false = disabled.
 */
function getEnabledStatus(
	pluginId: string,
	settings: Record<string, boolean> | null | undefined,
	localSettings: Record<string, boolean> | null | undefined,
): boolean {
	// Check local settings first (they override global)
	if (localSettings && Object.hasOwn(localSettings, pluginId)) {
		return localSettings[pluginId] ?? true;
	}
	// Then check global settings
	if (settings && Object.hasOwn(settings, pluginId)) {
		return settings[pluginId] ?? true;
	}
	// Missing = enabled by default
	return true;
}

/**
 * List all installed plugins with metadata and merged enabled status.
 *
 * @returns Promise<PluginInfo[]> Array of plugin information
 */
export async function listInstalledPlugins(): Promise<PluginInfo[]> {
	// Read installed plugins registry
	const installedPlugins = readJSONFile<InstalledPluginsFile>(
		INSTALLED_PLUGINS_FILE,
	);
	if (!installedPlugins?.plugins) {
		return [];
	}

	// Read settings files
	const settings = readJSONFile<SettingsFile>(SETTINGS_FILE);
	const localSettings = readJSONFile<SettingsFile>(SETTINGS_LOCAL_FILE);

	const plugins: PluginInfo[] = [];

	for (const [id, entry] of Object.entries(installedPlugins.plugins)) {
		const { name, marketplace } = parsePluginId(id);
		const pluginDir = entry.installPath;

		// Skip if install path doesn't exist
		if (!pluginDir || !existsSync(pluginDir)) {
			continue;
		}

		// Read plugin metadata
		const pluginJsonPath = path.join(
			pluginDir,
			".claude-plugin",
			"plugin.json",
		);
		const pluginMetadata = readJSONFile<PluginMetadata>(pluginJsonPath);

		// Get capabilities
		const capabilities = await getPluginCapabilities(pluginDir);

		// Resolve description, author, etc. from metadata
		const description = pluginMetadata?.description ?? "";
		const author =
			typeof pluginMetadata?.author === "string" ? pluginMetadata.author : "";
		const homepage = pluginMetadata?.homepage;
		const repository = pluginMetadata?.repository;
		const keywords = pluginMetadata?.keywords ?? [];

		// Resolve version: installed_plugins.json version overrides metadata
		const version = entry.version ?? pluginMetadata?.version ?? "unknown";

		plugins.push({
			id,
			name,
			marketplace,
			description,
			version,
			author,
			homepage,
			repository,
			keywords,
			enabled: getEnabledStatus(
				id,
				settings?.enabledPlugins,
				localSettings?.enabledPlugins,
			),
			scope: entry.scope,
			projectPath: entry.projectPath,
			installedAt: entry.installedAt,
			installPath: pluginDir,
			capabilities,
		});
	}

	return plugins;
}
