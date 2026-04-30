"use client";

import { TaskForm, type TaskFormData } from "@/components/task-form";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

interface CreateTaskDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSubmit: (data: TaskFormData) => void;
	defaultValues?: Partial<TaskFormData>;
}

export function CreateTaskDialog({
	open,
	onOpenChange,
	onSubmit,
	defaultValues,
}: CreateTaskDialogProps) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Create Task</DialogTitle>
					<DialogDescription>
						Add a new task to your workspace.
					</DialogDescription>
				</DialogHeader>
				<TaskForm
					initial={defaultValues}
					onSubmit={(data) => {
						onSubmit(data);
						onOpenChange(false);
					}}
					onCancel={() => onOpenChange(false)}
					submitLabel="Create Task"
				/>
			</DialogContent>
		</Dialog>
	);
}
