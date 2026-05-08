/**
 * Smoke test: workspace poll isolation.
 *
 * Goal: confirm that toggling autopilot for workspace A does not affect
 * workspace B.  The core logic (enumerateWorkspaces, runWorkspaceTick,
 * runAutopilotTick) is private to scheduled-jobs.ts, so we test through the
 * public API: scheduleAutopilotPoller() and runStartupRecovery().
 *
 * All filesystem calls are mocked — no real filesystem state required.
 */
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock factories — evaluated before vi.mock() factories run
// ---------------------------------------------------------------------------
const {
	mockFsExistsSync,
	mockFsReaddirSync,
	mockFsReadFileSync,
	mockFsStatSync,
	mockFsUnlinkSync,
	mockSpawn,
	mockCronSchedule,
	mockCronValidate,
	mockLogger,
	mockData,
	mockConversations,
	mockProcessUtils,
	mockScriptEntrypoints,
	mockCommandPrompt,
} = vi.hoisted(() => ({
	mockFsExistsSync: vi.fn(),
	mockFsReaddirSync: vi.fn(),
	mockFsReadFileSync: vi.fn(),
	mockFsStatSync: vi.fn(),
	mockFsUnlinkSync: vi.fn(),
	mockSpawn: vi.fn(),
	mockCronSchedule: vi.fn(),
	mockCronValidate: vi.fn(),
	mockLogger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	},
	mockData: {
		getActiveRuns: vi.fn(),
		getDecisions: vi.fn(),
		getTasks: vi.fn(),
		mutateActiveRuns: vi.fn(),
		mutateTasks: vi.fn(),
	},
	mockConversations: {
		setConversationsWorkspace: vi.fn(),
		reapStaleRuns: vi.fn(),
	},
	mockProcessUtils: {
		isProcessAlive: vi.fn(),
	},
	mockScriptEntrypoints: {
		resolveScriptEntrypoint: vi.fn(),
	},
	mockCommandPrompt: {
		buildScheduledTask: vi.fn(),
		loadCommandPrompt: vi.fn(),
	},
}));

// ---------------------------------------------------------------------------
// Vitest mock registrations (hoisted)
// ---------------------------------------------------------------------------
vi.mock("node:fs", () => ({
	existsSync: mockFsExistsSync,
	readdirSync: mockFsReaddirSync,
	readFileSync: mockFsReadFileSync,
	statSync: mockFsStatSync,
	unlinkSync: mockFsUnlinkSync,
}));

vi.mock("node:fs/promises", () => ({
	readdir: vi.fn(),
	stat: vi.fn(),
	unlink: vi.fn(),
}));

vi.mock("node:child_process", () => ({
	spawn: mockSpawn,
}));

vi.mock("node-cron", () => ({
	default: { schedule: mockCronSchedule, validate: mockCronValidate },
	schedule: mockCronSchedule,
	validate: mockCronValidate,
}));

vi.mock("../src/lib/logger", () => ({
	createLogger: vi.fn(() => mockLogger),
}));

vi.mock("../src/lib/data", () => mockData);

vi.mock("../src/lib/conversations", () => mockConversations);

vi.mock("../src/lib/process-utils", () => mockProcessUtils);

vi.mock("../src/lib/script-entrypoints", () => mockScriptEntrypoints);

vi.mock("../src/lib/command-prompt", () => mockCommandPrompt);

import { DATA_DIR } from "../src/lib/paths";
// ---------------------------------------------------------------------------
// Imports (resolved against mocked modules)
// ---------------------------------------------------------------------------
import {
	runStartupRecovery,
	scheduleAutopilotPoller,
} from "../src/lib/scheduled-jobs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const WORKSPACES_DIR = path.join(DATA_DIR, "workspaces");

type PollConfig = {
	polling?: { enabled?: boolean };
	concurrency?: { maxParallelAgents?: number };
	execution?: { retries?: number };
};

type FsMockState = {
	dirs: string[];
	tombstones: string[];
	pollConfigs: Record<string, PollConfig | undefined>;
};

