"use client";

import { BarChart3, Bot, Code, Megaphone, Search, User } from "lucide-react";
import { useMemo, useState } from "react";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useActivityLog, useDecisions } from "@/hooks/use-data";
import { showError, showSuccess } from "@/lib/toast";
import type { ActivityEvent, DecisionItem, EventType } from "@/lib/types";

type Actor = string;

type IconMap = Record<string, typeof User>;
type LabelMap = Record<string, string>;

const ACTOR_ICONS: IconMap = {
	me: User,
	researcher: Search,
	developer: Code,
	marketer: Megaphone,
	"business-analyst": BarChart3,
	system: Bot,
} as const;

const ACTOR_LABELS: LabelMap = {
	me: "Me",
	researcher: "Researcher",
	developer: "Developer",
	marketer: "Marketer",
	"business-analyst": "Business Analyst",
	system: "System",
} as const;

type EventMeta = { label: string; color: string };
type EventMetaMap = Record<string, EventMeta>;

const EVENT_META: EventMetaMap = {
	task_created: {
		label: "Task Created",
		color: "bg-sunshine-500/10 text-sunshine-700 border-sunshine-500/20",
	},
	task_updated: {
		label: "Task Updated",
		color: "bg-sunshine-700/10 text-sunshine-700 border-sunshine-700/20",
	},
	task_completed: {
		label: "Task Completed",
		color: "bg-success-soft text-success border-success/20",
	},
	task_delegated: {
		label: "Task Delegated",
		color: "bg-warning-soft text-warning border-warning/20",
	},
	task_failed: {
		label: "Task Failed",
		color: "bg-destructive-soft text-destructive border-destructive/20",
	},
	message_sent: {
		label: "Message Sent",
		color: "bg-sunshine-700/10 text-sunshine-700 border-sunshine-700/20",
	},
	decision_requested: {
		label: "Decision Requested",
		color: "bg-sunshine-700/10 text-sunshine-700 border-sunshine-700/20",
	},
	decision_answered: {
		label: "Decision Answered",
		color: "bg-success-soft text-success border-success/20",
	},
	brain_dump_triaged: {
		label: "Quick Capture Processed",
		color: "bg-sunshine-700/10 text-sunshine-700 border-sunshine-700/20",
	},
	milestone_completed: {
		label: "Milestone Completed",
		color: "bg-success-soft text-success border-success/20",
	},
	agent_checkin: {
		label: "Agent Check-in",
		color: "bg-sunshine-500/10 text-sunshine-700 border-sunshine-500/20",
	},
} as const;

const ALL_TYPES = Object.keys(EVENT_META) as EventType[];

function formatTime(iso: string): string {
	return new Date(iso).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
}

function dayKey(iso: string): string {
	return new Date(iso).toDateString();
}

function dayLabel(key: string): string {
	const today = new Date().toDateString();
	const yesterday = new Date(Date.now() - 86_400_000).toDateString();
	if (key === today) return "Today";
	if (key === yesterday) return "Yesterday";
	return new Date(key).toLocaleDateString([], {
		weekday: "long",
		month: "short",
		day: "numeric",
	});
}

