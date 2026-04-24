import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { LayoutShell } from "@/components/layout-shell";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: "Task Control",
	description:
		"AI agent orchestration hub — Eisenhower matrix, Kanban, initiatives, and multi-agent task execution",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className={`${inter.className} antialiased`}>
				<ThemeProvider>
					<LayoutShell>{children}</LayoutShell>
					<Toaster
						theme="system"
						position="bottom-right"
						toastOptions={{
							className: "border-border bg-card text-card-foreground",
						}}
					/>
				</ThemeProvider>
			</body>
		</html>
	);
}
