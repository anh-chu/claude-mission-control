"use client";

import { usePathname } from "next/navigation";
import { LayoutShell } from "@/components/layout-shell";

export function ConditionalShell({ children }: { children: React.ReactNode }) {
	const pathname = usePathname();
	if (pathname === "/login") return <>{children}</>;
	return <LayoutShell>{children}</LayoutShell>;
}
