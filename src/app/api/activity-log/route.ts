import { NextResponse } from "next/server";
import { getActivityLog, mutateActivityLog } from "@/lib/data";
import {
	CACHE_HEADERS,
	paginateItems,
	parsePaginationParams,
} from "@/lib/paginate";
import type { ActivityEvent } from "@/lib/types";
import { generateId } from "@/lib/utils";
import { activityEventCreateSchema, validateBody } from "@/lib/validations";

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const actor = searchParams.get("actor");
	const pagination = parsePaginationParams(searchParams);
	const data = await getActivityLog();

	const total = data.events.length;
	let events = data.events;

	// Filter by actor if provided
	if (actor) {
		events = events.filter((e) => e.actor === actor);
	}

	// Sort newest first
	events.sort(
		(a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
	);

	// Pagination
	const result = paginateItems(events, pagination, total);

	return NextResponse.json(
		{
			data: result.data,
			events: result.data,
			meta: result.meta,
		},
		{ headers: CACHE_HEADERS },
	);
}

export async function POST(request: Request) {
	const validation = await validateBody(request, activityEventCreateSchema);
	if (!validation.success) return validation.error;
	const body = validation.data;

	const newEvent = await mutateActivityLog(async (data) => {
		const event: ActivityEvent = {
			id: generateId("evt"),
			type: body.type,
			actor: body.actor,
			taskId: body.taskId,
			summary: body.summary,
			details: body.details,
			timestamp: body.timestamp ?? new Date().toISOString(),
		};
		data.events.push(event);
		return event;
	});

	return NextResponse.json(newEvent, { status: 201 });
}

export async function DELETE(request: Request) {
	const { searchParams } = new URL(request.url);
	const id = searchParams.get("id");
	if (!id) {
		return NextResponse.json({ error: "id required" }, { status: 400 });
	}

	await mutateActivityLog(async (data) => {
		data.events = data.events.filter((e) => e.id !== id);
	});

	return NextResponse.json({ ok: true });
}
