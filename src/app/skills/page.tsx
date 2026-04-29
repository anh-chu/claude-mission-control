"use client";

import { BookOpen, Check, Copy, Plus, Tag, Terminal, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { CardSkeleton, GridSkeleton, Skeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tip } from "@/components/ui/tip";
import { useAgents, useCommands, useSkills } from "@/hooks/use-data";
import { useWorkspace } from "@/hooks/use-workspace";
import type { CommandDefinition, SkillDefinition } from "@/lib/types";

function CopyButton({ text }: { text: string }) {
	const [copied, setCopied] = useState(false);
	const handleCopy = async () => {
		await navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};
	return (
		<Button
			variant="ghost"
			size="icon"
			className="size-4 shrink-0"
			onClick={handleCopy}
			aria-label="Copy to clipboard"
		>
			{copied ? (
				<Check className="h-3 w-3 text-success" />
			) : (
				<Copy className="h-3 w-3" />
			)}
		</Button>
	);
}

function SkillCard({
	skill,
	agentNames,
	onToggleActivation,
	toggling,
	onCustomize,
	onReset,
}: {
	skill: SkillDefinition;
	agentNames: string[];
	onToggleActivation?: (active: boolean) => void;
	toggling?: boolean;
	onCustomize?: () => void;
	onReset?: () => void;
}) {
	const isActivated = skill.activated === true;
	const isCustomized = skill.customized === true;

	const handleToggle = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		onToggleActivation?.(!isActivated);
	};

	const handleCustomize = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		onCustomize?.();
	};

	const handleReset = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		onReset?.();
	};

	return (
		<Link href={`/skills/${skill.id}`}>
			<div
				className={`group rounded-sm border bg-card p-5 transition-all hover:shadow-e-2 hover:border-primary/30 ${
					isActivated ? "border-primary/40 bg-primary-soft/30" : ""
				}`}
			>
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0 flex-1">
						<div className="flex items-center gap-2 flex-wrap">
							<h3 className="font-normal text-sm group-hover:text-primary transition-colors">
								{skill.name}
							</h3>
							{isActivated && !isCustomized && (
								<Badge
									variant="outline"
									className="text-[10px] px-1.5 py-0 border-muted-foreground/40 text-muted-foreground shrink-0"
								>
									Shared
								</Badge>
							)}
							{isActivated && isCustomized && (
								<Badge
									variant="outline"
									className="text-[10px] px-1.5 py-0 border-primary/40 text-primary shrink-0"
								>
									Customized
								</Badge>
							)}
						</div>
						<p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
							{skill.description}
						</p>
					</div>
					{onToggleActivation !== undefined ? (
						<div
							className="shrink-0"
							onClick={handleToggle}
							role="button"
							tabIndex={0}
							onKeyDown={(e) =>
								e.key === " " && handleToggle(e as unknown as React.MouseEvent)
							}
						>
							<Switch
								checked={isActivated}
								disabled={toggling}
								aria-label={isActivated ? "Deactivate skill" : "Activate skill"}
							/>
						</div>
					) : (
						<BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
					)}
				</div>

				{/* Fork / Reset actions */}
				{isActivated && !isCustomized && onCustomize && (
					<div className="mt-3" onClick={(e) => e.preventDefault()}>
						<Button
							variant="outline"
							size="sm"
							className="h-6 text-[11px] px-2 gap-1"
							onClick={handleCustomize}
							disabled={toggling}
						>
							Customize
						</Button>
					</div>
				)}
				{isActivated && isCustomized && onReset && (
					<div className="mt-3" onClick={(e) => e.preventDefault()}>
						<Button
							variant="ghost"
							size="sm"
							className="h-6 text-[11px] px-2 gap-1 text-muted-foreground hover:text-foreground"
							onClick={handleReset}
							disabled={toggling}
						>
							Reset to default
						</Button>
					</div>
				)}

				{/* Agents assigned */}
				{agentNames.length > 0 && (
					<div className="flex flex-wrap gap-1 mt-3">
						{agentNames.map((name) => (
							<Badge
								key={name}
								variant="outline"
								className="text-[10px] px-1.5 py-0"
							>
								{name}
							</Badge>
						))}
					</div>
				)}

				{/* Tags */}
				{skill.tags.length > 0 && (
					<div className="flex items-center gap-1 mt-2">
						<Tag className="h-3 w-3 text-muted-foreground" />
						<div className="flex flex-wrap gap-1">
							{skill.tags.map((tag) => (
								<Badge
									key={tag}
									variant="secondary"
									className="text-[10px] px-1.5 py-0"
								>
									{tag}
								</Badge>
							))}
						</div>
					</div>
				)}

				{/* Content preview */}
				<p className="text-xs text-muted-foreground mt-3 pt-3 border-t line-clamp-2 font-mono">
					{skill.content.slice(0, 120)}...
				</p>
			</div>
		</Link>
	);
}

