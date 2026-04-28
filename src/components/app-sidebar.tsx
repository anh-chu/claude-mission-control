"use client";

import {
	Activity,
	FileText,
	FolderKanban,
	Grid2x2,
	Layers,
	LayoutDashboard,
	Lightbulb,
	Terminal,
	User,
	Users,
	X,
	Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarFooter } from "@/components/sidebar-footer";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import { cn } from "@/lib/utils";

const mainLinks = [
	{ href: "/", label: "Dashboard", icon: LayoutDashboard },
	{ href: "/brain-dump", label: "Quick Capture", icon: Lightbulb },
	{ href: "/autopilot", label: "Automation", icon: Zap },
];

const workbenchLinks = [
	{ href: "/projects", label: "Projects", icon: FolderKanban },
	{ href: "/initiatives", label: "Initiatives", icon: Layers },
	{ href: "/priority-matrix", label: "Tasks", icon: Grid2x2 },
	{ href: "/crew", label: "Agents", icon: Users },
	{ href: "/documents", label: "Documents", icon: FileText },
];

const utilityLinks = [
	{ href: "/settings", label: "Settings", icon: User },
	{ href: "/logs", label: "Debug Logs", icon: Terminal },
	{ href: "/activity", label: "Activity", icon: Activity },
];

interface NavLinkProps {
	href: string;
	label: string;
	icon: typeof User;
	isActive: boolean;
	collapsed: boolean;
	onClick?: () => void;
	size?: "default" | "small";
	badge?: React.ReactNode;
	badgeDot?: string;
	tooltipSuffix?: string;
	tooltipContent?: React.ReactNode;
}

function NavLink({
	href,
	label,
	icon: Icon,
	isActive,
	collapsed,
	onClick,
	size = "default",
	badge,
	badgeDot,
	tooltipSuffix,
	tooltipContent,
}: NavLinkProps) {
	const isSmall = size === "small";
	const link = (
		<Link
			href={href}
			onClick={onClick}
			className={cn(
				"flex items-center gap-3 rounded-sm transition-colors",
				isSmall ? "px-3 py-1.5 text-sm" : "px-3 py-2 text-sm font-normal",
				collapsed && "justify-center px-2",
				isActive
					? "bg-sidebar-accent text-sidebar-accent-foreground"
					: isSmall
						? "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
						: "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
			)}
		>
			<Icon className={cn("shrink-0", isSmall ? "h-3.5 w-3.5" : "h-4 w-4")} />
			{!collapsed && (
				<>
					<span className={cn("flex-1", isSmall && "truncate text-xs")}>
						{label}
					</span>
					{badge}
				</>
			)}
		</Link>
	);

	if (collapsed) {
		return (
			<Tooltip>
				<TooltipTrigger asChild>
					<div className="relative">
						{link}
						{badgeDot && (
							<span
								className={cn(
									"absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full",
									badgeDot,
								)}
							/>
						)}
					</div>
				</TooltipTrigger>
				<TooltipContent side="right">
					{tooltipContent ?? (
						<>
							{label}
							{tooltipSuffix}
						</>
					)}
				</TooltipContent>
			</Tooltip>
		);
	}
	return link;
}

interface AppSidebarProps {
	collapsed: boolean;
	isMobile?: boolean;
	onClose?: () => void;
}

