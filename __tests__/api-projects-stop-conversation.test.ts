/**
 * Tests for project stop route — verifies that stopping a project also cancels
 * linked conversations for each task whose run is killed.
 *
 * This mirrors the pattern in api-tasks-stop-conversation.test.ts but at the
 * project/mission level.
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

import { POST } from "@/app/api/projects/[id]/stop/route";
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

describe("POST /api/projects/[id]/stop — conversation cancellation", () => {
	it("cancels linked conversation for each stopped task and publishes conversation.cancelled event", async () => {
		const projectId = `vitest-project-stop-${Date.now()}`;
		const taskId = `vitest-task-stop-${Date.now()}`;
		// ── Setup: create missions.json with a running mission ──
		const missionsPath = path.join(DATA_DIR, "missions.json");
		const missionsData = readJSON<{
			missions: Array<{
				id: string;
				projectId: string;
				status: string;
				stoppedAt: string | null;
			}>;
		}>(missionsPath) ?? { missions: [] };
		const missionId = `mission-${Date.now()}`;
		missionsData.missions.push({
			id: missionId,
			projectId,
			status: "running",
			stoppedAt: null,
		});
		writeJSON(missionsPath, missionsData);

		// ── Setup: create active-runs.json entry for the task ──
		const runsPath = path.join(DATA_DIR, "active-runs.json");
		const runsData = readJSON<{
			runs: Array<{
				id: string;
				taskId: string;
				projectId: string | null;
				missionId: string | null;
				status: string;
				pid: number;
				completedAt: string | null;
				error: string | null;
			}>;
		}>(runsPath) ?? { runs: [] };
		const runEntry = {
			id: `run-${Date.now()}`,
			taskId,
			projectId,
			missionId,
			status: "running",
			pid: 999993, // fake dead PID
			completedAt: null,
			error: null,
		};
		runsData.runs.push(runEntry);
		writeJSON(runsPath, runsData);

		// ── Setup: create tasks.json entry with conversationId ──
		const tasksPath = path.join(DATA_DIR, "tasks.json");
		const tasksData = readJSON<{
			tasks: Array<{
				id: string;
				kanban: string;
				conversationId?: string | null;
				updatedAt?: string;
			}>;
		}>(tasksPath) ?? { tasks: [] };
		tasksData.tasks.push({
			id: taskId,
			kanban: "in-progress",
			conversationId: null, // will set after creating conv
			updatedAt: new Date().toISOString(),
		});
		writeJSON(tasksPath, tasksData);

		// ── Setup: create conversation + run ──
		const conv = await createConversation({
			title: `vitest-proj-stop-${Date.now()}`,
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
			pid: 999992,
			status: "running",
		});

		// Link the conversation to the task
		const tasksData2 = readJSON<{
			tasks: Array<{
				id: string;
				kanban: string;
				conversationId?: string | null;
				updatedAt?: string;
			}>;
		}>(tasksPath) ?? { tasks: [] };
		const taskEntry = tasksData2.tasks.find((x) => x.id === taskId);
		expect(taskEntry).toBeDefined();
		if (!taskEntry) throw new Error("Expected task to exist");
		taskEntry.conversationId = conv.id;
		writeJSON(tasksPath, tasksData2);

		// ── Execute: call the project stop route ──
		const params = Promise.resolve({ id: projectId });
		const request = new Request(
			`http://localhost/api/projects/${projectId}/stop`,
			{ method: "POST" },
		);
		const response = await POST(request, { params });
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.missionId).toBe(missionId);
		expect(body.killed).toBeGreaterThanOrEqual(1);

		// ── Verify: conversation is cancelled ──
		const updatedConv = await getConversation(conv.id);
		expect(updatedConv).not.toBeNull();
		expect(updatedConv?.status).toBe("cancelled");
		expect(updatedConv?.cancelledAt).not.toBeNull();
		expect(updatedConv?.currentRunId).toBeNull();

		// ── Verify: conversation run is stopped ──
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
			expect(evt.payload.reason).toBe("Stopped by project stop");
		}
	});
});
