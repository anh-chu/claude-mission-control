#!/usr/bin/env tsx
/**
 * run-wiki-generate.ts
 * Background script: run selected agent for wiki generation in workspace wiki dir.
 *
 * Usage:
 *   node --import tsx run-wiki-generate.ts \
 *     --run-id <id> \
 *     --workspace-id <wsid> \
 *     [--prompt-override "extra instructions"] \
 *     [--agent-id doc-maintainer]
 */

import {
	appendFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "fs";
import path from "path";
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import {
	DOC_MAINTAINER_AGENT_ID,
	DOC_MAINTAINER_AGENT_INSTRUCTIONS,
	ensureDocMaintainerAgentForWorkspace,
	getWorkspaceDataDir,
	initWikiDir,
} from "../../src/lib/data";
import { getWikiDir, getWorkspaceDir } from "../../src/lib/paths";
import { ensureWikiPluginInstalledDetailed } from "../../src/lib/wiki-plugin";
import { logger } from "./logger";
import { AgentRunner } from "./runner";

function getArg(name: string): string | null {
	const idx = process.argv.indexOf(`--${name}`);
	return idx !== -1 ? (process.argv[idx + 1] ?? null) : null;
}

const runId = getArg("run-id") ?? `wiki_${Date.now()}`;
const workspaceId =
	getArg("workspace-id") ?? process.env.CMC_WORKSPACE_ID ?? "default";
const promptOverride = getArg("prompt-override") ?? null;
const selectedAgentId = getArg("agent-id") ?? DOC_MAINTAINER_AGENT_ID;
const selectedModel = getArg("model") ?? "";

const workspaceDir = getWorkspaceDir(workspaceId);
const wikiDir = getWikiDir(workspaceId);
const runsDir = path.join(wikiDir, ".runs");
const runFile = path.join(runsDir, `${runId}.json`);
const streamFile = path.join(runsDir, `${runId}.stream.jsonl`);
const defaultPromptFile = path.join(wikiDir, "prompts", "default.md");

const FALLBACK_PROMPT = `You are managing a markdown wiki knowledge base.

Review the files in this directory, then:
1. Update or create wiki pages based on any new source documents
2. Maintain consistent cross-links between pages
3. Keep index.md current with a table of contents

Focus on accuracy and conciseness. Do not delete existing wiki pages unless
they are fully superseded. Preserve the existing directory structure.`;

interface WikiAgentConfig {
	id: string;
	name?: string;
	instructions?: string;
}

function readAgentConfig(
	workspace: string,
	agentId: string,
): WikiAgentConfig | null {
	try {
		const agentsPath = path.join(getWorkspaceDataDir(workspace), "agents.json");
		const raw = readFileSync(agentsPath, "utf-8");
		const data = JSON.parse(raw) as { agents?: WikiAgentConfig[] };
		if (!Array.isArray(data.agents)) return null;
		return data.agents.find((a) => a.id === agentId) ?? null;
	} catch {
		return null;
	}
}

export interface WikiRunRecord {
	id: string;
	workspaceId: string;
	status: "running" | "completed" | "failed";
	promptFile: string | null;
	hasOverride: boolean;
	agentId: string;
	model?: string;
	pluginStatus?: "installed" | "already-installed" | "missing";
	streamFile?: string;
	startedAt: string;
	completedAt: string | null;
	exitCode: number | null;
	error: string | null;
	pid: number;
}

function writeRun(record: WikiRunRecord): void {
	try {
		mkdirSync(runsDir, { recursive: true });
		writeFileSync(runFile, JSON.stringify(record, null, 2), "utf-8");
	} catch (err) {
		logger.error(
			"run-wiki-generate",
			`Failed to write run record: ${err instanceof Error ? err.message : String(err)}`,
		);
	}
}

function appendStreamEvent(event: unknown): void {
	appendFileSync(streamFile, `${JSON.stringify(event)}\n`, "utf-8");
}

function buildPrompt(agentInstruction: string): string {
	let base = FALLBACK_PROMPT;

	if (existsSync(defaultPromptFile)) {
		try {
			const content = readFileSync(defaultPromptFile, "utf-8").trim();
			if (content) base = content;
		} catch {
			// use fallback
		}
	}

	const parts = [agentInstruction.trim(), base];
	if (promptOverride?.trim()) {
		parts.push(`## Additional Instructions\n\n${promptOverride.trim()}`);
	}
	return parts.filter(Boolean).join("\n\n");
}

function normalizeSdkMessage(msg: SDKMessage): unknown[] {
	const out: unknown[] = [msg];
	if (msg.type !== "stream_event") return out;

	const event = msg.event as unknown as Record<string, unknown>;
	if (event.type === "content_block_delta") {
		const delta = (event.delta ?? {}) as Record<string, unknown>;
		if (
			delta.type === "text_delta" &&
			typeof delta.text === "string" &&
			delta.text
		) {
			out.push({
				type: "assistant",
				session_id: msg.session_id,
				message: {
					content: [{ type: "text", text: delta.text }],
				},
			});
		}
	}

	if (event.type === "content_block_start") {
		const block = (event.content_block ?? {}) as Record<string, unknown>;
		if (block.type === "tool_use") {
			out.push({
				type: "assistant",
				session_id: msg.session_id,
				message: {
					content: [
						{
							type: "tool_use",
							id:
								typeof block.id === "string" ? block.id : `tool_${Date.now()}`,
							name: typeof block.name === "string" ? block.name : "tool",
							input:
								typeof block.input === "object" && block.input !== null
									? block.input
									: {},
						},
					],
				},
			});
		}
	}

	return out;
}

async function runWithSdk(prompt: string, pluginPath: string): Promise<number> {
	let exitCode = 1;

	for await (const msg of query({
		prompt,
		options: {
			cwd: workspaceDir,
			settingSources: ["project", "user"],
			plugins: [{ type: "local", path: pluginPath }],
			includePartialMessages: true,
			...(selectedModel ? { model: selectedModel } : {}),
			maxTurns: 30,
			permissionMode: "bypassPermissions",
			allowDangerouslySkipPermissions: true,
			env: {
				...process.env,
				WIKI_PATH: wikiDir,
			},
		},
	})) {
		for (const evt of normalizeSdkMessage(msg)) appendStreamEvent(evt);
		if (msg.type === "result") {
			exitCode = msg.subtype === "success" && !msg.is_error ? 0 : 1;
		}
	}

	return exitCode;
}

async function runWithCliFallback(prompt: string): Promise<number> {
	const runner = new AgentRunner(wikiDir);
	const result = await runner.spawnAgent({
		prompt,
		maxTurns: 30,
		timeoutMinutes: 15,
		skipPermissions: true,
		cwd: wikiDir,
		streamFile,
		env: { WIKI_PATH: wikiDir },
	});
	return result.exitCode ?? 1;
}

async function main(): Promise<void> {
	logger.info(
		"run-wiki-generate",
		`Starting wiki generation run ${runId} for workspace ${workspaceId}`,
	);

	await initWikiDir(workspaceId);
	await ensureDocMaintainerAgentForWorkspace(workspaceId);
	const selectedAgent = readAgentConfig(workspaceId, selectedAgentId);
	const agentId = selectedAgent?.id ?? DOC_MAINTAINER_AGENT_ID;
	const agentInstruction =
		selectedAgent?.instructions?.trim() || DOC_MAINTAINER_AGENT_INSTRUCTIONS;

	const record: WikiRunRecord = {
		id: runId,
		workspaceId,
		status: "running",
		promptFile: existsSync(defaultPromptFile) ? "prompts/default.md" : null,
		hasOverride: !!promptOverride?.trim(),
		agentId,
		model: selectedModel || undefined,
		startedAt: new Date().toISOString(),
		completedAt: null,
		exitCode: null,
		error: null,
		pid: process.pid,
	};
	record.streamFile = `.runs/${runId}.stream.jsonl`;
	mkdirSync(runsDir, { recursive: true });
	writeFileSync(streamFile, "", "utf-8");
	writeRun(record);

	let pluginPath = "";
	try {
		const plugin = ensureWikiPluginInstalledDetailed(wikiDir);
		record.pluginStatus = plugin.status;
		pluginPath = plugin.installPath;
		writeRun(record);
	} catch (err) {
		record.status = "failed";
		record.pluginStatus = "missing";
		record.error = `Plugin preflight failed: ${err instanceof Error ? err.message : String(err)}`;
		record.completedAt = new Date().toISOString();
		record.exitCode = 1;
		writeRun(record);
		logger.error("run-wiki-generate", record.error);
		return;
	}

	const prompt = buildPrompt(agentInstruction);
	let exitCode = 1;
	try {
		exitCode = await runWithSdk(prompt, pluginPath);
	} catch (err) {
		appendStreamEvent({
			type: "system",
			subtype: "sdk_fallback",
			message: err instanceof Error ? err.message : String(err),
		});
		logger.warn(
			"run-wiki-generate",
			`SDK run failed, fallback CLI: ${err instanceof Error ? err.message : String(err)}`,
		);
		exitCode = await runWithCliFallback(prompt);
	}

	record.status = exitCode === 0 ? "completed" : "failed";
	record.exitCode = exitCode;
	record.error = exitCode !== 0 ? "Wiki generation failed" : null;
	record.completedAt = new Date().toISOString();
	writeRun(record);

	logger.info(
		"run-wiki-generate",
		`Run ${runId} finished with exit code ${exitCode}`,
	);
}

main().catch((err) => {
	logger.error(
		"run-wiki-generate",
		`Unhandled: ${err instanceof Error ? err.message : String(err)}`,
	);
	process.exit(1);
});
