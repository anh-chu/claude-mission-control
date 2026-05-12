import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guards";
import {
	getDecisions,
	mutateActivityLog,
	mutateDecisions,
	mutateTasks,
} from "@/lib/data";
import {
	CACHE_HEADERS,
	paginateItems,
	parsePaginationParams,
} from "@/lib/paginate";
import type { ActivityEvent, DecisionItem } from "@/lib/types";
import { generateId } from "@/lib/utils";
import {
	decisionCreateSchema,
	decisionUpdateSchema,
	validateBody,
} from "@/lib/validations";

export async function GET(request: Request) {
	const unauthorized = await requireSession();
	if (unauthorized) return unauthorized;
	const { searchParams } = new URL(request.url);
	const status = searchParams.get("status");
	const data = await getDecisions();

	const total = data.decisions.length;
	let decisions = data.decisions;

	if (status) {
		decisions = decisions.filter((d) => d.status === status);
	}

	// Sort: pending first, then by date newest first
	decisions.sort((a, b) => {
		if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
		return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
	});

	// Pagination
	const pagination = parsePaginationParams(searchParams);
	const paginated = paginateItems(decisions, pagination, total);
	decisions = paginated.data;

	return NextResponse.json(
		{ data: decisions, decisions, meta: paginated.meta },
		{ headers: CACHE_HEADERS },
	);
}

export async function POST(request: Request) {
	const unauthorized = await requireSession();
	if (unauthorized) return unauthorized;
	const validation = await validateBody(request, decisionCreateSchema);
	if (!validation.success) return validation.error;
	const body = validation.data;

	const newDecision = await mutateDecisions(async (data) => {
		const decision: DecisionItem = {
			id: generateId("dec"),
			requestedBy: body.requestedBy,
			taskId: body.taskId,
			question: body.question,
			options: body.options,
			context: body.context,
			status: "pending",
			answer: null,
			answeredAt: null,
			createdAt: body.createdAt ?? new Date().toISOString(),
		};
		data.decisions.push(decision);
		return decision;
	});

	// Log activity
	await mutateActivityLog(async (logData) => {
		const event: ActivityEvent = {
			id: generateId("evt"),
			type: "decision_requested",
			actor: newDecision.requestedBy,
			taskId: newDecision.taskId,
			summary: `Decision requested: ${newDecision.question.slice(0, 80)}`,
			details: newDecision.context,
			timestamp: new Date().toISOString(),
		};
		logData.events.push(event);
	});

	return NextResponse.json(newDecision, { status: 201 });
}

export async function PUT(request: Request) {
	const unauthorized = await requireSession();
	if (unauthorized) return unauthorized;
	const validation = await validateBody(request, decisionUpdateSchema);
	if (!validation.success) return validation.error;
	const body = validation.data;

	const result = await mutateDecisions(async (data) => {
		const idx = data.decisions.findIndex((d) => d.id === body.id);
		if (idx === -1) return null;

		// Auto-set status to "answered" when an answer is provided
		const effectiveStatus =
			body.answer && data.decisions[idx].status === "pending"
				? "answered"
				: (body.status ?? data.decisions[idx].status);
		const wasAnswered =
			data.decisions[idx].status === "pending" &&
			effectiveStatus === "answered";

		data.decisions[idx] = {
			...data.decisions[idx],
			...body,
			status: effectiveStatus,
			answeredAt: wasAnswered
				? new Date().toISOString()
				: data.decisions[idx].answeredAt,
		};

		return { decision: data.decisions[idx], wasAnswered };
	});

	if (!result) {
		return NextResponse.json({ error: "Decision not found" }, { status: 404 });
	}

	// Log activity if decision was just answered
	if (result.wasAnswered) {
		await mutateActivityLog(async (logData) => {
			const event: ActivityEvent = {
				id: generateId("evt"),
				type: "decision_answered",
				actor: "me",
				taskId: result.decision.taskId,
				summary: `Answered: ${result.decision.question.slice(0, 60)} → "${body.answer}"`,
				details: "",
				timestamp: new Date().toISOString(),
			};
			logData.events.push(event);
		});
	}

	// Auto-resume task if it was paused awaiting this decision
	if (result.wasAnswered && result.decision.taskId) {
		const taskId = result.decision.taskId;
		let resumed = false;
		await mutateTasks(async (tasksData) => {
			const task = tasksData.tasks.find((t) => t.id === taskId);
			if (task && task.kanban === "awaiting-decision") {
				task.kanban = "not-started";
				task.updatedAt = new Date().toISOString();
				resumed = true;
			}
		});
		if (resumed) {
			await mutateActivityLog(async (logData) => {
				logData.events.push({
					id: generateId("evt"),
					type: "task_updated",
					actor: "system",
					taskId,
					summary: "Task re-queued after decision answered",
					details: `Decision answered: "${result.decision.answer}"`,
					timestamp: new Date().toISOString(),
				});
			});
		}
	}

	return NextResponse.json(result.decision);
}

export async function DELETE(request: Request) {
	const unauthorized = await requireSession();
	if (unauthorized) return unauthorized;
	const { searchParams } = new URL(request.url);
	const id = searchParams.get("id");
	if (!id) {
		return NextResponse.json({ error: "id required" }, { status: 400 });
	}

	await mutateDecisions(async (data) => {
		data.decisions = data.decisions.filter((d) => d.id !== id);
	});

	return NextResponse.json({ ok: true });
}
