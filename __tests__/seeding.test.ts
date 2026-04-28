import { existsSync } from "fs";
import { readdir, readFile, rm } from "fs/promises";
import os from "os";
import path from "path";
import { afterAll, describe, expect, it } from "vitest";
import { ensureWorkspaceDir, getWorkspaceDataDir } from "@/lib/data";

// Use a throwaway workspace ID so we never touch the live "default" workspace.
const TEST_WS_ID = `test-seed-${Date.now()}`;
const DATA_DIR = process.env.MANDIO_DATA_DIR
	? path.resolve(process.env.MANDIO_DATA_DIR)
	: path.join(os.homedir(), ".mandio");
const WS_DIR = path.join(DATA_DIR, "workspaces", TEST_WS_ID);

afterAll(async () => {
	// Clean up the test workspace
	if (existsSync(WS_DIR)) {
		await rm(WS_DIR, { recursive: true, force: true });
	}
});

describe("ensureWorkspaceDir", () => {
	it("creates the workspace directory structure", async () => {
		await ensureWorkspaceDir(TEST_WS_ID);
		expect(existsSync(WS_DIR)).toBe(true);
	});

	it("seeds all expected JSON files", async () => {
		const expectedFiles = [
			"tasks.json",
			"tasks-archive.json",
			"initiatives.json",
			"projects.json",
			"brain-dump.json",
			"activity-log.json",
			"inbox.json",
			"decisions.json",
			"agents.json",
			"skills-library.json",
			"active-runs.json",
			"daemon-config.json",
		];
		for (const file of expectedFiles) {
			const fp = path.join(WS_DIR, file);
			expect(existsSync(fp), `Missing: ${file}`).toBe(true);
			const raw = await readFile(fp, "utf-8");
			expect(() => JSON.parse(raw), `Invalid JSON: ${file}`).not.toThrow();
		}
	});

	it("seeds agents from artifacts (not empty)", async () => {
		const raw = await readFile(path.join(WS_DIR, "agents.json"), "utf-8");
		const data = JSON.parse(raw);
		expect(data.agents.length).toBeGreaterThan(0);
		// Should have the built-in agents
		const ids = data.agents.map((a: { id: string }) => a.id);
		expect(ids).toContain("me");
		expect(ids).toContain("developer");
		expect(ids).toContain("researcher");
	});

	it("seeds skills-library from artifacts (not empty)", async () => {
		const raw = await readFile(
			path.join(WS_DIR, "skills-library.json"),
			"utf-8",
		);
		const data = JSON.parse(raw);
		expect(data.skills.length).toBeGreaterThan(0);
	});

	it("seeds daemon-config from artifacts (not empty object)", async () => {
		const raw = await readFile(
			path.join(WS_DIR, "daemon-config.json"),
			"utf-8",
		);
		const data = JSON.parse(raw);
		expect(Object.keys(data).length).toBeGreaterThan(0);
		expect(data).toHaveProperty("polling");
		expect(data).toHaveProperty("execution");
	});

	it("seeds CLAUDE.md from artifacts", async () => {
		const fp = path.join(WS_DIR, "CLAUDE.md");
		expect(existsSync(fp)).toBe(true);
		const content = await readFile(fp, "utf-8");
		expect(content.length).toBeGreaterThan(100);
	});

	it("seeds .claude/commands from artifacts", async () => {
		const claudeDir = path.join(WS_DIR, ".claude");
		expect(existsSync(claudeDir)).toBe(true);
		expect(existsSync(path.join(claudeDir, "commands"))).toBe(true);
		// Should have built-in workflow commands
		expect(
			existsSync(path.join(claudeDir, "commands", "standup", "user.md")),
		).toBe(true);
		expect(
			existsSync(path.join(claudeDir, "commands", "daily-plan", "user.md")),
		).toBe(true);
	});

	it("seeds .claude/skills from artifacts", async () => {
		const skillsDir = path.join(WS_DIR, ".claude", "skills");
		expect(existsSync(skillsDir)).toBe(true);
		expect(
			existsSync(path.join(skillsDir, "task-management", "SKILL.md")),
		).toBe(true);
	});

	it("does not overwrite existing files on re-run", async () => {
		// Write a known value to tasks.json
		const marker = JSON.stringify({ tasks: [{ id: "marker_task" }] });
		const fp = path.join(WS_DIR, "tasks.json");
		const { writeFile: wf } = await import("fs/promises");
		await wf(fp, marker, "utf-8");

		// Re-run seeding
		await ensureWorkspaceDir(TEST_WS_ID);

		// tasks.json should still have our marker, not be overwritten
		const raw = await readFile(fp, "utf-8");
		const data = JSON.parse(raw);
		expect(data.tasks[0].id).toBe("marker_task");
	});

	it("getWorkspaceDataDir returns correct path", () => {
		const dir = getWorkspaceDataDir(TEST_WS_ID);
		expect(dir).toBe(WS_DIR);
	});
});
