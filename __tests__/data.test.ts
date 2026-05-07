import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	getActivityLog,
	getAgents,
	getBrainDump,
	getDecisions,
	getInbox,
	getProjects,
	getTasks,
	getTasksArchive,
	getWorkspaceDataDir,
	saveProjects,
	saveTasks,
	withTasks,
} from "@/lib/data";
import type { ProjectsFile, TasksFile } from "@/lib/types";
import { backupDataFiles, restoreDataFiles } from "./helpers";

const DATA_DIR = getWorkspaceDataDir("default");

let backups: Record<string, string>;

beforeAll(async () => {
	backups = await backupDataFiles();
});

afterAll(async () => {
	await restoreDataFiles(backups);
});

// ─── Tasks ────────────────────────────────────────────────────────────────────

describe("getTasks / saveTasks", () => {
	it("saves tasks and persists changes", async () => {
		const original = await getTasks();
		const originalCount = original.tasks.length;

		const newTask = {
			id: `task_test_${Date.now()}`,
			title: "Vitest test task",
			description: "Created during data layer test",
			importance: "important" as const,
			urgency: "urgent" as const,
			kanban: "not-started" as const,
			projectId: null,
			milestoneId: null,
			assignedTo: null,
			collaborators: [],
			subtasks: [],
			blockedBy: [],
			estimatedMinutes: null,
			actualMinutes: null,
			acceptanceCriteria: "",
			comments: [],
			tags: ["test"],
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			dueDate: null,
			completedAt: null,
			deletedAt: null,
		};

		const updated: TasksFile = { tasks: [...original.tasks, newTask] };
		await saveTasks(updated);

		const reread = await getTasks();
		expect(reread.tasks).toHaveLength(originalCount + 1);
		const found = reread.tasks.find((t) => t.id === newTask.id);
		expect(found).toBeDefined();
		expect(found?.title).toBe("Vitest test task");

		// Restore original
		await saveTasks(original);
	});

	it("preserves JSON formatting (2-space indentation)", async () => {
		const data = await getTasks();
		await saveTasks(data);
		const raw = await readFile(path.join(DATA_DIR, "tasks.json"), "utf-8");
		// JSON.stringify with 2-space indent starts objects on new lines
		expect(raw).toContain("  ");
		// Should be valid JSON
		expect(() => JSON.parse(raw)).not.toThrow();
	});
});

// ─── Projects ─────────────────────────────────────────────────────────────────

describe("getProjects / saveProjects", () => {
	it("saves projects and persists changes", async () => {
		const original = await getProjects();

		const newProject = {
			id: `proj_test_${Date.now()}`,
			name: "Vitest test project",
			description: "Test project",
			status: "active" as const,
			color: "#ff0000",
			teamMembers: [],
			createdAt: new Date().toISOString(),
			tags: [],
			deletedAt: null,
		};

		const updated: ProjectsFile = {
			projects: [...original.projects, newProject],
		};
		await saveProjects(updated);

		const reread = await getProjects();
		const found = reread.projects.find((p) => p.id === newProject.id);
		expect(found).toBeDefined();
		expect(found?.name).toBe("Vitest test project");

		// Restore original
		await saveProjects(original);
	});
});

// ─── Read-only Data Files ─────────────────────────────────────────────────────

describe("read-only data getters", () => {
	it.each([
		["tasks", getTasks, "tasks"],
		["brain dump", getBrainDump, "entries"],
		["inbox", getInbox, "messages"],
		["activity log", getActivityLog, "events"],
		["decisions", getDecisions, "decisions"],
		["agents", getAgents, "agents"],
		["tasks archive", getTasksArchive, "tasks"],
	] as const)("reads %s data", async (_name, getter, property) => {
		const data = await getter();
		expect(data).toHaveProperty(property);
		expect(
			Array.isArray((data as unknown as Record<string, unknown>)[property]),
		).toBe(true);
	});
});

// ─── Skills Library ──────────────────────────────────────────────────────────
// Skills are now stored as SKILL.md files; legacy getSkillsLibrary removed.

// ─── Mutex Safety (withTasks) ─────────────────────────────────────────────────
// NOTE: withTasks acquires the tasks mutex, so inside the callback we must
// write the file directly (bypassing saveTasks) to avoid deadlock, since
// saveTasks also tries to acquire the same mutex.

describe("withTasks (mutex-protected read-modify-write)", () => {
	const tasksFilePath = path.join(getWorkspaceDataDir("default"), "tasks.json");

	it("prevents concurrent writes from corrupting data", async () => {
		const original = await getTasks();

		const task1Id = `task_concurrent_1_${Date.now()}`;
		const task2Id = `task_concurrent_2_${Date.now()}`;

		// withTasks already holds the mutex, so we write the file directly
		// inside the callback (not via saveTasks, which would deadlock).
		const op1 = withTasks(async (data) => {
			const newTask = {
				id: task1Id,
				title: "Concurrent task 1",
				description: "",
				importance: "important" as const,
				urgency: "urgent" as const,
				kanban: "not-started" as const,
				projectId: null,
				milestoneId: null,
				assignedTo: null,
				collaborators: [],
				subtasks: [],
				blockedBy: [],
				estimatedMinutes: null,
				actualMinutes: null,
				acceptanceCriteria: "",
				comments: [],
				tags: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				dueDate: null,
				completedAt: null,
				deletedAt: null,
			};
			data.tasks.push(newTask);
			await writeFile(tasksFilePath, JSON.stringify(data, null, 2), "utf-8");
			return task1Id;
		});

		const op2 = withTasks(async (data) => {
			const newTask = {
				id: task2Id,
				title: "Concurrent task 2",
				description: "",
				importance: "not-important" as const,
				urgency: "not-urgent" as const,
				kanban: "not-started" as const,
				projectId: null,
				milestoneId: null,
				assignedTo: null,
				collaborators: [],
				subtasks: [],
				blockedBy: [],
				estimatedMinutes: null,
				actualMinutes: null,
				acceptanceCriteria: "",
				comments: [],
				tags: [],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
				dueDate: null,
				completedAt: null,
				deletedAt: null,
			};
			data.tasks.push(newTask);
			await writeFile(tasksFilePath, JSON.stringify(data, null, 2), "utf-8");
			return task2Id;
		});

		// Both operations should complete without error (serialized by mutex)
		const [id1, id2] = await Promise.all([op1, op2]);
		expect(id1).toBe(task1Id);
		expect(id2).toBe(task2Id);

		// The mutex serializes execution: op2 re-reads after op1 finishes,
		// so both tasks should be present in the final state.
		const final = await getTasks();
		const has1 = final.tasks.some((t) => t.id === task1Id);
		const has2 = final.tasks.some((t) => t.id === task2Id);
		expect(has1).toBe(true);
		expect(has2).toBe(true);

		// Restore original
		await saveTasks(original);
	});
});

// ─── Edge Cases ──────────────────────────────────────────────────────────────

describe("edge cases", () => {
	it("handles saving and reading empty arrays", async () => {
		const original = await getTasks();
		await saveTasks({ tasks: [] });

		const empty = await getTasks();
		expect(empty.tasks).toEqual([]);

		// Restore
		await saveTasks(original);
	});
});
