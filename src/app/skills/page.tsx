"use client";

import { BookOpen, Check, Copy, Plus, Tag, Terminal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { CardSkeleton, GridSkeleton, Skeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/ui/tip";
import { useAgents, useSkills } from "@/hooks/use-data";
import type { SkillDefinition } from "@/lib/types";
import { SKILLS } from "@/lib/types";

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
			className="h-6 w-6 shrink-0"
			onClick={handleCopy}
			aria-label="Copy to clipboard"
		>
			{copied ? (
				<Check className="h-3 w-3 text-green-500" />
			) : (
				<Copy className="h-3 w-3" />
			)}
		</Button>
	);
}

function SkillCard({
	skill,
	agentNames,
}: {
	skill: SkillDefinition;
	agentNames: string[];
}) {
	return (
		<Link href={`/skills/${skill.id}`}>
			<div className="group rounded-xl border bg-card p-5 transition-all hover:shadow-md hover:border-primary/30">
				<div className="flex items-start justify-between">
					<div>
						<h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
							{skill.name}
						</h3>
						<p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
							{skill.description}
						</p>
					</div>
					<BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
				</div>

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
	const { skills, loading, error: skillsError, refetch } = useSkills();
	const { agents } = useAgents();
	const router = useRouter();

	const getAgentNames = (agentIds: string[]) =>
		agentIds.map((id) => agents.find((a) => a.id === id)?.name ?? id);

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
								{ key: "tag-1", className: "h-4 w-14 rounded-full" },
								{ key: "tag-2", className: "h-4 w-18 rounded-full" },
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

	return (
		<div className="space-y-6">
			<BreadcrumbNav items={[{ label: "Skills Library" }]} />

			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-xl font-bold">Skills Library</h1>
					<p className="text-sm text-muted-foreground mt-0.5">
						{skills.length} skill{skills.length !== 1 ? "s" : ""} available
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
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{skills.map((skill) => (
						<SkillCard
							key={skill.id}
							skill={skill}
							agentNames={getAgentNames(skill.agentIds)}
						/>
					))}
				</div>
			)}

			{/* AI Commands (slash commands) */}
			<div className="rounded-xl border bg-card">
				<div className="flex items-center gap-3 border-b px-5 py-4">
					<div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
						<Terminal className="h-4 w-4 text-primary" />
					</div>
					<div>
						<h2 className="text-sm font-semibold">AI Commands</h2>
						<p className="text-xs text-muted-foreground">
							Slash commands for Claude Code — type in the CLI to activate
						</p>
					</div>
				</div>
				<div className="divide-y">
					{SKILLS.map((skill) => (
						<div
							key={skill.command}
							className="flex items-center gap-3 px-5 py-2.5"
						>
							<code className="text-xs font-mono font-medium text-primary min-w-[130px]">
								{skill.command}
							</code>
							<span className="text-xs text-muted-foreground flex-1">
								{skill.longDescription}
							</span>
							<CopyButton text={skill.command} />
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
