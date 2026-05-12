import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guards";
import { isAllowedLogPath, tailFile } from "@/lib/log-reader";
import { DATA_DIR } from "@/lib/paths";

export async function GET(request: NextRequest) {
	const unauthorized = await requireSession();
	if (unauthorized) return unauthorized;
	const logPath = path.join(DATA_DIR, "daemon.log");

	if (!isAllowedLogPath(logPath)) {
		return NextResponse.json(
			{ lines: [], error: "Forbidden" },
			{ status: 403 },
		);
	}

	const rawLines = Number.parseInt(
		request.nextUrl.searchParams.get("lines") ?? "",
		10,
	);
	const lines = Number.isFinite(rawLines) ? rawLines : 50;
	const search =
		request.nextUrl.searchParams.get("search")?.trim() || undefined;

	try {
		const tail = await tailFile(logPath, lines, search);
		return NextResponse.json({ lines: tail, error: null });
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			return NextResponse.json({ lines: [], error: null });
		}
		return NextResponse.json(
			{ lines: [], error: "Failed to read daemon log" },
			{ status: 500 },
		);
	}
}
