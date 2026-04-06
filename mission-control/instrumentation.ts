/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Registers background jobs that run for the server's lifetime.
 */
export async function register() {
  // Only run in the Node.js runtime (not edge), and not during build
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.NODE_ENV === "test"
  ) {
    return;
  }

  const { scheduleUploadsCleanup } = await import("./src/lib/scheduled-jobs");
  scheduleUploadsCleanup();
}
