"use client";

import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { GoalType, Project, Goal } from "@/lib/types";

interface CreateGoalDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	projects: Project[];
	goals: Goal[];
	onSubmit: (data: {
		title: string;
		type: GoalType;
		timeframe: string;
		projectId: string | null;
		parentGoalId: string | null;
	}) => void;
}

export function CreateGoalDialog({
	open,
	onOpenChange,
	onSubmit,
}: CreateGoalDialogProps) {
	const [title, setTitle] = useState("");
	const [timeframe, setTimeframe] = useState("");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!title.trim()) return;
		onSubmit({
			title: title.trim(),
			type: "long-term",
			timeframe,
			projectId: null,
			parentGoalId: null,
		});
		setTitle("");
		setTimeframe("");
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Create Objective</DialogTitle>
					<DialogDescription>
						Define a new long-term objective.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="goal-title">Title</Label>
						<Input
							id="goal-title"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Objective title"
							autoFocus
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="goal-timeframe">Timeframe</Label>
						<Input
							id="goal-timeframe"
							value={timeframe}
							onChange={(e) => setTimeframe(e.target.value)}
							placeholder="e.g., Q1 2026"
						/>
					</div>

					<div className="flex justify-end gap-2 pt-2">
						<Button
							type="button"
							variant="ghost"
							onClick={() => onOpenChange(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={!title.trim()}>
							Create Objective
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
