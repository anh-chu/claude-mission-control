"use client";

import { ChevronRight, Home } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
	label: string;
	href?: string;
}

export interface BreadcrumbPeer {
	label: string;
	href: string;
}

interface BreadcrumbNavProps {
	items: BreadcrumbItem[];
	className?: string;
	peers?: BreadcrumbPeer[];
}

export function BreadcrumbNav({ items, className, peers }: BreadcrumbNavProps) {
	const lastItem = items[items.length - 1];

	return (
		<nav
			className={cn("flex items-center gap-1.5 text-sm", className)}
			aria-label="Breadcrumb"
		>
			<Link
				href="/"
				className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
			>
				<Home className="h-4 w-4" />
				<span>Home</span>
			</Link>
			{peers ? (
				<>
					{items.slice(0, -1).map((item, i) => (
						<span key={i} className="flex items-center gap-1.5">
							<ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
							{item.href ? (
								<Link
									href={item.href}
									className="text-muted-foreground hover:text-foreground transition-colors"
								>
									{item.label}
								</Link>
							) : (
								<span className="text-foreground font-normal">
									{item.label}
								</span>
							)}
						</span>
					))}
					<span className="flex items-center gap-1.5">
						<ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
						<span className="inline-flex items-center gap-0.5 bg-muted p-1 rounded-md">
							{peers.map((peer) =>
								lastItem && peer.label === lastItem.label ? (
									<span
										key={peer.href}
										className="px-3 py-1.5 text-sm rounded-md bg-accent text-accent-foreground"
									>
										{peer.label}
									</span>
								) : (
									<Link
										key={peer.href}
										href={peer.href}
										className="px-3 py-1.5 text-sm rounded-md transition-colors text-muted-foreground hover:bg-accent/50 hover:text-foreground"
									>
										{peer.label}
									</Link>
								),
							)}
						</span>
					</span>
				</>
			) : (
				items.map((item, i) => (
					<span key={i} className="flex items-center gap-1.5">
						<ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
						{item.href ? (
							<Link
								href={item.href}
								className="text-muted-foreground hover:text-foreground transition-colors"
							>
								{item.label}
							</Link>
						) : (
							<span className="text-foreground font-normal">{item.label}</span>
						)}
					</span>
				))
			)}
		</nav>
	);
}
