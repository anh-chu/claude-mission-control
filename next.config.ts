import type { NextConfig } from "next";

// Permanent redirects for renamed routes
const nextConfig: NextConfig = {
	output: "standalone",
	redirects: async () => [
		// /crew → /agents redirects (old bookmarks/links)
		{ source: "/crew", destination: "/agents", permanent: false },
		{ source: "/crew/new", destination: "/agents/new", permanent: false },
		{ source: "/crew/:id", destination: "/agents/:id", permanent: false },
		{
			source: "/crew/:id/edit",
			destination: "/agents/:id/edit",
			permanent: false,
		},
		{
			source: "/daemon",
			destination: "/agents?tab=autopilot",
			permanent: true,
		},
		{ source: "/goals", destination: "/initiatives", permanent: true },
		{ source: "/objectives", destination: "/initiatives", permanent: true },
		// Merged into Dashboard tabs
		{ source: "/brain-dump", destination: "/?tab=inbox", permanent: false },
		{ source: "/activity", destination: "/?tab=activity", permanent: false },
		{ source: "/logs", destination: "/settings", permanent: false },
		// Merged into Work views
		{ source: "/map", destination: "/work/map", permanent: true },
		// /ops dissolved — merged into /agents and /settings
		// Ops tab redirects (must come before the catch-all /ops rule)
		{
			source: "/ops",
			has: [{ type: "query", key: "tab", value: "logs" }],
			destination: "/settings",
			permanent: false,
		},
		{
			source: "/ops",
			has: [{ type: "query", key: "tab", value: "autopilot" }],
			destination: "/agents?tab=autopilot",
			permanent: false,
		},
		{
			source: "/ops",
			has: [{ type: "query", key: "tab", value: "runs" }],
			destination: "/agents?tab=runs",
			permanent: false,
		},
		{ source: "/ops", destination: "/agents", permanent: false },
		// Merged into Agents tabs
		{
			source: "/autopilot",
			destination: "/agents?tab=autopilot",
			permanent: false,
		},
		{ source: "/skills", destination: "/agents?tab=skills", permanent: false },
		// Renamed routes (Phase 1)
		{ source: "/priority-matrix", destination: "/work", permanent: true },
		{ source: "/documents", destination: "/brain", permanent: true },
		{
			source: "/initiatives",
			destination: "/work/initiatives",
			permanent: true,
		},
		{ source: "/projects", destination: "/work/projects", permanent: true },
		{ source: "/work/milestones", destination: "/work", permanent: false },
	],
	allowedDevOrigins: ["localhost", "devvm", "127.0.0.1"],
	devIndicators: false,
	// The Claude Agent SDK uses runtime path resolution and child processes.
	// Bundling it via webpack/turbopack breaks model and slash-command discovery,
	// so keep it as an external dependency at runtime.
	serverExternalPackages: ["@anthropic-ai/claude-agent-sdk"],
	experimental: {
		optimizePackageImports: ["lucide-react"],
	},
};

export default nextConfig;
