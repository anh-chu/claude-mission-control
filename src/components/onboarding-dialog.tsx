"use client";

import { Flag, Rocket, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

const STORAGE_KEY = "mc-onboarded";

// ─── Step types ─────────────────────────────────────────────────────────────

type StepType = "bullets" | "data-management" | "ready";

interface BaseStep {
	icon: typeof Rocket;
	title: string;
	description: string;
	type: StepType;
}

interface BulletsStep extends BaseStep {
	type: "bullets";
	bullets: string[];
}

interface SpecialStep extends BaseStep {
	type: "data-management" | "ready";
}

type Step = BulletsStep | SpecialStep;

const steps: Step[] = [
	{
		type: "bullets",
		icon: Rocket,
		title: "Welcome to Task Control",
		description:
			"Your AI-powered task orchestration hub. Organize work, delegate to agents, and automate execution with the daemon.",
		bullets: [
			"Prioritize with the Eisenhower Matrix (Do, Schedule, Delegate, Eliminate)",
			"Track progress with Kanban boards and goal milestones",
			"Delegate to specialized AI agents (Researcher, Developer, Marketer, etc.)",
			"Launch automation through the daemon for recurring work and scheduled execution",
		],
	},
	{
		type: "data-management",
		icon: Flag,
		title: "Your Data, Your Control",
		description:
			"Everything is stored locally as JSON files — no cloud, no accounts. You have full control over your data.",
	},
	{
		type: "ready",
		icon: Zap,
		title: "You're All Set!",
		description: "Task Control is ready. Here are some tips to get started.",
	},
];

// ─── Component ──────────────────────────────────────────────────────────────

export function OnboardingDialog() {
	const [open, setOpen] = useState(false);
	const [step, setStep] = useState(0);

	useEffect(() => {
		if (typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY)) {
			setOpen(true);
		}
	}, []);

	const handleClose = () => {
		setOpen(false);
		localStorage.setItem(STORAGE_KEY, "true");
	};

	const handleNext = () => {
		if (step < steps.length - 1) {
			setStep(step + 1);
		} else {
			handleClose();
		}
	};

	const current = steps[step];
	const Icon = current.icon;

	// ─── Render step-specific content ───────────────────────────────────────

	function renderStepContent() {
		switch (current.type) {
			case "bullets":
				return (
					<ul className="space-y-2 py-2">
						{(current as BulletsStep).bullets.map((bullet) => (
							<li
								key={bullet}
								className="flex items-start gap-2 text-sm text-muted-foreground"
							>
								<span className="text-primary mt-1 shrink-0">&bull;</span>
								<span>{bullet}</span>
							</li>
						))}
					</ul>
				);

			case "data-management":
				return (
					<ul className="space-y-2 py-2">
						<li className="flex items-start gap-2 text-sm text-muted-foreground">
							<span className="text-primary mt-1 shrink-0">&bull;</span>
							<span>
								Use{" "}
								<Link
									href="/settings"
									className="text-primary hover:underline"
									onClick={handleClose}
								>
									Settings &rarr; Backup &amp; Restore
								</Link>{" "}
								to save, restore, or export your workspace at any time
							</span>
						</li>
						<li className="flex items-start gap-2 text-sm text-muted-foreground">
							<span className="text-primary mt-1 shrink-0">&bull;</span>
							<span>
								Export your workspace as JSON for backup or portability
							</span>
						</li>
						<li className="flex items-start gap-2 text-sm text-muted-foreground">
							<span className="text-primary mt-1 shrink-0">&bull;</span>
							<span>
								All data files live in{" "}
								<code className="text-xs bg-muted px-1 py-0.5 rounded">
									~/.cmc/
								</code>
							</span>
						</li>
					</ul>
				);

			case "ready":
				return (
					<ul className="space-y-2 py-2">
						<li className="flex items-start gap-2 text-sm text-muted-foreground">
							<span className="text-primary mt-1 shrink-0">&bull;</span>
							<span>
								Press{" "}
								<kbd className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
									Ctrl+K
								</kbd>{" "}
								to open the command palette
							</span>
						</li>
						<li className="flex items-start gap-2 text-sm text-muted-foreground">
							<span className="text-primary mt-1 shrink-0">&bull;</span>
							<span>
								Press{" "}
								<kbd className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
									?
								</kbd>{" "}
								to see all keyboard shortcuts
							</span>
						</li>
						<li className="flex items-start gap-2 text-sm text-muted-foreground">
							<span className="text-primary mt-1 shrink-0">&bull;</span>
							<span>Ctrl+Click tasks to multi-select for bulk actions</span>
						</li>
					</ul>
				);
		}
	}

	const showFooterNav = true;

	return (
		<Dialog
			open={open}
			onOpenChange={(o) => {
				if (!o) handleClose();
			}}
		>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<div className="flex items-center gap-3">
						<div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
							<Icon className="h-5 w-5 text-primary" />
						</div>
						<div>
							<DialogTitle>{current.title}</DialogTitle>
							<DialogDescription className="mt-0.5">
								{current.description}
							</DialogDescription>
						</div>
					</div>
				</DialogHeader>

				{renderStepContent()}

				<div className="flex items-center justify-between pt-2 border-t">
					{/* Step indicators */}
					<div className="flex gap-1.5">
						{steps.map((_, i) => (
							<div
								key={i}
								className={`h-1.5 w-6 rounded-full transition-colors ${
									i === step
										? "bg-primary"
										: i < step
											? "bg-primary/40"
											: "bg-muted"
								}`}
							/>
						))}
					</div>

					{showFooterNav && (
						<div className="flex gap-2">
							<Button variant="ghost" size="sm" onClick={handleClose}>
								Skip
							</Button>
							<Button size="sm" onClick={handleNext}>
								{step < steps.length - 1 ? "Next" : "Get Started"}
							</Button>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
