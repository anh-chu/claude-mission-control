import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

export interface SkillFrontmatter {
	name: string;
	description: string;
	tags: string[];
	agentIds: string[];
}

export interface SkillFileData {
	id: string; // derived from directory name
	name: string;
	description: string;
	content: string; // markdown body (no frontmatter)
	tags: string[];
	agentIds: string[];
	createdAt: string; // from fs stat mtime
	updatedAt: string; // from fs stat mtime
}

/** Parse a SKILL.md file content string into SkillFileData */
export function parseSkillFile(
	id: string,
	raw: string,
): Omit<SkillFileData, "createdAt" | "updatedAt"> {
	const { data, content } = matter(raw);
	return {
		id,
		name: data.name || id,
		description: data.description || "",
		content: content.trim(),
		tags: Array.isArray(data.tags) ? data.tags : [],
		agentIds: Array.isArray(data.agentIds) ? data.agentIds : [],
	};
}

/** Serialize SkillFileData back to SKILL.md format */
export function serializeSkillFile(
	skill: SkillFileData | Omit<SkillFileData, "createdAt" | "updatedAt">,
): string {
	const frontmatter: SkillFrontmatter = {
		name: skill.name,
		description: skill.description,
		tags: skill.tags,
		agentIds: skill.agentIds,
	};
	return matter.stringify(skill.content, frontmatter);
}

/** Read a single skill from its directory */
export async function readSkillFile(
	skillDir: string,
): Promise<SkillFileData | null> {
	const filePath = path.join(skillDir, "SKILL.md");
	if (!existsSync(filePath)) return null;
	const raw = await readFile(filePath, "utf-8");
	const id = path.basename(skillDir);
	const parsed = parseSkillFile(id, raw);
	const stats = await stat(filePath);
	return {
		...parsed,
		createdAt: stats.birthtime.toISOString(),
		updatedAt: stats.mtime.toISOString(),
	};
}

/** Read a single skill from its directory (sync version) */
export function readSkillFileSync(skillDir: string): SkillFileData | null {
	const filePath = path.join(skillDir, "SKILL.md");
	if (!existsSync(filePath)) return null;
	const raw = readFileSync(filePath, "utf-8");
	const id = path.basename(skillDir);
	const parsed = parseSkillFile(id, raw);
	const stats = statSync(filePath);
	return {
		...parsed,
		createdAt: stats.birthtime.toISOString(),
		updatedAt: stats.mtime.toISOString(),
	};
}

/** Write a skill to its directory (creates dir if needed) */
export async function writeSkillFile(
	skillDir: string,
	skill: SkillFileData | Omit<SkillFileData, "createdAt" | "updatedAt">,
): Promise<void> {
	await mkdir(skillDir, { recursive: true });
	const filePath = path.join(skillDir, "SKILL.md");
	const content = serializeSkillFile(skill);
	await writeFile(filePath, content, "utf-8");
}

/** List all skill IDs (directory names) from a skills base directory */
export async function listSkillIds(skillsBaseDir: string): Promise<string[]> {
	if (!existsSync(skillsBaseDir)) return [];
	const entries = await readdir(skillsBaseDir, { withFileTypes: true });
	const ids: string[] = [];
	for (const entry of entries) {
		if (entry.isDirectory() || entry.isSymbolicLink()) {
			const skillMd = path.join(skillsBaseDir, entry.name, "SKILL.md");
			if (existsSync(skillMd)) {
				ids.push(entry.name);
			}
		}
	}
	return ids;
}

/** List all skill IDs (directory names) from a skills base directory (sync version) */
export function listSkillIdsSync(skillsBaseDir: string): string[] {
	if (!existsSync(skillsBaseDir)) return [];
	const entries = readdirSync(skillsBaseDir, { withFileTypes: true });
	const ids: string[] = [];
	for (const entry of entries) {
		if (entry.isDirectory() || entry.isSymbolicLink()) {
			const skillMd = path.join(skillsBaseDir, entry.name, "SKILL.md");
			if (existsSync(skillMd)) {
				ids.push(entry.name);
			}
		}
	}
	return ids;
}

/** Read all skills from a skills base directory */
export async function readAllSkills(
	skillsBaseDir: string,
): Promise<SkillFileData[]> {
	const ids = await listSkillIds(skillsBaseDir);
	const skills: SkillFileData[] = [];
	for (const id of ids) {
		const skill = await readSkillFile(path.join(skillsBaseDir, id));
		if (skill) skills.push(skill);
	}
	return skills;
}

/** Read all skills from a skills base directory (sync version) */
export function readAllSkillsSync(skillsBaseDir: string): SkillFileData[] {
	const ids = listSkillIdsSync(skillsBaseDir);
	const skills: SkillFileData[] = [];
	for (const id of ids) {
		const skill = readSkillFileSync(path.join(skillsBaseDir, id));
		if (skill) skills.push(skill);
	}
	return skills;
}
