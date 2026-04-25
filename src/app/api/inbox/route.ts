import { NextResponse } from "next/server";
import { getInbox, mutateInbox } from "@/lib/data";
import {
	CACHE_HEADERS,
	paginateItems,
	parsePaginationParams,
} from "@/lib/paginate";
import type { InboxMessage } from "@/lib/types";
import { generateId } from "@/lib/utils";
import {
	inboxCreateSchema,
	inboxUpdateSchema,
	validateBody,
} from "@/lib/validations";

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const agent = searchParams.get("agent");
	const status = searchParams.get("status");
	const pagination = parsePaginationParams(searchParams);
	const data = await getInbox();

	const total = data.messages.length;
	let messages = data.messages;

	// Filter by agent (either from or to)
	if (agent) {
		messages = messages.filter((m) => m.from === agent || m.to === agent);
	}

	// Filter by status
	if (status) {
		messages = messages.filter((m) => m.status === status);
	}

	// Sort newest first
	messages.sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);

	// Pagination
	const result = paginateItems(messages, pagination, total);

	return NextResponse.json(
		{
			data: result.data,
			messages: result.data,
			meta: result.meta,
		},
		{ headers: CACHE_HEADERS },
	);
}

export async function POST(request: Request) {
	const validation = await validateBody(request, inboxCreateSchema);
	if (!validation.success) return validation.error;
	const body = validation.data;

	const newMessage = await mutateInbox(async (data) => {
		const message: InboxMessage = {
			id: generateId("msg"),
			from: body.from,
			to: body.to,
			type: body.type,
			taskId: body.taskId,
			subject: body.subject,
			body: body.body,
			status: "unread",
			createdAt: body.createdAt ?? new Date().toISOString(),
			readAt: null,
		};
		data.messages.push(message);
		return message;
	});

	return NextResponse.json(newMessage, { status: 201 });
}

export async function PUT(request: Request) {
	const validation = await validateBody(request, inboxUpdateSchema);
	if (!validation.success) return validation.error;
	const body = validation.data;

	const result = await mutateInbox(async (data) => {
		const idx = data.messages.findIndex((m) => m.id === body.id);
		if (idx === -1) return null;
		data.messages[idx] = {
			...data.messages[idx],
			...body,
			readAt:
				body.status === "read"
					? (data.messages[idx].readAt ?? new Date().toISOString())
					: data.messages[idx].readAt,
		};
		return data.messages[idx];
	});

	if (!result) {
		return NextResponse.json({ error: "Message not found" }, { status: 404 });
	}
	return NextResponse.json(result);
}

export async function DELETE(request: Request) {
	const { searchParams } = new URL(request.url);
	const id = searchParams.get("id");
	if (!id) {
		return NextResponse.json({ error: "id required" }, { status: 400 });
	}

	await mutateInbox(async (data) => {
		data.messages = data.messages.filter((m) => m.id !== id);
	});

	return NextResponse.json({ ok: true });
}
