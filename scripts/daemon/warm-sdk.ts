/**
 * warm-sdk.ts
 * Shared warm SDK logic for wiki daemon.
 * Manages a single warm handle that gets consumed on use — caller must re-preheat after.
 */

import { appendFileSync } from "node:fs";
import path from "node:path";
import {
	query,
	type SDKMessage,
	startup,
	type WarmQuery,
} from "@anthropic-ai/claude-agent-sdk";
import { logger } from "./logger";

// ─── Helper functions ───────────────────────────────────────────────────────────

/** Append an event to the stream file */
export function appendStreamEvent(streamFile: string, event: unknown): void {
	appendFileSync(streamFile, `${JSON.stringify(event)}\n`, "utf-8");
}

// ─── Warm SDK handle state ──────────────────────────────────────────────────

let warmHandle: WarmQuery | null = null;
let warmKeyValue: string | null = null;

// ─── Core SDK functions ─────────────────────────────────────────────────

/** Build SDK options for the wiki agent */
export function buildSdkOptions(opts: {
	pluginPath: string;
	agentInstruction: string;
	workspaceDir: string;
	wikiDir: string;
	model: string;
	sessionId: string | null;
}) {
	const {
		pluginPath,
		agentInstruction,
		workspaceDir,
		wikiDir,
		model,
		sessionId: resumeSessionId,
	} = opts;
	return {
		cwd: workspaceDir,
		settingSources: ["project", "user"] as ("project" | "user")[],
		plugins: [{ type: "local" as const, path: pluginPath }],
		includePartialMessages: true,
		...(model ? { model } : {}),
		systemPrompt: {
			type: "preset" as const,
			preset: "claude_code" as const,
			append: agentInstruction,
		},
		maxTurns: 30,
		permissionMode: "bypassPermissions" as const,
		allowDangerouslySkipPermissions: true,
		persistSession: true,
		...(resumeSessionId ? { resume: resumeSessionId } : {}),
		env: {
			...process.env,
			WIKI_PATH: wikiDir,
			WIKI_LOCK_PATH: path.join(wikiDir, ".wiki-lock"),
			WIKI_COVERAGE_PATH: path.join(wikiDir, ".coverage.json"),
		},
	};
}

/** Consume an SDK stream and write events to stream file */
export function consumeStream(
	stream: AsyncIterable<SDKMessage>,
	streamFile: string,
): Promise<{ exitCode: number; sessionId: string | null }> {
	return (async () => {
		let exitCode = 1;
		let sessionId: string | null = null;
		for await (const msg of stream) {
			appendStreamEvent(streamFile, msg);
			if (
				!sessionId &&
				"session_id" in msg &&
				typeof msg.session_id === "string"
			) {
				sessionId = msg.session_id;
			}
			if (msg.type === "result") {
				exitCode = msg.subtype === "success" && !msg.is_error ? 0 : 1;
			}
		}
		return { exitCode, sessionId };
	})();
}

/**
 * Cold path: used for resume sessions or when warm handle unavailable.
 * Creates a fresh SDK query and consumes the stream.
 */
export async function runWithSdk(opts: {
	prompt: string;
	pluginPath: string;
	agentInstruction: string;
	workspaceDir: string;
	wikiDir: string;
	streamFile: string;
	model: string;
	sessionId: string | null;
}): Promise<{ exitCode: number; sessionId: string | null }> {
	const sdkOpts = buildSdkOptions(opts);
	const q = query({ prompt: opts.prompt, options: sdkOpts });
	return consumeStream(q, opts.streamFile);
}

// ─── Warm handle management ─────────────────────────────────────────────

/** Build a cache key from preheat options (excludes sessionId which is job-specific) */
function buildWarmKey(opts: Parameters<typeof buildSdkOptions>[0]): string {
	const { pluginPath, agentInstruction, workspaceDir, wikiDir, model } = opts;
	return JSON.stringify({
		pluginPath,
		agentInstruction,
		workspaceDir,
		wikiDir,
		model,
	});
}

/** Pre-warm the SDK with the given options */
export async function preheatSdk(
	opts: Parameters<typeof buildSdkOptions>[0],
): Promise<void> {
	try {
		const sdkOpts = buildSdkOptions(opts);
		warmHandle = await startup({ options: sdkOpts });
		warmKeyValue = buildWarmKey(opts);
		logger.info("warm-sdk", "SDK pre-warmed and ready");
	} catch (err) {
		logger.warn(
			"warm-sdk",
			`Failed to pre-warm SDK: ${err instanceof Error ? err.message : String(err)}`,
		);
		warmHandle = null;
		warmKeyValue = null;
	}
}

/** Get and consume the warm handle. Returns null if no warm handle or key mismatch. */
export function getWarmHandle(expectedKey: string): WarmQuery | null {
	if (warmKeyValue !== expectedKey) {
		// Key mismatch — stale warm handle, discard and force cold path
		warmHandle = null;
		warmKeyValue = null;
		return null;
	}
	const handle = warmHandle;
	warmHandle = null;
	warmKeyValue = null;
	return handle;
}
