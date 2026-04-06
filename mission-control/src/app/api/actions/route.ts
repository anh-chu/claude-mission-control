import { NextResponse } from "next/server";
import { getActions, mutateActions, mutateInitiatives } from "@/lib/data";
import type { Action } from "@/lib/types";
import { actionCreateSchema, actionUpdateSchema, validateBody, DEFAULT_LIMIT } from "@/lib/validations";
import { applyWorkspaceContext } from "@/lib/workspace-context";

export async function GET(request: Request) {
  await applyWorkspaceContext();

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const initiativeId = searchParams.get("initiativeId");
  const status = searchParams.get("status");

  const data = await getActions();
  const total = data.actions.length;
  let actions = data.actions;

  if (id) {
    actions = actions.filter((a) => a.id === id);
  }
  if (initiativeId) {
    actions = actions.filter((a) => a.initiativeId === initiativeId);
  }
  if (status) {
    actions = actions.filter((a) => a.status === status);
  }

  // Pagination
  const limitParam = searchParams.get("limit");
  const offsetParam = searchParams.get("offset");
  const totalFiltered = actions.length;
  const limit = limitParam ? Math.max(1, parseInt(limitParam, 10) || 50) : DEFAULT_LIMIT;
  const offset = Math.max(0, parseInt(offsetParam ?? "0", 10));
  actions = actions.slice(offset, offset + limit);

  return NextResponse.json(
    {
      data: actions,
      meta: { total, filtered: totalFiltered, returned: actions.length, limit, offset },
    },
    { headers: { "Cache-Control": "private, max-age=2, stale-while-revalidate=5" } },
  );
}

export async function POST(request: Request) {
  await applyWorkspaceContext();

  const validation = await validateBody(request, actionCreateSchema);
  if (!validation.success) return validation.error;
  const body = validation.data;

  const newAction = await mutateActions(async (data) => {
    const action: Action = {
      id: `action_${Date.now()}`,
      initiativeId: body.initiativeId,
      title: body.title,
      description: body.description,
      type: body.type,
      serviceId: body.serviceId,
      assignedTo: body.assignedTo,
      status: "draft",
      approvalRequired: body.approvalRequired,
      autonomyOverride: body.autonomyOverride,
      payload: body.payload,
      result: {},
      attachments: [],
      linkedTaskId: body.linkedTaskId,
      blockedBy: [],
      rejectionFeedback: null,
      approvedBy: null,
      rejectedBy: null,
      comments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      executedAt: null,
      completedAt: null,
    };
    data.actions.push(action);
    return action;
  });

  // If associated with an initiative, add action ID to initiative's actionIds
  if (newAction.initiativeId) {
    await mutateInitiatives(async (data) => {
      const idx = data.initiatives.findIndex((i) => i.id === newAction.initiativeId);
      if (idx !== -1) {
        if (!data.initiatives[idx].actionIds.includes(newAction.id)) {
          data.initiatives[idx].actionIds.push(newAction.id);
          data.initiatives[idx].updatedAt = new Date().toISOString();
        }
      }
    });
  }

  return NextResponse.json(newAction, { status: 201 });
}

export async function PUT(request: Request) {
  await applyWorkspaceContext();

  const validation = await validateBody(request, actionUpdateSchema);
  if (!validation.success) return validation.error;
  const body = validation.data;

  const updated = await mutateActions(async (data) => {
    const idx = data.actions.findIndex((a) => a.id === body.id);
    if (idx === -1) return null;
    data.actions[idx] = {
      ...data.actions[idx],
      ...body,
      updatedAt: new Date().toISOString(),
    };
    return data.actions[idx];
  });

  if (!updated) {
    return NextResponse.json({ error: "Action not found" }, { status: 404 });
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

  const found = await mutateActions(async (data) => {
    const idx = data.actions.findIndex((a) => a.id === id);
    if (idx === -1) return false;
    data.actions.splice(idx, 1);
    return true;
  });

  if (!found) {
    return NextResponse.json({ error: "Action not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
