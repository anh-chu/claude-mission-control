"use client";

import { Check, ChevronDown, Plus, Settings2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "@/hooks/use-workspace";
import { cn } from "@/lib/utils";

const COLOR_SWATCHES = [
	{ label: "Orange", value: "#fa520f" },
	{ label: "Amber", value: "#ffa110" },
	{ label: "Gold", value: "#ffd900" },
	{ label: "Flame", value: "#fb6424" },
	{ label: "Sunshine", value: "#ffb83e" },
	{ label: "Black", value: "#1f1f1f" },
];

interface WorkspaceSwitcherProps {
	collapsed?: boolean;
}

export function WorkspaceSwitcher({
	collapsed = false,
}: WorkspaceSwitcherProps) {
	const {
		workspaces,
		currentWorkspace,
		currentId,
		loading,
		switchWorkspace,
		createWorkspace,
	} = useWorkspace();

	const [dialogOpen, setDialogOpen] = useState(false);
	const [newName, setNewName] = useState("");
	const [newColor, setNewColor] = useState(COLOR_SWATCHES[0].value);
	const [creating, setCreating] = useState(false);

	async function handleCreate() {
		if (!newName.trim()) return;
		setCreating(true);
		try {
			const ws = await createWorkspace(newName.trim(), newColor);
			setDialogOpen(false);
			setNewName("");
			setNewColor(COLOR_SWATCHES[0].value);
			switchWorkspace(ws.id);
		} catch {
			// error handled inside hook
		} finally {
			setCreating(false);
		}
	}

	if (loading) {
		return (
			<div
				className={cn(
					"mx-2 mb-1 flex items-center gap-2 rounded-sm px-3 py-2",
					collapsed && "justify-center px-2",
				)}
			>
				<div className="h-2.5 w-2.5 rounded-full bg-sidebar-foreground/20 shrink-0" />
				{!collapsed && (
					<div className="h-3 w-20 rounded-sm bg-muted" />
				)}
			</div>
		);
	}

	const display = currentWorkspace ?? {
		name: "Default",
		color: "#fa520f",
		id: "default",
	};

	return (
		<>
			<DropdownMenu>
				<div
					className={cn(
						"mx-2 mb-1 flex w-[calc(100%-1rem)] items-center rounded-sm text-sm text-sidebar-foreground",
						collapsed && "w-10 justify-center",
					)}
				>
					<DropdownMenuTrigger asChild>
						<button
							className={cn(
								"flex flex-1 items-center gap-2 rounded-sm px-3 py-2 transition-colors",
								"hover:bg-sidebar-accent/50",
								collapsed && "justify-center px-2",
							)}
						>
							<span
								className="h-2.5 w-2.5 rounded-full shrink-0"
								style={{ backgroundColor: display.color }}
							/>
							{!collapsed && (
								<>
									<span className="flex-1 truncate text-left font-normal text-xs">
										{display.name}
									</span>
									<ChevronDown className="h-3 w-3 shrink-0 text-sidebar-foreground/50" />
								</>
							)}
						</button>
					</DropdownMenuTrigger>
					{!collapsed && (
						<Link
							href="/settings"
							className="shrink-0 rounded-sm p-1.5 text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
							title="Settings"
						>
							<Settings2 className="h-3 w-3" />
						</Link>
					)}
				</div>

				<DropdownMenuContent side="right" align="start" className="w-52">
					{workspaces.map((ws) => (
						<DropdownMenuItem
							key={ws.id}
							onSelect={() => {
								if (ws.id !== currentId) switchWorkspace(ws.id);
							}}
							className="flex items-center gap-2"
						>
							<span
								className="h-2.5 w-2.5 rounded-full shrink-0"
								style={{ backgroundColor: ws.color }}
							/>
							<span className="flex-1 truncate">{ws.name}</span>
							{ws.id === currentId && (
								<Check className="h-3.5 w-3.5 text-primary" />
							)}
						</DropdownMenuItem>
					))}

					<DropdownMenuSeparator />

					<DropdownMenuItem
						onSelect={() => setDialogOpen(true)}
						className="gap-2"
					>
						<Plus className="h-3.5 w-3.5" />
						New Workspace
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
				<DialogContent className="sm:max-w-sm">
					<DialogHeader>
						<DialogTitle>New Workspace</DialogTitle>
					</DialogHeader>

					<div className="space-y-4 py-2">
						<div className="space-y-1.5">
							<Label htmlFor="ws-name">Name</Label>
							<Input
								id="ws-name"
								placeholder="e.g. Acme Corp"
								value={newName}
								onChange={(e) => setNewName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") void handleCreate();
								}}
							/>
						</div>

						<div className="space-y-1.5">
							<Label>Color</Label>
							<div className="flex gap-2 flex-wrap">
								{COLOR_SWATCHES.map((swatch) => (
									<button
										key={swatch.value}
										type="button"
										title={swatch.label}
										onClick={() => setNewColor(swatch.value)}
										className={cn(
											"h-6 w-6 rounded-full transition-all ring-offset-background",
											newColor === swatch.value
												? "ring-2 ring-ring ring-offset-2"
												: "hover:scale-110",
										)}
										style={{ backgroundColor: swatch.value }}
									/>
								))}
							</div>
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setDialogOpen(false)}>
							Cancel
						</Button>
						<Button
							onClick={() => void handleCreate()}
							disabled={!newName.trim() || creating}
						>
							{creating ? "Creating..." : "Create"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