/** Configure the node:fs mocks to simulate a given workspace layout. */
function setupFs(state: FsMockState): void {
	const { dirs, tombstones, pollConfigs } = state;

	mockFsExistsSync.mockImplementation((p: unknown) => {
		const pStr = String(p);
		if (pStr === WORKSPACES_DIR) return true;
		// Tombstone check: path contains "/disabled" or "\disabled"
		if (pStr.endsWith("/disabled") || pStr.endsWith("\\disabled")) {
			return tombstones.some((ws) => {
				const tombPath = path.join(WORKSPACES_DIR, ws, "disabled");
				return pStr === tombPath;
			});
		}
		// Workspace directories themselves
		if (dirs.some((ws) => pStr === path.join(WORKSPACES_DIR, ws))) return true;
		return false;
	});

	mockFsReaddirSync.mockImplementation((p: unknown) => {
		if (String(p) === WORKSPACES_DIR) return [...dirs];
		return [];
	});

	mockFsStatSync.mockImplementation((p: unknown) => {
		const pStr = String(p);
		return {
			isDirectory: () =>
				dirs.some((ws) => pStr === path.join(WORKSPACES_DIR, ws)),
		};
	});

	mockFsReadFileSync.mockImplementation((p: unknown) => {
		const pStr = String(p);
		if (pStr.endsWith("daemon-config.json")) {
			for (const [ws, cfg] of Object.entries(pollConfigs)) {
				if (pStr === path.join(WORKSPACES_DIR, ws, "daemon-config.json")) {
					return JSON.stringify(cfg ?? {});
				}
			}
		}
		if (pStr.endsWith("agents.json")) return JSON.stringify({ agents: [] });
		if (pStr.endsWith("active-runs.json")) return JSON.stringify({ runs: [] });
		return "{}";
	});
}

/** Restore data mocks to safe defaults after each test. */
function resetDataMocks(): void {
	mockData.getActiveRuns.mockResolvedValue({ runs: [] });
	mockData.getDecisions.mockResolvedValue({ decisions: [] });
	mockData.getTasks.mockResolvedValue({ tasks: [] });
	mockData.mutateActiveRuns.mockImplementation(async (fn: Function) =>
		fn({ runs: [] }),
	);
	mockData.mutateTasks.mockImplementation(async (fn: Function) => {
		await fn({ tasks: [] });
		return undefined;
	});
}

