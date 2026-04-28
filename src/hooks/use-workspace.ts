"use client";
import { useCallback, useEffect, useState } from "react";
import type { Workspace } from "@/lib/types";

export function useWorkspace() {
	const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
	const [currentId, setCurrentId] = useState<string>("default");
	const [loading, setLoading] = useState(true);

	// Read current workspace from cookie on mount
	useEffect(() => {
		const match = document.cookie.match(/workspace_id=([^;]+)/);
		if (match) setCurrentId(match[1]);
	}, []);

	const fetchWorkspaces = useCallback(async () => {
		try {
			const res = await fetch("/api/workspaces");
			if (res.ok) {
				const data = (await res.json()) as Workspace[];
				setWorkspaces(data);
			}
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void fetchWorkspaces();
	}, [fetchWorkspaces]);

	const switchWorkspace = useCallback((id: string) => {
		// biome-ignore lint/suspicious/noDocumentCookie: intentional cookie for workspace persistence
		document.cookie = `workspace_id=${id}; path=/; max-age=${60 * 60 * 24 * 365}`;
		window.location.reload();
	}, []);

	const createWorkspace = useCallback(
		async (name: string, color: string) => {
			const res = await fetch("/api/workspaces", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name, color }),
			});
			if (!res.ok) throw new Error("Failed to create workspace");
			await fetchWorkspaces();
			return res.json() as Promise<Workspace>;
		},
		[fetchWorkspaces],
	);

	const currentWorkspace =
		workspaces.find((w) => w.id === currentId) ?? workspaces[0];

	return {
		workspaces,
		currentWorkspace,
		currentId,
		loading,
		switchWorkspace,
		createWorkspace,
	};
}
