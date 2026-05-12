import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { AuthProvider } from "@/components/auth-provider";
import { ConditionalShell } from "@/components/conditional-shell";
import { ThemeProvider } from "@/components/theme-provider";

const inter = Inter({
	subsets: ["latin"],
	variable: "--font-inter",
});

export const metadata: Metadata = {
	title: "Mandio",
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
			<body className={`${inter.variable} font-sans antialiased`}>
				<AuthProvider>
					<ThemeProvider>
						<ConditionalShell>{children}</ConditionalShell>
						<Toaster
							theme="system"
							position="bottom-right"
							toastOptions={{
								className: "border-border bg-card text-card-foreground",
							}}
						/>
					</ThemeProvider>
				</AuthProvider>
			</body>
		</html>
	);
}
