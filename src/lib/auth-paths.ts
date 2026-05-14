/**
 * Returns true if the given pathname is a public route that does not require authentication.
 */
export function isPublicPath(pathname: string): boolean {
	return (
		pathname === "/login" ||
		pathname.startsWith("/api/auth/") ||
		pathname === "/api/server-status" ||
		pathname === "/api/webhooks" ||
		pathname.startsWith("/api/webhooks/")
	);
}