export function AppSidebar({
	collapsed,
	isMobile = false,
	onClose,
}: AppSidebarProps) {
	const pathname = usePathname();

	if (isMobile) {
		return (
			<TooltipProvider delayDuration={0}>
				<aside
					className={cn(
						"fixed left-0 top-0 z-50 flex h-full w-72 flex-col bg-sidebar-background shadow-golden transition-transform duration-200",
						collapsed ? "-translate-x-full" : "translate-x-0",
					)}
				>
					<div className="flex h-14 flex-col border-b">
						<div className="flex h-14 items-center justify-between px-4">
							<span className="text-sm font-normal">Mandio</span>
							<Button
								variant="ghost"
								size="icon"
								onClick={onClose}
								className="shrink-0"
								aria-label="Close sidebar"
							>
								<X className="h-5 w-5" />
							</Button>
						</div>
						<div className="flex h-1.5 w-full">
							<div className="flex-1 bg-[#ffd900]" />
							<div className="flex-1 bg-[#ffe295]" />
							<div className="flex-1 bg-[#ffa110]" />
							<div className="flex-1 bg-[#ff8105]" />
							<div className="flex-1 bg-[#fb6424]" />
							<div className="flex-1 bg-[#fa520f]" />
						</div>
					</div>

					<ScrollArea className="flex-1">
						<div className="pt-2">
							<WorkspaceSwitcher collapsed={false} />
						</div>
						<nav className="space-y-0.5 p-2">
							{mainLinks.map(({ href, label, icon: Icon }) => {
								const isActive =
									pathname === href ||
									(href !== "/" && pathname.startsWith(href));
								return (
									<Link
										key={href}
										href={href}
										onClick={onClose}
										className={cn(
											"flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-normal transition-colors",
											isActive
												? "bg-sidebar-accent text-sidebar-accent-foreground"
												: "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
										)}
									>
										<Icon className="h-4 w-4 shrink-0" />
										<span>{label}</span>
									</Link>
								);
							})}
						</nav>

						<Separator className="mx-2 my-2" />
						<div className="px-3 pb-1">
							<p className="text-xs font-normal uppercase tracking-wider text-sidebar-foreground/50">
								Workbench
							</p>
							<p className="text-[10px] text-sidebar-foreground/30 mt-0.5">
								Work, projects, and agents
							</p>
						</div>
						<nav className="space-y-0.5 px-2">
							{workbenchLinks.map(({ href, label, icon: Icon }) => {
								const isActive =
									pathname === href || pathname.startsWith(`${href}/`);
								return (
									<Link
										key={href}
										href={href}
										onClick={onClose}
										className={cn(
											"flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-normal transition-colors",
											isActive
												? "bg-sidebar-accent text-sidebar-accent-foreground"
												: "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
										)}
									>
										<Icon className="h-4 w-4 shrink-0" />
										<span>{label}</span>
									</Link>
								);
							})}
						</nav>

						<Separator className="mx-2 my-2" />
						<div className="px-3 pb-1">
							<p className="text-xs font-normal uppercase tracking-wider text-sidebar-foreground/50">
								Utilities
							</p>
						</div>
						<nav className="space-y-0.5 px-2">
							{utilityLinks.map(({ href, label, icon: Icon }) => {
								const isActive =
									pathname === href || pathname.startsWith(`${href}/`);
								return (
									<Link
										key={href}
										href={href}
										onClick={onClose}
										className={cn(
											"flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-normal transition-colors",
											isActive
												? "bg-sidebar-accent text-sidebar-accent-foreground"
												: "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
										)}
									>
										<Icon className="h-4 w-4 shrink-0" />
										<span>{label}</span>
									</Link>
								);
							})}
						</nav>
					</ScrollArea>

					<SidebarFooter collapsed={false} />
				</aside>
			</TooltipProvider>
		);
	}

	return (
		<TooltipProvider delayDuration={0}>
			<aside
				className={cn(
					"fixed left-0 top-14 z-30 flex h-[calc(100vh-3.5rem)] flex-col border-r bg-sidebar-background transition-all duration-200",
					collapsed ? "w-14" : "w-56",
				)}
			>
				<ScrollArea className="flex-1">
					<div className="pt-2">
						<WorkspaceSwitcher collapsed={collapsed} />
					</div>
					<nav className="space-y-0.5 p-2">
						{mainLinks.map(({ href, label, icon }) => (
							<NavLink
								key={href}
								href={href}
								label={label}
								icon={icon}
								isActive={
									pathname === href ||
									(href !== "/" && pathname.startsWith(href))
								}
								collapsed={collapsed}
							/>
						))}
					</nav>

					<Separator className="mx-2 my-2" />
					{!collapsed && (
						<div className="px-3 pb-1">
							<p className="text-xs font-normal uppercase tracking-wider text-sidebar-foreground/50">
								Workbench
							</p>
							<p className="text-[10px] text-sidebar-foreground/30 mt-0.5">
								Work, projects, and agents
							</p>
						</div>
					)}
					<nav className="space-y-0.5 px-2">
						{workbenchLinks.map(({ href, label, icon }) => (
							<NavLink
								key={href}
								href={href}
								label={label}
								icon={icon}
								isActive={pathname === href || pathname.startsWith(`${href}/`)}
								collapsed={collapsed}
							/>
						))}
					</nav>

					<Separator className="mx-2 my-2" />
					{!collapsed && (
						<div className="px-3 pb-1">
							<p className="text-xs font-normal uppercase tracking-wider text-sidebar-foreground/50">
								Utilities
							</p>
						</div>
					)}
					<nav className="space-y-0.5 px-2">
						{utilityLinks.map(({ href, label, icon }) => (
							<NavLink
								key={href}
								href={href}
								label={label}
								icon={icon}
								isActive={pathname === href || pathname.startsWith(`${href}/`)}
								collapsed={collapsed}
							/>
						))}
					</nav>
				</ScrollArea>

				<SidebarFooter collapsed={collapsed} />
			</aside>
		</TooltipProvider>
	);
}