/** Capture the poller-tick cron callback registered by scheduleAutopilotPoller. */
function captureTickCallback(): () => void {
	const call = mockCronSchedule.mock.calls.find(
		(args: unknown[]) => args[0] === "* * * * *",
	);
	if (!call) throw new Error("poller cron callback was never registered");
	return call[1] as () => void;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("workspace poll isolation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetDataMocks();

		// Safe defaults: empty workspace directory
		mockFsExistsSync.mockImplementation(
			(p: unknown) => String(p) === WORKSPACES_DIR,
		);
		mockFsReaddirSync.mockImplementation((p: unknown) =>
			String(p) === WORKSPACES_DIR ? [] : [],
		);
		mockFsStatSync.mockReturnValue({ isDirectory: () => false });
		mockFsReadFileSync.mockReturnValue("{}");
		mockSpawn.mockReturnValue({ unref: vi.fn(), pid: 12345 });
		mockProcessUtils.isProcessAlive.mockReturnValue(false);
		mockConversations.reapStaleRuns.mockResolvedValue(0);
		mockScriptEntrypoints.resolveScriptEntrypoint.mockReturnValue({
			runner: "node",
			args: [],
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	// -----------------------------------------------------------------------
	// 1. Poll on/off isolation
	// -----------------------------------------------------------------------
	it("tick skips a workspace whose daemon-config has polling disabled", async () => {
		setupFs({
			dirs: ["ws-a"],
			tombstones: [],
			pollConfigs: {
				"ws-a": {
					polling: { enabled: false },
					concurrency: { maxParallelAgents: 3 },
					execution: { retries: 1 },
				},
			},
		});

		scheduleAutopilotPoller();
		const tick = captureTickCallback();

		// Fire the tick
		tick();

		// Allow the async tick to settle (all mocked operations are synchronous
		// Promises, so a microtask drain is sufficient).
		await vi.waitFor(() => {
			// The tick fires a warning log at the "poller" level.
			// If polling is disabled, the tick returns early before calling data functions.
			expect(mockData.getTasks).not.toHaveBeenCalled();
		});
	});

	it("tick processes only the workspace with polling enabled", async () => {
		setupFs({
			dirs: ["ws-a", "ws-b"],
			tombstones: [],
			pollConfigs: {
				"ws-a": {
					polling: { enabled: false },
					concurrency: { maxParallelAgents: 3 },
					execution: { retries: 1 },
				},
				"ws-b": {
					polling: { enabled: true },
					concurrency: { maxParallelAgents: 3 },
					execution: { retries: 1 },
				},
			},
		});

		scheduleAutopilotPoller();
		const tick = captureTickCallback();

		tick();
		await vi.waitFor(() => {
			// ws-a is skipped (polling disabled). Only ws-b proceeds to
			// recovery/dispatch, so getTasks is called exactly once.
			expect(mockData.getTasks).toHaveBeenCalledTimes(1);
		});
	});

	// -----------------------------------------------------------------------
	// 2. Tombstone exclusion
	// -----------------------------------------------------------------------
	it("runStartupRecovery skips tombstoned workspaces", async () => {
		setupFs({
			dirs: ["ws-a", "ws-b"],
			tombstones: ["ws-a"],
			pollConfigs: {
				"ws-a": {
					polling: { enabled: true },
					concurrency: { maxParallelAgents: 3 },
					execution: { retries: 1 },
				},
				"ws-b": {
					polling: { enabled: true },
					concurrency: { maxParallelAgents: 3 },
					execution: { retries: 1 },
				},
			},
		});

		await runStartupRecovery();

		// runStartupRecovery internally calls enumerateWorkspaces() which
		// should filter out ws-a (tombstone present). Only ws-b proceeds to
		// recovery, so mutateActiveRuns is called exactly once.
		expect(mockData.mutateActiveRuns).toHaveBeenCalledTimes(1);
	});

	it("tick skips a workspace that acquired a tombstone after enumeration", async () => {
		// Simulate: enumerateWorkspaces() returns ws-a, but by the time
		// runWorkspaceTick() runs, the disabled file exists.
		setupFs({
			dirs: ["ws-a"],
			tombstones: ["ws-a"], // tombstone present → runWorkspaceTick re-check catches it
			pollConfigs: {
				"ws-a": {
					polling: { enabled: true },
					concurrency: { maxParallelAgents: 3 },
					execution: { retries: 1 },
				},
			},
		});

		scheduleAutopilotPoller();
		const tick = captureTickCallback();

		tick();
		await vi.waitFor(() => {
			// Even though polling is enabled, the tombstone re-check inside
			// runWorkspaceTick should cause an early return before any data
			// functions are reached.
			expect(mockData.getTasks).not.toHaveBeenCalled();
		});
	});

	// -----------------------------------------------------------------------
	// 3. Concurrent tick guard (autopilotTickRunning)
	// -----------------------------------------------------------------------
	it("prevents overlapping ticks via autopilotTickRunning guard", async () => {
		// Arrange: two workspaces so the tick has real work
		setupFs({
			dirs: ["ws-a"],
			tombstones: [],
			pollConfigs: {
				"ws-a": {
					polling: { enabled: true },
					concurrency: { maxParallelAgents: 3 },
					execution: { retries: 1 },
				},
			},
		});

		scheduleAutopilotPoller();
		const tick = captureTickCallback();

		// Reset call counters so we only track calls triggered by the callbacks
		mockFsReaddirSync.mockClear();
		mockLogger.debug.mockClear();

		// First tick: guard is false → proceeds, enumerateWorkspaces runs
		tick();

		// Second tick: guard should be true → early return
		tick();

		// Wait for async work to settle
		await vi.waitFor(() => {
			// enumerateWorkspaces is called by the first tick but skipped by
			// the second (guard prevented it). scheduleAutopilotPoller() also
			// calls enumerateWorkspaces() once for scheduled commands, but we
			// cleared the counter above, so only 1 call should remain.
			expect(mockFsReaddirSync).toHaveBeenCalledTimes(1);

			// The guard logs a "Skipping tick" message on the second call
			expect(mockLogger.debug).toHaveBeenCalledWith(
				"poller",
				expect.stringMatching(/skipping.*tick/i),
			);
		});
	});
});
