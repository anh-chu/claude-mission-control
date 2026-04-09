import { NextRequest, NextResponse } from "next/server";
import { getWorkspaces, mutateWorkspaces, ensureWorkspaceDir } from "@/lib/data";
import { rm } from "fs/promises";
import path from "path";
import { z } from "zod";
import { DATA_DIR } from "@/lib/paths";
import type { Workspace } from "@/lib/types";

const CreateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().default(""),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
});

export async function GET() {
  const data = await getWorkspaces();
  return NextResponse.json(data.workspaces);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = CreateWorkspaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const now = new Date().toISOString();
  const id = parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now();
  const workspace: Workspace = {
    id,
    name: parsed.data.name,
    description: parsed.data.description,
    color: parsed.data.color,
    isDefault: false,
    settings: {},
    createdAt: now,
    updatedAt: now,
  };
  await ensureWorkspaceDir(id);
  await mutateWorkspaces(async (data) => {
    data.workspaces.push(workspace);
  });
  return NextResponse.json(workspace, { status: 201 });
}

export async function PUT(request: NextRequest) {
  const body = await request.json() as { id?: string; name?: string; color?: string; description?: string; settings?: Record<string, unknown> };
  const { id, name, color, description, settings } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await mutateWorkspaces(async (data) => {
    const ws = data.workspaces.find(w => w.id === id);
    if (!ws) throw new Error("Not found");
    if (name) ws.name = name;
    if (color) ws.color = color;
    if (description !== undefined) ws.description = description;
    if (settings) ws.settings = { ...ws.settings, ...settings };
    ws.updatedAt = new Date().toISOString();
  });
  const updated = await getWorkspaces();
  const ws = updated.workspaces.find(w => w.id === id);
  if (!ws) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(ws);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const confirm = searchParams.get("confirm");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (confirm !== "true") return NextResponse.json({ error: "confirm=true required for hard delete" }, { status: 400 });
  // Cannot delete the default workspace
  const data = await getWorkspaces();
  const ws = data.workspaces.find(w => w.id === id);
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  if (ws.isDefault) return NextResponse.json({ error: "Cannot delete the default workspace" }, { status: 400 });
  // Hard delete: remove directory + metadata
  await mutateWorkspaces(async (d) => {
    d.workspaces = d.workspaces.filter(w => w.id !== id);
  });
  // Best-effort directory removal
  try {
    await rm(path.join(DATA_DIR, "workspaces", id), { recursive: true, force: true });
  } catch { /* ignore */ }
  return NextResponse.json({ deleted: id });
}