function DecisionActions({
	decisionId,
	onAnswer,
}: {
	decisionId: string;
	onAnswer: () => void;
}) {
	const { decisions, refetch } = useDecisions();
	const [customAnswer, setCustomAnswer] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const decision = decisions.find((d) => d.id === decisionId);
	const isPending = decision?.status === "pending";

	const handleAnswer = async (answer: string) => {
		if (!decision || submitting) return;
		setSubmitting(true);
		try {
			const res = await fetch("/api/decisions", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: decision.id, answer }),
			});
			if (!res.ok) throw new Error("Failed to submit answer");
			showSuccess("Decision answered");
			onAnswer();
		} catch {
			showError("Failed to submit answer");
		} finally {
			setSubmitting(false);
		}
	};

	if (!decision) return null;
	if (!isPending) {
		return (
			<div className="mt-1.5 text-[10px] text-muted-foreground/60">
				Answered: <span className="text-foreground">{decision.answer}</span>
			</div>
		);
	}

	return (
		<div className="mt-1.5 flex flex-wrap items-center gap-1.5">
			{decision.options.map((opt) => (
				<Button
					key={opt}
					size="sm"
					variant="outline"
					className="h-6 text-[10px] px-2 py-0 font-normal"
					onClick={() => handleAnswer(opt)}
					disabled={submitting}
				>
					{opt}
				</Button>
			))}
			{decision.options.length > 0 && customAnswer && (
				<span className="text-[10px] text-muted-foreground">or</span>
			)}
			{decision.options.length > 0 && (
				<Input
					value={customAnswer}
					onChange={(e) => setCustomAnswer(e.target.value)}
					placeholder="Custom..."
					className="h-6 text-[10px] py-0 w-20"
					onKeyDown={(e) => {
						if (e.key === "Enter" && customAnswer.trim()) {
							handleAnswer(customAnswer.trim());
						}
					}}
					disabled={submitting}
				/>
			)}
			{decision.options.length === 0 && (
				<>
					<Input
						value={customAnswer}
						onChange={(e) => setCustomAnswer(e.target.value)}
						placeholder="Your answer..."
						className="h-6 text-[10px] py-0 w-28"
						onKeyDown={(e) => {
							if (e.key === "Enter" && customAnswer.trim()) {
								handleAnswer(customAnswer.trim());
							}
						}}
						disabled={submitting}
					/>
					<Button
						size="sm"
						variant="outline"
						className="h-6 text-[10px] px-2 py-0"
						onClick={() => {
							if (customAnswer.trim()) {
								handleAnswer(customAnswer.trim());
							}
						}}
						disabled={submitting || !customAnswer.trim()}
					>
						Send
					</Button>
				</>
			)}
		</div>
	);
}

function EventRow({
	event,
	onDecisionAnswered,
}: {
	event: ActivityEvent;
	onDecisionAnswered?: () => void;
}) {
	const meta = EVENT_META[event.type];
	const Icon = ACTOR_ICONS[event.actor] ?? Bot;
	const { decisions, refetch } = useDecisions();

	// For decision_requested events, find the matching decision by question text
	const decisionId =
		event.type === "decision_requested"
			? decisions.find((d) => event.summary.includes(d.question.slice(0, 40)))
					?.id
			: null;

	return (
		<div className="flex gap-3 py-2.5 px-3 rounded-sm hover:bg-accent/30 transition-colors">
			<div className="mt-0.5 shrink-0">
				<div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
					<Icon className="h-3.5 w-3.5 text-muted-foreground" />
				</div>
			</div>
			<div className="flex-1 min-w-0 space-y-1">
				<div className="flex items-center gap-2 flex-wrap">
					<span className="text-xs font-normal text-foreground">
						{ACTOR_LABELS[event.actor] ?? event.actor}
					</span>
					{meta && (
						<Badge
							variant="outline"
							className={`text-[10px] px-1.5 py-0 border ${meta.color}`}
						>
							{meta.label}
						</Badge>
					)}
					<span className="text-[11px] text-muted-foreground ml-auto tabular-nums shrink-0">
						{formatTime(event.timestamp)}
					</span>
				</div>
				<p className="text-xs text-muted-foreground leading-snug">
					{event.summary}
				</p>
				{event.details && (
					<p className="text-[11px] text-muted-foreground/70 leading-snug line-clamp-2">
						{event.details}
					</p>
				)}
				{decisionId && (
					<DecisionActions
						decisionId={decisionId}
						onAnswer={() => {
							refetch();
							onDecisionAnswered?.();
						}}
					/>
				)}
			</div>
		</div>
	);
}

function FeedSkeleton() {
	return (
		<div className="space-y-1">
			{Array.from({ length: 8 }).map((_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
				<div key={i} className="flex gap-3 py-2.5 px-3">
					<Skeleton className="h-7 w-7 rounded-full shrink-0" />
					<div className="flex-1 space-y-1.5">
						<div className="flex gap-2">
							<Skeleton className="h-3.5 w-20" />
							<Skeleton className="h-3.5 w-24" />
						</div>
						<Skeleton className="h-3 w-3/4" />
					</div>
				</div>
			))}
		</div>
	);
}

