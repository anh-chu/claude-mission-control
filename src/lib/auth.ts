import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { isPublicPath } from "@/lib/auth-paths";

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
			const allowAll =
				process.env.AUTH_ALLOW_ALL_USERS === "true" &&
				process.env.NODE_ENV !== "production";

			const allowed = process.env.ALLOWED_EMAILS?.split(",")
				.map((e) => e.trim().toLowerCase())
				.filter(Boolean);

			// Fail closed: missing or empty ALLOWED_EMAILS denies all
			// unless AUTH_ALLOW_ALL_USERS is explicitly "true" (dev only).
			if (!allowed?.length && !allowAll) return false;

			// Open access gate — only checked when ALLOWED_EMAILS is empty/unset.
			if (!allowed?.length && allowAll) {
				// Still require Google email verification
				if ((profile as Record<string, unknown>)?.email_verified !== true) {
					return false;
				}
				return true;
			}

			// Require Google profile email_verified before checking the allowlist
			if ((profile as Record<string, unknown>)?.email_verified !== true) {
				return false;
			}

			const email = profile?.email?.toLowerCase();
			return email ? (allowed?.includes(email) ?? false) : false;
		},
		authorized({ auth: session, request }) {
			const pathname = request.nextUrl.pathname;

			// Public paths (login page, auth routes, health check)
			if (isPublicPath(pathname)) {
				return true;
			}

			// All other routes require a valid session
			return !!session;
		},
	},
});
