"use client";

import {
	BarChart3,
	Bot,
	CheckCircle2,
	Code,
	HelpCircle,
	Megaphone,
	Search,
	User,
} from "lucide-react";
import { useState } from "react";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { CardSkeleton, GridSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useDecisions, useTasks } from "@/hooks/use-data";
import type { DecisionItem } from "@/lib/types";
import { AGENT_ROLES } from "@/lib/types";

const agentIcons: Record<string, typeof User> = {
	me: User,
	researcher: Search,
	developer: Code,
	marketer: Megaphone,
	"business-analyst": BarChart3,
	system: Bot,
};

export default function DecisionsPage() {
	const {
		decisions,
		loading,
		update: updateDecision,
		error: decisionsError,
		refetch,
	} = useDecisions();
	const { tasks } = useTasks();
	const [customAnswers, setCustomAnswers] = useState<Record<string, string>>(
		{},
	);

	const pending = decisions.filter((d) => d.status === "pending");
	const answered = decisions.filter((d) => d.status === "answered");

	const handleAnswer = async (dec: DecisionItem, answer: string) => {
		await updateDecision(dec.id, {
			status: "answered" as const,
			answer,
		});
	};

	const formatDate = (iso: string) => {
		const d = new Date(iso);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffHrs = diffMs / (1000 * 60 * 60);
		if (diffMs < 60000) return "just now";
		if (diffHrs < 1) return `${Math.round(diffMs / 60000)}m ago`;
		if (diffHrs < 24) return `${Math.round(diffHrs)}h ago`;
		return d.toLocaleDateString(undefined, {
			month: "short",
			day: "numeric",
			hour: "numeric",
			minute: "2-digit",
		});
	};

	if (loading) {
		return (
			<div className="space-y-6">
				<BreadcrumbNav items={[{ label: "Decisions" }]} />
				<GridSkeleton
					className="space-y-3"
					count={2}
					renderItem={() => (
						<CardSkeleton
							className="p-4 space-y-3"
							lines={[
								{ key: "title", className: "h-5 w-3/4" },
								{ key: "line-1", className: "h-3 w-full" },
								{ key: "line-2", className: "h-3 w-2/3" },
							]}
							footer={[
								{ key: "approve", className: "h-8 w-24 rounded-md" },
								{ key: "reject", className: "h-8 w-24 rounded-md" },
							]}
							footerClassName="flex gap-2 pt-1"
						/>
					)}
				/>
			</div>
		);
	}

	if (decisionsError) {
		return (
			<div className="space-y-6">
				<BreadcrumbNav items={[{ label: "Decisions" }]} />
				<ErrorState message={decisionsError} onRetry={refetch} />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<BreadcrumbNav items={[{ label: "Decisions" }]} />

			<h1 className="text-xl font-bold flex items-center gap-2">
				<HelpCircle className="h-5 w-5" />
				Decision Queue
				{pending.length > 0 && (
					<Badge variant="destructive" className="ml-2">
						{pending.length} pending
					</Badge>
				)}
			</h1>

			{/* Pending Decisions */}
			{pending.length > 0 && (
				<section className="space-y-3">
					<h2 className="text-sm font-semibold text-yellow-400 flex items-center gap-2">
						<HelpCircle className="h-3.5 w-3.5" />
						Needs Your Input ({pending.length})
					</h2>
					<div className="space-y-3">
						{pending.map((dec) => {
							const RequestorIcon = agentIcons[dec.requestedBy] ?? User;
							const requestorLabel =
								dec.requestedBy === "system"
									? "System"
									: (AGENT_ROLES.find((r) => r.id === dec.requestedBy)?.label ??
										dec.requestedBy);
							const linkedTask = dec.taskId
								? tasks.find((t) => t.id === dec.taskId)
								: null;

							return (
								<Card
									key={dec.id}
									className="border-yellow-500/30 bg-yellow-500/5"
								>
									<CardContent className="p-4 space-y-3">
										<div className="flex items-start gap-3">
											<div className="h-8 w-8 rounded-lg bg-yellow-500/20 flex items-center justify-center shrink-0">
												<RequestorIcon className="h-4 w-4 text-yellow-400" />
											</div>
											<div className="flex-1">
												<p className="text-sm font-semibold">{dec.question}</p>
												<div className="flex items-center gap-2 mt-1">
													<span className="text-xs text-muted-foreground">
														Asked by {requestorLabel}
													</span>
													<span className="text-xs text-muted-foreground">
														{formatDate(dec.createdAt)}
													</span>
												</div>
											</div>
										</div>

										{dec.context && (
											<p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
												{dec.context}
											</p>
										)}

										{linkedTask && (
											<p className="text-xs text-muted-foreground">
												Related:{" "}
												<span className="text-foreground">
													{linkedTask.title}
												</span>
											</p>
										)}

										{/* Option buttons */}
										{dec.options.length > 0 && (
											<div className="flex flex-wrap gap-2">
												{dec.options.map((opt) => (
													<Button
														key={opt}
														variant="outline"
														size="sm"
														className="text-xs"
														onClick={() => handleAnswer(dec, opt)}
													>
														{opt}
													</Button>
												))}
											</div>
										)}

										{/* Custom answer */}
										<div className="flex items-center gap-2">
											<Input
												value={customAnswers[dec.id] ?? ""}
												onChange={(e) =>
													setCustomAnswers((prev) => ({
														...prev,
														[dec.id]: e.target.value,
													}))
												}
												placeholder="Or type a custom answer..."
												className="h-8 text-xs flex-1"
											/>
											<Button
												size="sm"
												className="h-8 text-xs"
												disabled={!customAnswers[dec.id]?.trim()}
												onClick={() => {
													const answer = customAnswers[dec.id]?.trim();
													if (!answer) return;
													handleAnswer(dec, answer);
													setCustomAnswers((prev) => ({
														...prev,
														[dec.id]: "",
													}));
												}}
											>
												Answer
											</Button>
										</div>
									</CardContent>
								</Card>
							);
						})}
					</div>
				</section>
			)}

			{pending.length === 0 && (
				<EmptyState
					icon={HelpCircle}
					title="No pending decisions"
					description="When your AI agents need your input, their questions will appear here."
				/>
			)}

			{/* Answered Decisions */}
			{answered.length > 0 && (
				<section className="space-y-3">
					<h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
						<CheckCircle2 className="h-3.5 w-3.5" />
						Answered ({answered.length})
					</h2>
					<div className="space-y-2">
						{answered.map((dec) => {
							const requestorLabel =
								dec.requestedBy === "system"
									? "System"
									: (AGENT_ROLES.find((r) => r.id === dec.requestedBy)?.label ??
										dec.requestedBy);
							return (
								<Card key={dec.id} className="bg-card/30 opacity-60">
									<CardContent className="p-3">
										<div className="flex items-center gap-3">
											<CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
											<div className="flex-1 min-w-0">
												<p className="text-sm truncate">{dec.question}</p>
												<p className="text-xs text-muted-foreground">
													{requestorLabel} asked · Answered:{" "}
													<span className="text-foreground">{dec.answer}</span>
													{dec.answeredAt && ` · ${formatDate(dec.answeredAt)}`}
												</p>
											</div>
										</div>
									</CardContent>
								</Card>
							);
						})}
					</div>
				</section>
			)}
		</div>
	);
}
