/**
 * PTY Session Manager
 *
 * Pure server-side logic — no Next.js / React dependencies.
 * Import from upgrade-handler or API routes only (never from client code).
 */
import { existsSync } from "node:fs";
import { nanoid } from "nanoid";
import type { IPty } from "node-pty";
import ptyModule from "node-pty";
import { assertSafeId, getWorkspaceDir } from "@/lib/paths";

// ── Constants ──────────────────────────────────────────────────────────────

export const IDLE_MS = 30 * 60 * 1000; // 30 minutes
export const MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours
export const MAX_SESSIONS_PER_USER = 5;

// ── Types ──────────────────────────────────────────────────────────────────

export interface TerminalSession {
	id: string;
	pty: IPty;
	ownerEmail: string;
	createdAt: number;
	lastInputAt: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

export function detectShell(): { command: string; args: string[] } {
	const fromEnv = process.env.SHELL;
	if (fromEnv && existsSync(fromEnv)) {
		return { command: fromEnv, args: [] };
	}
	if (existsSync("/bin/bash")) {
		return { command: "/bin/bash", args: [] };
	}
	return { command: "/bin/sh", args: [] };
}

const SECRET_PATTERN = /(SECRET|TOKEN|KEY|PASSWORD)$/i;
const KNOWN_SECRETS = new Set([
	"AUTH_SECRET",
	"GOOGLE_CLIENT_SECRET",
	"ANTHROPIC_API_KEY",
]);

export function buildEnv(): NodeJS.ProcessEnv {
	const env: Record<string, string | undefined> = {};
	for (const [k, v] of Object.entries(process.env)) {
		if (KNOWN_SECRETS.has(k) || SECRET_PATTERN.test(k)) continue;
		env[k] = v;
	}
	return env as NodeJS.ProcessEnv;
}

// ── Session Manager ────────────────────────────────────────────────────────

export class TerminalSessionManager {
	private sessions = new Map<string, TerminalSession>();
	private reaperTimer: ReturnType<typeof setInterval> | null = null;

	create(
		ownerEmail: string,
		opts: { cols: number; rows: number; workspaceId?: string },
	): TerminalSession {
		// Enforce per-user cap: kill oldest session if at limit
		const userSessions = [...this.sessions.values()]
			.filter((s) => s.ownerEmail === ownerEmail)
			.sort((a, b) => a.createdAt - b.createdAt);

		if (userSessions.length >= MAX_SESSIONS_PER_USER) {
			this.kill(userSessions[0].id);
		}

		const shell = detectShell();

		// Resolve working directory: workspace dir if provided, else HOME
		let cwd = process.env.HOME ?? "/";
		if (opts.workspaceId) {
			try {
				assertSafeId(opts.workspaceId);
				cwd = getWorkspaceDir(opts.workspaceId);
			} catch {
				// Invalid workspace ID — fall back to HOME
			}
		}

		let ptyProcess: IPty;
		try {
			ptyProcess = ptyModule.spawn(shell.command, shell.args, {
				name: "xterm-256color",
				cols: opts.cols,
				rows: opts.rows,
				cwd,
				env: buildEnv(),
			});
		} catch (err) {
			// Fallback: try /bin/sh before giving up
			if (shell.command !== "/bin/sh") {
				ptyProcess = ptyModule.spawn("/bin/sh", [], {
					name: "xterm-256color",
					cols: opts.cols,
					rows: opts.rows,
					cwd,
					env: buildEnv(),
				});
			} else {
				throw err;
			}
		}

		const session: TerminalSession = {
			id: nanoid(),
			pty: ptyProcess,
			ownerEmail,
			createdAt: Date.now(),
			lastInputAt: Date.now(),
		};

		this.sessions.set(session.id, session);
		return session;
	}

	get(id: string): TerminalSession | undefined {
		return this.sessions.get(id);
	}

	kill(id: string): void {
		const session = this.sessions.get(id);
		if (!session) return;
		this.sessions.delete(id);
		try {
			session.pty.kill();
		} catch {
			// process may already be dead
		}
	}

	killAll(): void {
		for (const id of this.sessions.keys()) {
			this.kill(id);
		}
	}

	/**
	 * Kill idle and aged-out sessions.
	 * @returns number of sessions killed
	 */
	reapIdle(now: number = Date.now()): number {
		let killed = 0;
		for (const [id, session] of this.sessions.entries()) {
			const idleTooLong = now - session.lastInputAt > IDLE_MS;
			const tooOld = now - session.createdAt > MAX_AGE_MS;
			if (idleTooLong || tooOld) {
				this.kill(id);
				killed++;
			}
		}
		return killed;
	}

	count(): number {
		return this.sessions.size;
	}

	startReaper(): void {
		if (this.reaperTimer) return;
		this.reaperTimer = setInterval(() => {
			const killed = this.reapIdle();
			if (killed > 0) {
				console.log(`[terminal] Reaped ${killed} idle PTY session(s)`);
			}
		}, 60_000);
		this.reaperTimer.unref?.();
	}

	stopReaper(): void {
		if (this.reaperTimer) {
			clearInterval(this.reaperTimer);
			this.reaperTimer = null;
		}
	}
}

export const terminalSessions = new TerminalSessionManager();
