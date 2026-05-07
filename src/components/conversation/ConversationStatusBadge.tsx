import {
	AlertCircle,
	Ban,
	CheckCircle2,
	Clock,
	Loader2,
	XCircle,
} from "lucide-react";
import type { ConversationStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ConversationStatusBadgeProps {
	status: ConversationStatus;
	className?: string;
}

export function ConversationStatusBadge({
	status,
	className,
}: ConversationStatusBadgeProps) {
	let Icon = Clock;
	let label: string = status;
	let colorClass = "text-muted-foreground";

	switch (status) {
		case "idle":
		case "queued":
			Icon = Clock;
			colorClass = "text-muted-foreground";
			break;
		case "starting":
			Icon = Loader2;
			colorClass = "text-muted-foreground";
			break;
		case "running":
			Icon = Loader2;
			colorClass = "text-blue-500";
			break;
		case "awaiting-decision":
			Icon = AlertCircle;
			colorClass = "text-amber-500";
			label = "decision needed";
			break;
		case "completed":
			Icon = CheckCircle2;
			colorClass = "text-green-500";
			break;
		case "failed":
			Icon = XCircle;
			colorClass = "text-red-500";
			break;
		case "cancelled":
			Icon = Ban;
			colorClass = "text-muted-foreground";
			break;
	}

	const isSpinning = status === "starting" || status === "running";

	return (
		<div
			className={cn(
				"inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-background capitalize",
				colorClass,
				className,
			)}
		>
			<Icon className={cn("h-3 w-3", isSpinning && "animate-spin")} />
			{label}
		</div>
	);
}
