"use client";

import {
	Check,
	ChevronDown,
	FileText,
	Grid2x2,
	LayoutDashboard,
	Plus,
	Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

interface NavItem {
	href: string;
	label: string;
	icon: typeof LayoutDashboard;
	match?: string[];
}

const navItems: NavItem[] = [
	{ href: "/", label: "Dashboard", icon: LayoutDashboard },
	{
		href: "/priority-matrix",
		label: "Work",
		icon: Grid2x2,
		match: ["/priority-matrix", "/map", "/tasks"],
	},
	{ href: "/documents", label: "Wiki", icon: FileText },
	{
		href: "/crew",
		label: "Agents",
		icon: Users,
		match: ["/crew", "/skills", "/autopilot"],
	},
];

function isItemActive(item: NavItem, pathname: string): boolean {
	const paths = item.match ?? [item.href];
	return paths.some(
		(p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`)),
	);
}

function WorkspaceSwitcherCompact() {
	const {
		workspaces,
		currentWorkspace,
		currentId,
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

	const display = currentWorkspace ?? {
		name: "Default",
		color: "#fa520f",
		id: "default",
	};

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button
						className={cn(
							"flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-all duration-200",
							"text-muted-foreground hover:bg-accent/60 hover:text-accent-foreground",
						)}
					>
						<span
							className="h-3 w-3 rounded-full shrink-0 ring-1 ring-border"
							style={{ backgroundColor: display.color }}
						/>
						<span className="truncate max-w-[100px]">{display.name}</span>
						<ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" className="w-52">
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
											"h-6 w-6 rounded-full transition-all",
											newColor === swatch.value
												? "ring-2 ring-ring"
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

export function TopNav() {
	const pathname = usePathname();

	return (
		<nav aria-label="Primary" className="flex items-center gap-0.5">
			<WorkspaceSwitcherCompact />
			{navItems.map(({ href, label, icon: Icon }) => {
				const active = isItemActive({ href, label, icon: Icon }, pathname);
				return (
					<Link
						key={href}
						href={href}
						className={cn(
							"group flex items-center gap-0 rounded-md px-2 py-1.5 text-sm font-medium transition-all duration-200",
							"hover:bg-accent/60 hover:text-accent-foreground",
							active
								? "bg-accent text-accent-foreground"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						<Icon className="h-4 w-4 shrink-0" />
						<span
							className={cn(
								"overflow-hidden whitespace-nowrap",
								active
									? "max-w-[80px] ml-1.5 opacity-100 transition-all duration-200"
									: "max-w-0 opacity-0 ml-0 transition-all duration-200 group-hover:max-w-[80px] group-hover:ml-1.5 group-hover:opacity-100 group-hover:transition-all group-hover:duration-200 group-hover:delay-200",
							)}
						>
							{label}
						</span>
					</Link>
				);
			})}
		</nav>
	);
}
