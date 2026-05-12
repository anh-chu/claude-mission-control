import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guards";
import { getBrainDump, mutateBrainDump } from "@/lib/data";
import {
	CACHE_HEADERS,
	paginateItems,
	parsePaginationParams,
} from "@/lib/paginate";
import type { BrainDumpEntry } from "@/lib/types";
import { generateId } from "@/lib/utils";
import {
	brainDumpCreateSchema,
	brainDumpUpdateSchema,
	validateBody,
} from "@/lib/validations";

export async function GET(request: Request) {
	const unauthorized = await requireSession();
	if (unauthorized) return unauthorized;
	const { searchParams } = new URL(request.url);
	const id = searchParams.get("id");
	const processed = searchParams.get("processed");

	const data = await getBrainDump();
	const total = data.entries.length;
	let entries = data.entries;

	if (id) {
		entries = entries.filter((e) => e.id === id);
	}
	if (processed !== null) {
		const isProcessed = processed === "true";
		entries = entries.filter((e) => e.processed === isProcessed);
	}

	// Pagination
	const pagination = parsePaginationParams(searchParams);
	const paginated = paginateItems(entries, pagination, total);
	entries = paginated.data;

	return NextResponse.json(
		{ data: entries, entries, meta: paginated.meta },
		{ headers: CACHE_HEADERS },
	);
}

export async function POST(request: Request) {
	const unauthorized = await requireSession();
	if (unauthorized) return unauthorized;
	const validation = await validateBody(request, brainDumpCreateSchema);
	if (!validation.success) return validation.error;
	const body = validation.data;

	const newEntry = await mutateBrainDump(async (data) => {
		const entry: BrainDumpEntry = {
			id: generateId("bd"),
			content: body.content,
			capturedAt: body.capturedAt ?? new Date().toISOString(),
			processed: body.processed,
			convertedTo: body.convertedTo,
			tags: body.tags,
		};
		data.entries.push(entry);
		return entry;
	});

	return NextResponse.json(newEntry, { status: 201 });
}

export async function PUT(request: Request) {
	const unauthorized = await requireSession();
	if (unauthorized) return unauthorized;
	const validation = await validateBody(request, brainDumpUpdateSchema);
	if (!validation.success) return validation.error;
	const body = validation.data;

	const result = await mutateBrainDump(async (data) => {
		const idx = data.entries.findIndex((e) => e.id === body.id);
		if (idx === -1) return null;
		data.entries[idx] = { ...data.entries[idx], ...body };
		return data.entries[idx];
	});

	if (!result) {
		return NextResponse.json({ error: "Entry not found" }, { status: 404 });
	}
	return NextResponse.json(result);
}

export async function DELETE(request: Request) {
	const unauthorized = await requireSession();
	if (unauthorized) return unauthorized;
	const { searchParams } = new URL(request.url);
	const id = searchParams.get("id");
	if (!id) {
		return NextResponse.json({ error: "id required" }, { status: 400 });
	}

	await mutateBrainDump(async (data) => {
		data.entries = data.entries.filter((e) => e.id !== id);
	});

	return NextResponse.json({ ok: true });
}
