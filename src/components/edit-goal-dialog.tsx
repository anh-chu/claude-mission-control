"use client";

import { useState, useEffect } from "react";
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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import type { GoalType, GoalStatus, Project, Goal } from "@/lib/types";

interface EditGoalDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	goal: Goal;
	projects: Project[];
	goals: Goal[];
	onSubmit: (data: {
		title: string;
		type: GoalType;
		timeframe: string;
		status: GoalStatus;
		projectId: string | null;
		parentGoalId: string | null;
	}) => void;
}

export function EditGoalDialog({
	open,
	onOpenChange,
	goal,
	onSubmit,
}: EditGoalDialogProps) {
	const [title, setTitle] = useState(goal.title);
	const [timeframe, setTimeframe] = useState(goal.timeframe);
	const [status, setStatus] = useState<GoalStatus>(goal.status);

	// Reset form when goal changes
	useEffect(() => {
		setTitle(goal.title);
		setTimeframe(goal.timeframe);
		setStatus(goal.status);
	}, [goal]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!title.trim()) return;
		onSubmit({
			title: title.trim(),
			type: "long-term",
			timeframe,
			status,
			projectId: goal.projectId,
			parentGoalId: null,
		});
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle>Edit Objective</DialogTitle>
					<DialogDescription>
						Update objective details and status.
					</DialogDescription>
				</DialogHeader>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="edit-goal-title">Title</Label>
						<Input
							id="edit-goal-title"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Objective title"
							autoFocus
						/>
					</div>

					<div className="grid grid-cols-2 gap-3">
						<div className="space-y-2">
							<Label htmlFor="edit-goal-timeframe">Timeframe</Label>
							<Input
								id="edit-goal-timeframe"
								value={timeframe}
								onChange={(e) => setTimeframe(e.target.value)}
								placeholder="e.g., Q1 2026"
							/>
						</div>
						<div className="space-y-2">
							<Label>Status</Label>
							<Select
								value={status}
								onValueChange={(v) => setStatus(v as GoalStatus)}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="not-started">Not Started</SelectItem>
									<SelectItem value="in-progress">In Progress</SelectItem>
									<SelectItem value="completed">Completed</SelectItem>
								</SelectContent>
							</Select>
						</div>
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
							Save Changes
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
