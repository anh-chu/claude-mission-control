import type { NextConfig } from "next";

// Permanent redirects for renamed routes
const nextConfig: NextConfig = {
	output: "standalone",
	redirects: async () => [
		{ source: "/daemon", destination: "/autopilot", permanent: true },
		{ source: "/goals", destination: "/initiatives", permanent: true },
		{ source: "/objectives", destination: "/initiatives", permanent: true },
		// Merged into Dashboard tabs
		{ source: "/brain-dump", destination: "/?tab=inbox", permanent: false },
		{ source: "/activity", destination: "/?tab=activity", permanent: false },
		{ source: "/logs", destination: "/?tab=logs", permanent: false },
		// Merged into Work views
		{ source: "/map", destination: "/work", permanent: true },
		// Merged into Agents tabs
		{
			source: "/autopilot",
			destination: "/ops?tab=autopilot",
			permanent: false,
		},
		{ source: "/skills", destination: "/crew?tab=skills", permanent: false },
		// Renamed routes (Phase 1)
		{ source: "/priority-matrix", destination: "/work", permanent: true },
		{ source: "/documents", destination: "/brain", permanent: true },
		{ source: "/initiatives", destination: "/work", permanent: true },
		{ source: "/projects", destination: "/work", permanent: true },
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
