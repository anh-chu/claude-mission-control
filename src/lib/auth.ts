import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { auth, handlers, signIn, signOut } = NextAuth({
	providers: [Google],
	session: {
		strategy: "jwt",
		maxAge: 30 * 24 * 60 * 60, // 30 days
	},
	pages: {
		signIn: "/login",
	},
	callbacks: {
		signIn({ profile }) {
			const allowed = process.env.ALLOWED_EMAILS?.split(",")
				.map((e) => e.trim().toLowerCase())
				.filter(Boolean);

			// No allowlist = open access (backward compatible)
			if (!allowed?.length) return true;

			const email = profile?.email?.toLowerCase();
			return email ? allowed.includes(email) : false;
		},
		authorized({ auth: session, request }) {
			const pathname = request.nextUrl.pathname;

			// Always allow login page, auth routes, and health check
			if (
				pathname === "/login" ||
				pathname.startsWith("/api/auth/") ||
				pathname === "/api/server-status"
			) {
				return true;
			}

			// All other non-API routes require a valid session
			return !!session;
		},
	},
});
