"use client";

import { useRouter } from "next/navigation";
import { AgentForm, type AgentFormPayload } from "@/components/agent-form";
import { useAgents } from "@/hooks/use-data";

export default function NewAgentPage() {
	const router = useRouter();
	const { create: createAgent } = useAgents();

	const handleSave = async (payload: AgentFormPayload) => {
		await createAgent({
			id: payload.id ?? `agent_${Date.now()}`,
			name: payload.name,
			icon: payload.icon,
			description: payload.description,
			instructions: payload.instructions,
			skillIds: [],
			status: payload.status,
			backend: payload.backend,
			allowedTools: payload.allowedTools,
			skipPermissions: payload.skipPermissions,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		});
		router.push("/crew");
	};

	return (
		<AgentForm
			mode="create"
			onSave={handleSave}
			onCancel={() => router.back()}
		/>
	);
}
