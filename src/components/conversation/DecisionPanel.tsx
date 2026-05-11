"use client";

import { HelpCircle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { showError, showSuccess } from "@/lib/toast";
import type { Conversation, DecisionItem } from "@/lib/types";

interface DecisionPanelProps {
	conversation: Conversation;
}

export function DecisionPanel({ conversation }: DecisionPanelProps) {
	const [decision, setDecision] = useState<DecisionItem | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [customAnswer, setCustomAnswer] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (!conversation.pausedDecisionId) return;

		setIsLoading(true);
		apiFetch("/api/decisions")
			.then((res) => res.json())
			.then((data) => {
				const found = data.decisions?.find(
					(d: DecisionItem) => d.id === conversation.pausedDecisionId,
				);
				if (found) setDecision(found);
			})
			.catch(console.error)
			.finally(() => setIsLoading(false));
	}, [conversation.pausedDecisionId]);

	if (isLoading) {
		return (
			<div className="flex items-center gap-2 p-4 text-sm text-muted-foreground border rounded-md m-4 bg-muted">
				<Loader2 className="h-4 w-4 animate-spin" />
				Loading decision...
			</div>
		);
	}

	if (!decision) {
		return null;
	}

	const handleAnswer = async (answer: string) => {
		if (!answer.trim()) return;
		setIsSubmitting(true);
		try {
			const res = await apiFetch("/api/decisions", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id: decision.id,
					status: "answered",
					answer: answer.trim(),
				}),
			});
			if (!res.ok) {
				throw new Error("Failed to answer decision");
			}
			showSuccess(`Decision answered: "${answer.trim()}"`);
			setCustomAnswer("");
		} catch {
			showError("Failed to answer decision");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="m-4 p-4 border rounded-md bg-warning-soft border-warning">
			<div className="flex items-center gap-2 mb-3">
				<HelpCircle className="h-5 w-5 text-amber-600" />
				<h3 className="text-sm font-medium text-amber-800 dark:text-amber-400">
					Decision Required
				</h3>
			</div>

			<div className="space-y-4">
				<div>
					<p className="text-sm">{decision.question}</p>
				</div>

				{decision.context && (
					<p className="text-xs text-muted-foreground bg-background/50 rounded-sm px-3 py-2">
						{decision.context}
					</p>
				)}

				{decision.options.length > 0 && (
					<div className="flex flex-wrap gap-2">
						{decision.options.map((opt, i) => (
							<Button
								key={i}
								variant="outline"
								size="sm"
								className="text-xs"
								disabled={isSubmitting}
								onClick={() => handleAnswer(opt)}
							>
								{opt}
							</Button>
						))}
					</div>
				)}

				<div className="flex items-center gap-2">
					<Input
						value={customAnswer}
						onChange={(e) => setCustomAnswer(e.target.value)}
						placeholder="Or type a custom answer..."
						className="h-8 text-xs flex-1 bg-background"
						disabled={isSubmitting}
						onKeyDown={(e) => {
							if (e.key === "Enter" && customAnswer.trim()) {
								handleAnswer(customAnswer);
							}
						}}
					/>
					<Button
						size="sm"
						className="h-8 text-xs"
						disabled={!customAnswer.trim() || isSubmitting}
						onClick={() => handleAnswer(customAnswer)}
					>
						Answer
					</Button>
				</div>
			</div>
		</div>
	);
}
