/**
 * HTTP Upgrade Handler for /api/terminal/ws
 *
 * Intercepts WebSocket upgrade requests before Next.js sees them,
 * validates Auth.js JWT cookies, and hands off to node-pty via ws-bridge.
 */
import type * as http from "node:http";
import type { JWT } from "next-auth/jwt";
import { getToken } from "next-auth/jwt";
import type { WebSocket, WebSocketServer } from "ws";
import { isEmailAllowed } from "@/lib/auth-email-allowlist";
import { terminalSessions } from "./session-manager";
import { attachWebSocketToSession } from "./ws-bridge";

/** Parse a single cookie value from a raw Cookie header string. */
function parseCookie(
	cookieHeader: string | undefined,
	name: string,
): string | undefined {
	if (!cookieHeader) return undefined;
	const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
	return match ? decodeURIComponent(match[1]) : undefined;
}

const TERMINAL_WS_PATH = "/api/terminal/ws";

function rejectSocket(
	socket: http.ServerResponse["socket"],
	status: number,
	message: string,
): void {
	if (!socket || socket.destroyed) return;
	socket.write(
		`HTTP/1.1 ${status} ${message}\r\nContent-Type: text/plain\r\nContent-Length: ${message.length}\r\n\r\n${message}`,
	);
	socket.destroy();
}

export function attachTerminalUpgrade(
	server: http.Server,
	wss: WebSocketServer,
): void {
	server.on(
		"upgrade",
		async (
			req: http.IncomingMessage,
			socket: import("node:net").Socket,
			head: Buffer,
		) => {
			const url = new URL(req.url ?? "/", "http://x");
			if (url.pathname !== TERMINAL_WS_PATH) {
				// Not our path — let other upgrade handlers deal with it
				return;
			}

			// ── Auth validation ──────────────────────────────────────────────────
			console.log(
				"[terminal] upgrade request — cookie present:",
				!!req.headers.cookie,
			);
			// In production the site is served over HTTPS (e.g. via cloudflared),
			// so NextAuth sets the session cookie with the __Secure- prefix
			// (__Secure-authjs.session-token). The WebSocket upgrade reaches our
			// server over plain HTTP (localhost), so getToken() doesn't infer
			// secureCookie automatically — we must set it explicitly.
			const isSecure =
				process.env.NODE_ENV === "production" ||
				req.headers["x-forwarded-proto"] === "https";
			let token: JWT | null = null;
			try {
				token = await getToken({
					req: req as Parameters<typeof getToken>[0]["req"],
					secret: process.env.AUTH_SECRET ?? "",
					secureCookie: isSecure,
				});
				console.log(
					"[terminal] getToken result:",
					token ? `valid (${String(token.email)})` : "null",
				);
			} catch (err) {
				console.error("[terminal] JWT validation error:", err);
				rejectSocket(socket, 500, "Internal Server Error");
				return;
			}

			if (!token) {
				console.warn(
					`[terminal] rejected — no valid JWT (looked for cookie: ${isSecure ? "__Secure-authjs.session-token" : "authjs.session-token"})`,
				);
				rejectSocket(socket, 401, "Unauthorized");
				return;
			}

			const email = token.email as string | null | undefined;
			if (!isEmailAllowed(email)) {
				rejectSocket(socket, 403, "Forbidden");
				return;
			}

			// ── Upgrade to WebSocket ─────────────────────────────────────────────
			wss.handleUpgrade(req, socket, head, (ws) => {
				wss.emit("connection", ws, req, token);
			});
		},
	);

	// ── Connection handler ───────────────────────────────────────────────────
	wss.on(
		"connection",
		(ws: WebSocket, _req: http.IncomingMessage, token: JWT) => {
			const email = (token.email as string | null | undefined) ?? "unknown";

			// Parse initial terminal dimensions from query string
			const url = new URL(_req.url ?? "/", "http://x");
			const cols = Math.max(
				10,
				Math.min(500, Number(url.searchParams.get("cols")) || 80),
			);
			const rows = Math.max(
				5,
				Math.min(200, Number(url.searchParams.get("rows")) || 24),
			);

			// Resolve workspace ID from cookie so the terminal opens in the right dir
			const workspaceId =
				parseCookie(_req.headers.cookie, "workspace_id") ?? "default";

			let session: ReturnType<typeof terminalSessions.create> | undefined;
			try {
				session = terminalSessions.create(email, { cols, rows, workspaceId });
			} catch (err) {
				console.error("[terminal] Failed to spawn PTY:", err);
				ws.send(
					JSON.stringify({
						type: "error",
						message: `PTY unavailable: ${String(err)}`,
					}),
				);
				ws.close(1011, "PTY unavailable");
				return;
			}

			console.log(
				`[terminal] Session ${session.id} opened for ${email} (${cols}×${rows})`,
			);
			attachWebSocketToSession(ws, session);
		},
	);
}
