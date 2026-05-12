import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Re-exported for backward compatibility (tests import isPublicPath from auth-guards).
export { isPublicPath } from "@/lib/auth-paths";

/**
 * Ensures the current request has a valid session.
 * Returns a 401 JSON response if unauthenticated, or null if authenticated.
 * Use in API route handlers to protect endpoints.
 */
export async function requireSession(): Promise<Response | null> {
	const session = await auth();
	if (!session) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}
	return null;
}
