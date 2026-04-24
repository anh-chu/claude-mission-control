import type { NextConfig } from "next";

// Permanent redirects for renamed routes
const nextConfig: NextConfig = {
	redirects: async () => [
		{ source: "/daemon", destination: "/autopilot", permanent: true },
		// /goals and /objectives both redirect to /initiatives since objectives was renamed
		{ source: "/goals", destination: "/initiatives", permanent: true },
		{ source: "/objectives", destination: "/initiatives", permanent: true },
	],
	allowedDevOrigins: ["localhost", "devvm", "127.0.0.1"],
	devIndicators: false,
	experimental: {
		optimizePackageImports: ["lucide-react"],
	},
};

export default nextConfig;