export default function ActivityPage() {
	const { events, loading, error, refetch } = useActivityLog();

	const [actorFilter, setActorFilter] = useState<Actor | "all">("all");
	const [typeFilter, setTypeFilter] = useState<EventType | "all">("all");
	const [search, setSearch] = useState("");

	const filtered = useMemo(() => {
		const q = search.toLowerCase().trim();
		return [...events]
			.sort(
				(a, b) =>
					new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
			)
			.filter((e) => {
				if (actorFilter !== "all" && e.actor !== actorFilter) return false;
				if (typeFilter !== "all" && e.type !== typeFilter) return false;
				if (
					q &&
					!e.summary.toLowerCase().includes(q) &&
					!e.details?.toLowerCase().includes(q)
				)
					return false;
				return true;
			});
	}, [events, actorFilter, typeFilter, search]);

	const grouped = useMemo(() => {
		const groups = new Map<string, ActivityEvent[]>();
		for (const e of filtered) {
			const key = dayKey(e.timestamp);
			const arr = groups.get(key) ?? [];
			arr.push(e);
			groups.set(key, arr);
		}
		return groups;
	}, [filtered]);

	const actors = useMemo(() => {
		return Array.from(new Set(events.map((e) => e.actor))).sort();
	}, [events]);

	return (
		<div className="space-y-4">
			<BreadcrumbNav items={[{ label: "Activity" }]} />

			<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
				<Input
					placeholder="Search activity..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="h-8 text-sm sm:max-w-xs"
				/>
				<div className="flex items-center gap-2 flex-wrap">
					<select
						value={actorFilter}
						onChange={(e) => setActorFilter(e.target.value as Actor | "all")}
						className="h-8 rounded-sm border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
					>
						<option value="all">All actors</option>
						{actors.map((a) => (
							<option key={a} value={a}>
								{ACTOR_LABELS[a] ?? a}
							</option>
						))}
					</select>
					<select
						value={typeFilter}
						onChange={(e) => setTypeFilter(e.target.value as EventType | "all")}
						className="h-8 rounded-sm border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
					>
						<option value="all">All types</option>
						{ALL_TYPES.map((t) => (
							<option key={t} value={t}>
								{EVENT_META[t]?.label ?? t}
							</option>
						))}
					</select>
					{(actorFilter !== "all" || typeFilter !== "all" || search) && (
						<Button
							size="sm"
							variant="ghost"
							className="h-8 text-xs text-muted-foreground"
							onClick={() => {
								setActorFilter("all");
								setTypeFilter("all");
								setSearch("");
							}}
						>
							Clear
						</Button>
					)}
				</div>
			</div>

			{error ? (
				<ErrorState message={error} onRetry={refetch} />
			) : loading ? (
				<Card>
					<CardContent className="p-2">
						<FeedSkeleton />
					</CardContent>
				</Card>
			) : filtered.length === 0 ? (
				<EmptyState
					icon={User}
					title="No activity"
					description={
						search || actorFilter !== "all" || typeFilter !== "all"
							? "No events match filters"
							: "No agent events recorded yet"
					}
					compact
				/>
			) : (
				<div className="space-y-4">
					{Array.from(grouped.entries()).map(([key, dayEvents]) => (
						<div key={key}>
							<div className="flex items-center gap-2 mb-1 px-1">
								<span className="text-xs font-normal text-muted-foreground">
									{dayLabel(key)}
								</span>
								<div className="flex-1 h-px bg-border/50" />
								<span className="text-[10px] text-muted-foreground tabular-nums">
									{dayEvents.length}
								</span>
							</div>
							<Card>
								<CardContent className="p-2 divide-y divide-border/30">
									{dayEvents.map((event) => (
										<EventRow
											key={event.id}
											event={event}
											onDecisionAnswered={refetch}
										/>
									))}
								</CardContent>
							</Card>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
