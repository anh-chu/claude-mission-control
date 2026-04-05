"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Grid2x2,
  Crosshair,
  Lightbulb,
  Rocket,
  Bot,
  Search,
  Code,
  Megaphone,
  BarChart3,
  User,
  Inbox,
  Activity,
  HelpCircle,
  X,
  Users,
  BookOpen,
  Zap,
  Shield,
  Wrench,
  Globe,
  Brain,
  Palette,
  HeartPulse,
  Flag,
  Radio,
  Lock,
  KeyRound,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SidebarFooter } from "@/components/sidebar-footer";
import type { AgentDefinition } from "@/lib/types";

const mainLinks = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ventures", label: "Projects", icon: Sparkles },
  { href: "/brain-dump", label: "Quick Capture", icon: Lightbulb },
  { href: "/checkpoints", label: "Checkpoints", icon: Flag },
  { href: "/autopilot", label: "Automation", icon: Zap },
  { href: "/guide", label: "Guide", icon: BookOpen },
];

const workbenchLinks = [
  { href: "/objectives", label: "Objectives", icon: Crosshair },
  { href: "/field-ops/missions", label: "Initiatives", icon: Rocket },
  { href: "/priority-matrix", label: "Tasks", icon: Grid2x2 },
];

const commsLinks = [
  { href: "/inbox", label: "Inbox", icon: Inbox, badgeKey: "unreadInbox" as const },
  { href: "/activity", label: "Activity", icon: Activity, badgeKey: null },
  { href: "/decisions", label: "Decisions", icon: HelpCircle, badgeKey: "pendingDecisions" as const },
];

const fieldOpsLinks = [
  { href: "/field-ops", label: "Dashboard", icon: Radio },
  { href: "/field-ops/services", label: "Services", icon: Globe },
  { href: "/field-ops/vault", label: "Vault", icon: Lock },
  { href: "/field-ops/safety", label: "Safety", icon: Shield },
  { href: "/field-ops/activity", label: "Activity", icon: KeyRound },
];

// Dynamic icon lookup by name
const iconMap: Record<string, typeof User> = {
  User, Search, Code, Megaphone, BarChart3, Bot, Zap,
  Shield, Wrench, BookOpen, Globe, Brain, Palette, HeartPulse,
};

function getAgentIcon(iconName: string) {
  return iconMap[iconName] ?? Bot;
}

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
        "flex items-center gap-3 rounded-lg transition-colors",
        isSmall ? "px-3 py-1.5 text-sm" : "px-3 py-2 text-sm font-medium",
        collapsed && "justify-center px-2",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : isSmall
          ? "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className={cn("shrink-0", isSmall ? "h-3.5 w-3.5" : "h-4 w-4")} />
      {!collapsed && (
        <>
          <span className={cn("flex-1", isSmall && "truncate text-xs")}>{label}</span>
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
            {badgeDot && <span className={cn("absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full", badgeDot)} />}
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          {tooltipContent ?? (
            <>{label}{tooltipSuffix}</>
          )}
        </TooltipContent>
      </Tooltip>
    );
  }
  return link;
}

interface AppSidebarProps {
  collapsed: boolean;
  unreadInbox?: number;
  pendingDecisions?: number;
  pendingFieldApprovals?: number;
  isMobile?: boolean;
  onClose?: () => void;
  agents?: AgentDefinition[];
}

