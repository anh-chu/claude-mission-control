/**
 * Tests for task stop route — verifies that stopping a task also cancels
 * the linked conversation and publishes a conversation.cancelled event.
 */
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/workspace-context", () => ({
	applyWorkspaceContext: vi
		.fn()
		.mockImplementation((fn: (id: string) => Promise<unknown>) =>
			fn("default"),
		),
}));

// Mock auth so requireSession() inside route handlers returns a valid session
vi.mock("@/lib/auth", () => ({
	auth: vi.fn().mockResolvedValue({
		user: { email: "test@example.com" },
		expires: "2099-01-01T00:00:00.000Z",
	}),
}));

import { POST } from "@/app/api/tasks/[id]/stop/route";
import {
	createConversation,
	createConversationRun,
	getConversation,
	getConversationRun,
	readConversationEvents,
	setConversationsWorkspace,
	updateConversationRun,
} from "@/lib/conversations";
import { readJSON, writeJSON } from "@/lib/json-io";
import { DATA_DIR } from "@/lib/paths";
import { backupDataFiles, restoreDataFiles } from "./helpers";

let backups: Record<string, string>;

beforeAll(async () => {
	backups = await backupDataFiles();
	setConversationsWorkspace("default");
});

afterAll(async () => {
	await restoreDataFiles(backups);
});

describe("POST /api/tasks/[id]/stop — conversation cancellation", () => {
	it("cancels linked conversation and publishes conversation.cancelled event", async () => {
		const taskId = `vitest-task-stop-conv-${Date.now()}`;

		// ── Setup: create a task with conversationId in tasks.json ──
		const tasksPath = path.join(DATA_DIR, "tasks.json");
		const tasksData = readJSON<{
			tasks: Array<{
				id: string;
				kanban: string;
				conversationId?: string | null;
			}>;
		}>(tasksPath) ?? { tasks: [] };
		tasksData.tasks.push({
			id: taskId,
			kanban: "in-progress",
			conversationId: null, // will set after creating the conv
		});
		writeJSON(tasksPath, tasksData);

		// ── Setup: create active-runs.json entry ──
		const runsPath = path.join(DATA_DIR, "active-runs.json");
		const runsData = readJSON<{
			runs: Array<{
				id: string;
				taskId: string;
				status: string;
				pid: number;
			}>;
		}>(runsPath) ?? { runs: [] };
		const runEntry = {
			id: `run-${Date.now()}`,
			taskId,
			status: "running",
			pid: 999995, // fake dead PID
		};
		runsData.runs.push(runEntry);
		writeJSON(runsPath, runsData);

		// ── Setup: create conversation + run ──
		const conv = await createConversation({
			title: `vitest-stop-conv-${Date.now()}`,
			agentId: null,
			model: null,
			mode: "foreground",
			executionSource: "task",
			status: "running",
			taskId,
		});
		const cRun = await createConversationRun({
			conversationId: conv.id,
			source: "task",
		});
		await updateConversationRun(cRun.id, {
			pid: 999994,
			status: "running",
		});

		// Link the conversation to the task
		const tasksData2 = readJSON<{
			tasks: Array<{
				id: string;
				kanban: string;
				conversationId?: string | null;
			}>;
		}>(tasksPath) ?? { tasks: [] };
		const taskEntry = tasksData2.tasks.find((x) => x.id === taskId);
		expect(taskEntry).toBeDefined();
		if (!taskEntry) throw new Error("Expected task to exist");
		taskEntry.conversationId = conv.id;
		writeJSON(tasksPath, tasksData2);

		// ── Execute: call the stop route ──
		const params = Promise.resolve({ id: taskId });
		const request = new Request("http://localhost/api/tasks/stop", {
			method: "POST",
		});
		const response = await POST(request, { params });
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.status).toBe("stopped");

		// ── Verify: conversation is cancelled ──
		const updatedConv = await getConversation(conv.id);
		expect(updatedConv).not.toBeNull();
		expect(updatedConv?.status).toBe("cancelled");
		expect(updatedConv?.cancelledAt).not.toBeNull();
		expect(updatedConv?.currentRunId).toBeNull();

		// ── Verify: run is stopped ──
		const updatedRun = await getConversationRun(cRun.id);
		expect(updatedRun).not.toBeNull();
		expect(updatedRun?.status).toBe("stopped");
		expect(updatedRun?.completedAt).not.toBeNull();

		// ── Verify: conversation.cancelled event was published ──
		const events = await readConversationEvents(conv.id);
		const cancelEvents = events.filter(
			(e) => e.type === "conversation.cancelled",
		);
		expect(cancelEvents.length).toBe(1);
		const evt = cancelEvents[0];
		if (evt.type === "conversation.cancelled") {
			expect(evt.payload.runId).toBe(cRun.id);
			expect(evt.payload.reason).toBe("Stopped by user");
		}
	});
});
