import { NextResponse } from "next/server";
import { getInitiatives, mutateInitiatives } from "@/lib/data";
import {
	CACHE_HEADERS,
	paginateItems,
	parsePaginationParams,
} from "@/lib/paginate";
import type { Initiative } from "@/lib/types";
import {
	initiativeCreateSchema,
	initiativeUpdateSchema,
	validateBody,
} from "@/lib/validations";
import { applyWorkspaceContext } from "@/lib/workspace-context";

export async function GET(request: Request) {
	await applyWorkspaceContext();

	const { searchParams } = new URL(request.url);
	const id = searchParams.get("id");
	const projectId = searchParams.get("projectId");
	const status = searchParams.get("status");
	const includeDeleted = searchParams.get("includeDeleted") === "true";

	const data = await getInitiatives();
	const total = data.initiatives.length;
	let initiatives = data.initiatives;

	// Filter out soft-deleted by default
	if (!includeDeleted) {
		initiatives = initiatives.filter((i) => !i.deletedAt);
	}

	if (id) {
		initiatives = initiatives.filter((i) => i.id === id);
	}
	if (projectId) {
		initiatives = initiatives.filter((i) => i.projectId === projectId);
	}
	if (status) {
		initiatives = initiatives.filter((i) => i.status === status);
	}

	// Pagination
	const pagination = parsePaginationParams(searchParams);
	const paginated = paginateItems(initiatives, pagination, total);
	initiatives = paginated.data;

	return NextResponse.json(
		{ data: initiatives, meta: paginated.meta },
		{ headers: CACHE_HEADERS },
	);
}

export async function POST(request: Request) {
	await applyWorkspaceContext();

	const validation = await validateBody(request, initiativeCreateSchema);
	if (!validation.success) return validation.error;
	const body = validation.data;

	const newInitiative = await mutateInitiatives(async (data) => {
		const initiative: Initiative = {
			id: `init_${Date.now()}`,
			title: body.title,
			description: body.description,
			status: body.status,
			projectId:
				(body as typeof body & { projectId?: string | null }).projectId ?? null,
			color: body.color,
			teamMembers: body.teamMembers,
			taskIds: [],
			tags: body.tags,
			mapPosition: body.mapPosition,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
			completedAt: null,
			deletedAt: null,
		};
		data.initiatives.push(initiative);
		return initiative;
	});

	return NextResponse.json(newInitiative, { status: 201 });
}

export async function PUT(request: Request) {
	await applyWorkspaceContext();

	const validation = await validateBody(request, initiativeUpdateSchema);
	if (!validation.success) return validation.error;
	const body = validation.data;

	const updated = await mutateInitiatives(async (data) => {
		const idx = data.initiatives.findIndex((i) => i.id === body.id);
		if (idx === -1) return null;
		data.initiatives[idx] = {
			...data.initiatives[idx],
			...body,
			updatedAt: new Date().toISOString(),
		};
		return data.initiatives[idx];
	});

	if (!updated) {
		return NextResponse.json(
			{ error: "Initiative not found" },
			{ status: 404 },
		);
	}
	return NextResponse.json(updated);
}

export async function DELETE(request: Request) {
	await applyWorkspaceContext();

	const { searchParams } = new URL(request.url);
	const id = searchParams.get("id");

	if (!id) {
		return NextResponse.json({ error: "id required" }, { status: 400 });
	}

	const found = await mutateInitiatives(async (data) => {
		const idx = data.initiatives.findIndex((i) => i.id === id);
		if (idx === -1) return false;
		data.initiatives[idx].deletedAt = new Date().toISOString();
		data.initiatives[idx].updatedAt = new Date().toISOString();
		return true;
	});

	if (!found) {
		return NextResponse.json(
			{ error: "Initiative not found" },
			{ status: 404 },
		);
	}

	return NextResponse.json({ ok: true });
}