export function AppSidebar({ collapsed, unreadInbox = 0, pendingDecisions = 0, pendingFieldApprovals = 0, isMobile = false, onClose, agents = [] }: AppSidebarProps) {
  const pathname = usePathname();
  const badges = { unreadInbox, pendingDecisions };

  const activeAgents = agents.filter((a) => a.status === "active");

  // On mobile: render as full-height overlay drawer (always expanded)
  if (isMobile) {
    return (
      <TooltipProvider delayDuration={0}>
        <aside
          className={cn(
            "fixed left-0 top-0 z-50 flex h-full w-72 flex-col bg-sidebar-background shadow-2xl transition-transform duration-200",
            collapsed ? "-translate-x-full" : "translate-x-0"
          )}
        >
          {/* Mobile close button */}
          <div className="flex h-14 items-center justify-between border-b px-4">
            <span className="text-sm font-semibold">Task Control</span>
            <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0" aria-label="Close sidebar">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <ScrollArea className="flex-1">
            {/* Main Navigation */}
            <nav className="space-y-0.5 p-2">
              {mainLinks.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Workbench */}
            <Separator className="mx-2 my-2" />
            <div className="px-3 pb-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                Workbench
              </p>
              <p className="text-[10px] text-sidebar-foreground/30 mt-0.5">Objectives, initiatives, and tasks</p>
            </div>
            <nav className="space-y-0.5 px-2">
              {workbenchLinks.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Integrations */}
            <Separator className="mx-2 my-2" />
            <div className="px-3 pb-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                Integrations
              </p>
              <p className="text-[10px] text-sidebar-foreground/30 mt-0.5">External services, approvals, and safety</p>
            </div>
            <nav className="space-y-0.5 px-2">
              {fieldOpsLinks.map(({ href, label, icon: Icon }) => {
                const isActive = pathname === href || (href !== "/field-ops" && pathname.startsWith(href));
                const showFieldBadge = href === "/field-ops" && pendingFieldApprovals > 0;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{label}</span>
                    {showFieldBadge && (
                      <Badge className="h-5 min-w-5 justify-center px-1.5 text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                        {pendingFieldApprovals}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Messages */}
            <Separator className="mx-2 my-2" />
            <div className="px-3 pb-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                Messages
              </p>
              <p className="text-[10px] text-sidebar-foreground/30 mt-0.5">Agent reports, decisions, and activity</p>
            </div>
            <nav className="space-y-0.5 px-2">
              {commsLinks.map(({ href, label, icon: Icon, badgeKey }) => {
                const isActive = pathname === href || pathname.startsWith(href + "/");
                const count = badgeKey ? badges[badgeKey] : 0;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">{label}</span>
                    {count > 0 && (
                      <Badge variant="destructive" className="h-5 min-w-5 justify-center px-1.5 text-xs">
                        {count}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Agents */}
            <Separator className="mx-2 my-2" />
            <div className="px-3 pb-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                Agents
              </p>
              <p className="text-[10px] text-sidebar-foreground/30 mt-0.5">Your team of AI workers and their skills</p>
            </div>
            <div className="space-y-0.5 px-2">
              {/* Crew overview link */}
              <Link
                href="/crew"
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors",
                  pathname === "/crew" || pathname.startsWith("/crew/")
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                <Users className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate text-xs font-medium">All Agents</span>
              </Link>
              {/* Dynamic agent list */}
              {activeAgents.map((agent) => {
                const Icon = getAgentIcon(agent.icon);
                const isActive = pathname === `/team/${agent.id}`;
                return (
                  <Link
                    key={agent.id}
                    href={`/team/${agent.id}`}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate text-xs">{agent.name}</span>
                  </Link>
                );
              })}
              {/* Skills library link */}
              <Link
                href="/skills"
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm transition-colors",
                  pathname === "/skills" || pathname.startsWith("/skills/")
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                <BookOpen className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate text-xs font-medium">Skills Library</span>
              </Link>
            </div>

          </ScrollArea>

          {/* Footer */}
          <SidebarFooter collapsed={false} />
        </aside>
      </TooltipProvider>
    );
  }

  // Desktop: collapsible sidebar
  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "fixed left-0 top-14 z-30 flex h-[calc(100vh-3.5rem)] flex-col border-r bg-sidebar-background transition-all duration-200",
          collapsed ? "w-14" : "w-56"
        )}
      >
        <ScrollArea className="flex-1">
          <nav className="space-y-0.5 p-2">
            {mainLinks.map(({ href, label, icon }) => (
              <NavLink
                key={href}
                href={href}
                label={label}
                icon={icon}
                isActive={pathname === href || (href !== "/" && pathname.startsWith(href))}
                collapsed={collapsed}
              />
            ))}
          </nav>

          <Separator className="mx-2 my-2" />
          {!collapsed && (
            <div className="px-3 pb-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">Workbench</p>
              <p className="text-[10px] text-sidebar-foreground/30 mt-0.5">Objectives, initiatives, and tasks</p>
            </div>
          )}
          <nav className="space-y-0.5 px-2">
            {workbenchLinks.map(({ href, label, icon }) => (
              <NavLink
                key={href}
                href={href}
                label={label}
                icon={icon}
                isActive={pathname === href || pathname.startsWith(href + "/")}
                collapsed={collapsed}
              />
            ))}
          </nav>

          <Separator className="mx-2 my-2" />
          {!collapsed && (
            <div className="px-3 pb-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">Integrations</p>
              <p className="text-[10px] text-sidebar-foreground/30 mt-0.5">External services, approvals, and safety</p>
            </div>
          )}
          <nav className="space-y-0.5 px-2">
            {fieldOpsLinks.map(({ href, label, icon }) => {
              const showBadge = href === "/field-ops" && pendingFieldApprovals > 0;
              return (
                <NavLink
                  key={href}
                  href={href}
                  label={label}
                  icon={icon}
                  isActive={pathname === href || (href !== "/field-ops" && pathname.startsWith(href))}
                  collapsed={collapsed}
                  badge={showBadge ? (
                    <Badge className="h-5 min-w-5 justify-center px-1.5 text-xs bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                      {pendingFieldApprovals}
                    </Badge>
                  ) : undefined}
                  badgeDot={showBadge ? "bg-emerald-500" : undefined}
                  tooltipSuffix={showBadge ? ` (${pendingFieldApprovals} pending)` : undefined}
                />
              );
            })}
          </nav>

          <Separator className="mx-2 my-2" />
          {!collapsed && (
            <div className="px-3 pb-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">Messages</p>
              <p className="text-[10px] text-sidebar-foreground/30 mt-0.5">Agent reports, decisions, and activity</p>
            </div>
          )}
          <nav className="space-y-0.5 px-2">
            {commsLinks.map(({ href, label, icon, badgeKey }) => {
              const count = badgeKey ? badges[badgeKey] : 0;
              return (
                <NavLink
                  key={href}
                  href={href}
                  label={label}
                  icon={icon}
                  isActive={pathname === href || pathname.startsWith(href + "/")}
                  collapsed={collapsed}
                  badge={count > 0 ? (
                    <Badge variant="destructive" className="h-5 min-w-5 justify-center px-1.5 text-xs">
                      {count}
                    </Badge>
                  ) : undefined}
                  badgeDot={count > 0 ? "bg-destructive" : undefined}
                  tooltipSuffix={count > 0 ? ` (${count})` : undefined}
                />
              );
            })}
          </nav>

          <Separator className="mx-2 my-2" />
          {!collapsed && (
            <div className="px-3 pb-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/50">Agents</p>
              <p className="text-[10px] text-sidebar-foreground/30 mt-0.5">Your team of AI workers and their skills</p>
            </div>
          )}
          <div className="space-y-0.5 px-2">
            <NavLink
              href="/crew"
              label="All Agents"
              icon={Users}
              isActive={pathname === "/crew" || pathname.startsWith("/crew/")}
              collapsed={collapsed}
              size="small"
            />
            {activeAgents.map((agent) => (
              <NavLink
                key={agent.id}
                href={`/team/${agent.id}`}
                label={agent.name}
                icon={getAgentIcon(agent.icon)}
                isActive={pathname === `/team/${agent.id}`}
                collapsed={collapsed}
                size="small"
                tooltipContent={
                  <>
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-xs text-muted-foreground">{agent.description}</p>
                  </>
                }
              />
            ))}
            <NavLink
              href="/skills"
              label="Skills Library"
              icon={BookOpen}
              isActive={pathname === "/skills" || pathname.startsWith("/skills/")}
              collapsed={collapsed}
              size="small"
            />
          </div>
        </ScrollArea>

        <SidebarFooter collapsed={collapsed} />
      </aside>
    </TooltipProvider>
  );
}