export default function SkillsPage() {
	const { currentId: workspaceId } = useWorkspace();
	const {
		skills,
		loading,
		error: skillsError,
		refetch,
		activate,
		deactivate,
		fork: forkSkill,
		reset: resetSkill,
	} = useSkills(workspaceId);
	const {
		commands,
		activate: activateCommand,
		deactivate: deactivateCommand,
		fork: forkCommand,
		reset: resetCommand,
	} = useCommands(workspaceId);
	const { agents } = useAgents();
	const router = useRouter();
	const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
	const [togglingCommandIds, setTogglingCommandIds] = useState<Set<string>>(
		new Set(),
	);

	const getAgentNames = (agentIds: string[]) =>
		agentIds.map((id) => agents.find((a) => a.id === id)?.name ?? id);

	const handleToggle = async (skillId: string, active: boolean) => {
		setTogglingIds((prev) => new Set(prev).add(skillId));
		try {
			if (active) {
				await activate(skillId);
			} else {
				await deactivate(skillId);
			}
		} finally {
			setTogglingIds((prev) => {
				const next = new Set(prev);
				next.delete(skillId);
				return next;
			});
		}
	};

	if (loading) {
		return (
			<div className="space-y-6">
				<BreadcrumbNav items={[{ label: "Skills Library" }]} />
				<GridSkeleton
					className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
					count={3}
					renderItem={() => (
						<CardSkeleton
							className="p-5 space-y-3"
							footer={[
								{ key: "tag-1", className: "h-4 w-14 rounded-sm" },
								{ key: "tag-2", className: "h-4 w-18 rounded-sm" },
							]}
							footerClassName="flex gap-1"
						>
							<div className="space-y-1.5">
								<Skeleton className="h-5 w-32" />
								<Skeleton className="h-3 w-48" />
							</div>
							<div className="flex gap-1.5">
								<Skeleton className="h-5 w-5 rounded-full" />
								<Skeleton className="h-5 w-5 rounded-full" />
							</div>
						</CardSkeleton>
					)}
				/>
			</div>
		);
	}

	if (skillsError) {
		return (
			<div className="space-y-6">
				<BreadcrumbNav items={[{ label: "Skills Library" }]} />
				<ErrorState message={skillsError} onRetry={refetch} />
			</div>
		);
	}

	const activatedSkills = skills.filter((s) => s.activated === true);
	const availableSkills = skills.filter((s) => s.activated !== true);

	return (
		<div className="space-y-6">
			<BreadcrumbNav items={[{ label: "Skills Library" }]} />

			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-xl font-normal">Skills Library</h1>
					<p className="text-sm text-muted-foreground mt-0.5">
						{skills.length} skill{skills.length !== 1 ? "s" : ""} available
						{activatedSkills.length > 0 && (
							<>
								{" "}
								·{" "}
								<span className="text-primary">
									{activatedSkills.length} active
								</span>
							</>
						)}
					</p>
				</div>
				<Tip content="Create a new skill">
					<Button
						size="sm"
						onClick={() => router.push("/skills/new")}
						className="gap-1.5"
					>
						<Plus className="h-3.5 w-3.5" /> New Skill
					</Button>
				</Tip>
			</div>

			{skills.length === 0 ? (
				<EmptyState
					icon={BookOpen}
					title="No skills yet"
					description="Skills define specialized knowledge that agents can use. Create your first skill."
					actionLabel="Create a skill"
					onAction={() => router.push("/skills/new")}
				/>
			) : (
				<div className="space-y-6">
					{/* Active skills */}
					{activatedSkills.length > 0 && (
						<div className="space-y-3">
							<div className="flex items-center gap-2">
								<Zap className="h-3.5 w-3.5 text-primary" />
								<h2 className="text-sm font-normal text-primary">
									Active for this workspace
								</h2>
							</div>
							<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
								{activatedSkills.map((skill) => (
									<SkillCard
										key={skill.id}
										skill={skill}
										agentNames={getAgentNames(skill.agentIds)}
										onToggleActivation={(active) =>
											handleToggle(skill.id, active)
										}
										toggling={togglingIds.has(skill.id)}
										onCustomize={async () => {
											setTogglingIds((prev) => new Set(prev).add(skill.id));
											try {
												await forkSkill(skill.id);
												router.push(`/skills/${skill.id}`);
											} finally {
												setTogglingIds((prev) => {
													const next = new Set(prev);
													next.delete(skill.id);
													return next;
												});
											}
										}}
										onReset={async () => {
											setTogglingIds((prev) => new Set(prev).add(skill.id));
											try {
												await resetSkill(skill.id);
											} finally {
												setTogglingIds((prev) => {
													const next = new Set(prev);
													next.delete(skill.id);
													return next;
												});
											}
										}}
									/>
								))}
							</div>
						</div>
					)}

					{/* Available skills */}
					{availableSkills.length > 0 && (
						<div className="space-y-3">
							{activatedSkills.length > 0 && (
								<div className="flex items-center gap-2">
									<BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
									<h2 className="text-sm font-normal text-muted-foreground">
										Available
									</h2>
								</div>
							)}
							<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
								{availableSkills.map((skill) => (
									<SkillCard
										key={skill.id}
										skill={skill}
										agentNames={getAgentNames(skill.agentIds)}
										onToggleActivation={(active) =>
											handleToggle(skill.id, active)
										}
										toggling={togglingIds.has(skill.id)}
										onCustomize={async () => {
											setTogglingIds((prev) => new Set(prev).add(skill.id));
											try {
												await forkSkill(skill.id);
												router.push(`/skills/${skill.id}`);
											} finally {
												setTogglingIds((prev) => {
													const next = new Set(prev);
													next.delete(skill.id);
													return next;
												});
											}
										}}
										onReset={async () => {
											setTogglingIds((prev) => new Set(prev).add(skill.id));
											try {
												await resetSkill(skill.id);
											} finally {
												setTogglingIds((prev) => {
													const next = new Set(prev);
													next.delete(skill.id);
													return next;
												});
											}
										}}
									/>
								))}
							</div>
						</div>
					)}
				</div>
			)}

			{/* AI Commands (slash commands) */}
			<div className="rounded-sm border bg-card">
				<div className="flex items-center justify-between border-b px-5 py-4">
					<div className="flex items-center gap-3">
						<div className="h-9 w-9 rounded-full bg-primary-soft flex items-center justify-center">
							<Terminal className="h-4 w-4 text-primary" />
						</div>
						<div>
							<h2 className="text-sm font-normal">AI Commands</h2>
							<p className="text-xs text-muted-foreground">
								Slash commands for Claude Code — type in the CLI to activate
							</p>
						</div>
					</div>
					<Tip content="Create a new command">
						<Button
							size="sm"
							variant="outline"
							onClick={() => router.push("/commands/new")}
							className="gap-1.5"
						>
							<Plus className="h-3.5 w-3.5" /> New Command
						</Button>
					</Tip>
				</div>
				{commands.length === 0 ? (
					<div className="px-5 py-8 text-center text-xs text-muted-foreground">
						No commands yet. Create one to get started.
					</div>
				) : (
					<div className="divide-y">
						{commands.map((cmd: CommandDefinition) => {
							const isActive = cmd.activated === true;
							const isCustomized = cmd.customized === true;
							const isToggling = togglingCommandIds.has(cmd.id);
							const handleCommandToggle = async (e: React.MouseEvent) => {
								e.preventDefault();
								e.stopPropagation();
								setTogglingCommandIds((prev) => new Set(prev).add(cmd.id));
								try {
									if (isActive) {
										await deactivateCommand(cmd.id);
									} else {
										await activateCommand(cmd.id);
									}
								} finally {
									setTogglingCommandIds((prev) => {
										const next = new Set(prev);
										next.delete(cmd.id);
										return next;
									});
								}
							};
							return (
								<div
									key={cmd.id}
									className={`flex items-center gap-3 px-5 py-2.5 ${
										isActive ? "bg-primary-soft/20" : ""
									}`}
								>
									<code className="text-xs font-mono font-normal text-primary min-w-[130px]">
										{cmd.command}
									</code>
									<span className="text-xs text-muted-foreground flex-1">
										{cmd.longDescription}
									</span>
									{isActive && !isCustomized && (
										<Badge
											variant="outline"
											className="text-[10px] px-1.5 py-0 border-muted-foreground/40 text-muted-foreground shrink-0"
										>
											Shared
										</Badge>
									)}
									{isActive && isCustomized && (
										<Badge
											variant="outline"
											className="text-[10px] px-1.5 py-0 border-primary/40 text-primary shrink-0"
										>
											Customized
										</Badge>
									)}
									{isActive && !isCustomized && (
										<Button
											variant="outline"
											size="sm"
											className="h-6 text-[11px] px-2 shrink-0"
											disabled={isToggling}
											onClick={async (e) => {
												e.preventDefault();
												e.stopPropagation();
												setTogglingCommandIds((prev) =>
													new Set(prev).add(cmd.id),
												);
												try {
													await forkCommand(cmd.id);
													router.push(`/commands/${cmd.id}`);
												} finally {
													setTogglingCommandIds((prev) => {
														const next = new Set(prev);
														next.delete(cmd.id);
														return next;
													});
												}
											}}
										>
											Customize
										</Button>
									)}
									{isActive && isCustomized && (
										<Button
											variant="ghost"
											size="sm"
											className="h-6 text-[11px] px-2 shrink-0 text-muted-foreground hover:text-foreground"
											disabled={isToggling}
											onClick={async (e) => {
												e.preventDefault();
												e.stopPropagation();
												setTogglingCommandIds((prev) =>
													new Set(prev).add(cmd.id),
												);
												try {
													await resetCommand(cmd.id);
												} finally {
													setTogglingCommandIds((prev) => {
														const next = new Set(prev);
														next.delete(cmd.id);
														return next;
													});
												}
											}}
										>
											Reset
										</Button>
									)}
									<CopyButton text={cmd.command} />
									<div
										className="shrink-0"
										onClick={handleCommandToggle}
										role="button"
										tabIndex={0}
										onKeyDown={(e) =>
											e.key === " " &&
											handleCommandToggle(e as unknown as React.MouseEvent)
										}
									>
										<Switch
											checked={isActive}
											disabled={isToggling}
											aria-label={
												isActive ? "Deactivate command" : "Activate command"
											}
										/>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</div>
	);
}
