import { existsSync, lstatSync, readdirSync, readlinkSync } from "node:fs";
import {
	cp,
	lstat,
	mkdir,
	readdir,
	readlink,
	rm,
	symlink,
	unlink,
} from "node:fs/promises";
import path from "node:path";
import {
	getGlobalSkillDir,
	getGlobalSkillsDir,
	getWorkspaceSkillLink,
	getWorkspaceSkillsDir,
	MANDIO_SKILL_PREFIX,
} from "./paths";
import { listSkillIds } from "./skill-files";

/** Activate a skill for a workspace (create directory symlink) */
export async function activateSkill(
	workspaceId: string,
	skillId: string,
): Promise<void> {
	const globalDir = getGlobalSkillDir(skillId);
	if (!existsSync(globalDir)) {
		throw new Error(`Skill ${skillId} not found in global store`);
	}
	const linkPath = getWorkspaceSkillLink(workspaceId, skillId);
	const parentDir = path.dirname(linkPath);
	await mkdir(parentDir, { recursive: true });

	// Remove existing link if present (idempotent)
	try {
		const st = await lstat(linkPath);
		if (st.isSymbolicLink()) {
			await unlink(linkPath); // remove old/broken symlink
		} else {
			throw new Error(`Skill path exists and is not a symlink: ${linkPath}`);
		}
	} catch (err: unknown) {
		const code =
			err && typeof err === "object" && "code" in err
				? (err as { code: string }).code
				: undefined;
		if (code !== "ENOENT") throw err;
		// doesn't exist — fine, proceed to create
	}
	await symlink(globalDir, linkPath, "dir");
}

/** Deactivate a skill for a workspace (remove symlink) */
export async function deactivateSkill(
	workspaceId: string,
	skillId: string,
): Promise<void> {
	const linkPath = getWorkspaceSkillLink(workspaceId, skillId);
	try {
		const stats = await lstat(linkPath);
		if (stats.isSymbolicLink()) {
			await unlink(linkPath);
		}
	} catch (err: unknown) {
		const code =
			err && typeof err === "object" && "code" in err
				? (err as { code: string }).code
				: undefined;
		if (err instanceof Error && err.message.includes("not a symlink"))
			throw err;
		if (code !== "ENOENT") throw err;
		// Already gone — fine
	}
}

/** List activated skill IDs for a workspace (strips mandio- prefix) */
export async function listActivatedSkills(
	workspaceId: string,
): Promise<string[]> {
	const dir = getWorkspaceSkillsDir(workspaceId);
	if (!existsSync(dir)) return [];
	const entries = await readdir(dir, { withFileTypes: true });
	const ids: string[] = [];
	for (const entry of entries) {
		if (entry.name.startsWith(MANDIO_SKILL_PREFIX)) {
			// Check if symlink is valid (not broken)
			const fullPath = path.join(dir, entry.name);
			try {
				const stats = await lstat(fullPath);
				if (stats.isSymbolicLink()) {
					const target = await readlink(fullPath);
					const resolved = path.isAbsolute(target)
						? target
						: path.resolve(dir, target);
					if (!existsSync(resolved)) {
						console.warn(`Broken skill symlink (target missing): ${fullPath}`);
						continue;
					}
				}
				if (stats.isSymbolicLink() || stats.isDirectory()) {
					ids.push(entry.name.slice(MANDIO_SKILL_PREFIX.length));
				}
			} catch {
				// broken symlink — skip, log warning
				console.warn(`Broken skill symlink: ${fullPath}`);
			}
		}
	}
	return ids;
}

/** Check if a skill is activated for a workspace */
export async function isSkillActivated(
	workspaceId: string,
	skillId: string,
): Promise<boolean> {
	const linkPath = getWorkspaceSkillLink(workspaceId, skillId);
	try {
		const stats = await lstat(linkPath);
		return stats.isSymbolicLink() || stats.isDirectory();
	} catch {
		return false;
	}
}

