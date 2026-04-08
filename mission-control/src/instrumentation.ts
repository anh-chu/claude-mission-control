/**
 * Next.js instrumentation hook — runs once when the server starts.
 * Node.js-only work is in instrumentation.node.ts to avoid Edge bundling.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NODE_ENV !== "test") {
    await import("./instrumentation.node");
  }
}