/** List activated skill IDs for a workspace synchronously (strips mandio- prefix) */
export function listActivatedSkillsSync(workspaceId: string): string[] {
	const dir = getWorkspaceSkillsDir(workspaceId);
	if (!existsSync(dir)) return [];
	const entries = readdirSync(dir, { withFileTypes: true });
	const ids: string[] = [];
	for (const entry of entries) {
		if (entry.name.startsWith(MANDIO_SKILL_PREFIX)) {
			const fullPath = path.join(dir, entry.name);
			try {
				const stats = lstatSync(fullPath);
				if (stats.isSymbolicLink()) {
					const target = readlinkSync(fullPath);
					const resolved = path.isAbsolute(target)
						? target
						: path.resolve(dir, target);
					if (!existsSync(resolved)) {
						console.warn(`Broken skill symlink (target missing): ${fullPath}`);
						continue;
					}
				}
				if (stats.isSymbolicLink() || stats.isDirectory()) {
					ids.push(entry.name.slice(MANDIO_SKILL_PREFIX.length));
				}
			} catch {
				console.warn(`Broken skill symlink: ${fullPath}`);
			}
		}
	}
	return ids;
}

/** Activate all global skills for a workspace */
export async function activateAllSkills(workspaceId: string): Promise<void> {
	const globalDir = getGlobalSkillsDir();
	const skillIds = await listSkillIds(globalDir);
	for (const id of skillIds) {
		await activateSkill(workspaceId, id);
	}
}

/** Check if a workspace skill is customized (local copy) vs shared (symlink) */
export async function isSkillCustomized(
	workspaceId: string,
	skillId: string,
): Promise<boolean> {
	const linkPath = getWorkspaceSkillLink(workspaceId, skillId);
	try {
		const stats = await lstat(linkPath);
		return stats.isDirectory() && !stats.isSymbolicLink();
	} catch {
		return false;
	}
}

/** Check if a workspace skill is customized (local copy) vs shared (symlink) — sync */
export function isSkillCustomizedSync(
	workspaceId: string,
	skillId: string,
): boolean {
	const linkPath = getWorkspaceSkillLink(workspaceId, skillId);
	try {
		const stats = lstatSync(linkPath);
		return stats.isDirectory() && !stats.isSymbolicLink();
	} catch {
		return false;
	}
}

/** Fork: copy global skill to workspace (replace symlink with real dir) */
export async function forkSkill(
	workspaceId: string,
	skillId: string,
): Promise<void> {
	const state = await getSkillActivationState(workspaceId, skillId);
	if (state === "customized")
		throw new Error("Already customized — reset first to re-fork");
	if (state === "inactive")
		throw new Error("Skill not activated — activate first");

	const linkPath = getWorkspaceSkillLink(workspaceId, skillId);
	const globalDir = getGlobalSkillDir(skillId);

	if (!existsSync(globalDir)) {
		throw new Error(`Skill ${skillId} not found in global store`);
	}

	const parentDir = path.dirname(linkPath);
	await mkdir(parentDir, { recursive: true });

	try {
		const stats = await lstat(linkPath);
		if (stats.isSymbolicLink()) {
			await unlink(linkPath);
		} else if (stats.isDirectory()) {
			await rm(linkPath, { recursive: true, force: true });
		}
	} catch (err: unknown) {
		const code =
			err && typeof err === "object" && "code" in err
				? (err as { code: string }).code
				: undefined;
		if (code !== "ENOENT") throw err;
		// path doesn't exist — fine, proceed to copy
	}

	await cp(globalDir, linkPath, { recursive: true });
}

/** Reset: delete local copy, re-create symlink to global */
export async function resetSkill(
	workspaceId: string,
	skillId: string,
): Promise<void> {
	const linkPath = getWorkspaceSkillLink(workspaceId, skillId);
	const globalDir = getGlobalSkillDir(skillId);

	if (!existsSync(globalDir))
		throw new Error(`Global skill ${skillId} not found`);

	await rm(linkPath, { recursive: true, force: true });
	await symlink(globalDir, linkPath, "dir");
}

/** Get activation state: inactive | shared | customized */
export async function getSkillActivationState(
	workspaceId: string,
	skillId: string,
): Promise<"inactive" | "shared" | "customized"> {
	const linkPath = getWorkspaceSkillLink(workspaceId, skillId);
	try {
		const stats = await lstat(linkPath);
		if (stats.isSymbolicLink()) return "shared";
		if (stats.isDirectory()) return "customized";
		return "inactive";
	} catch {
		return "inactive";
	}
}

/** Remove all workspace symlinks for a specific skill across all workspaces */
export async function deactivateSkillFromAllWorkspaces(
	skillId: string,
	workspaceIds: string[],
): Promise<void> {
	for (const wsId of workspaceIds) {
		await deactivateSkill(wsId, skillId);
	}
}
