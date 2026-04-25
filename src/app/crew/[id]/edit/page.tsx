"use client";

import { ArrowLeft } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { AgentForm, type AgentFormPayload } from "@/components/agent-form";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { Button } from "@/components/ui/button";
import { useAgents } from "@/hooks/use-data";

export default function EditAgentPage() {
	const router = useRouter();
	const params = useParams();
	const id = params.id as string;
	const {
		agents,
		loading,
		update: updateAgent,
		remove: deleteAgent,
	} = useAgents();

	const agent = agents.find((a) => a.id === id);

	if (loading) {
		return (
			<div className="space-y-6 max-w-2xl">
				<BreadcrumbNav
					items={[
						{ label: "Agents", href: "/crew" },
						{ label: id, href: `/crew/${id}` },
						{ label: "Edit" },
					]}
				/>
				<p className="text-sm text-muted-foreground">Loading...</p>
			</div>
		);
	}

	if (!agent) {
		return (
			<div className="space-y-6 max-w-2xl">
				<BreadcrumbNav
					items={[
						{ label: "Agents", href: "/crew" },
						{ label: id, href: `/crew/${id}` },
						{ label: "Edit" },
					]}
				/>
				<p className="text-sm text-muted-foreground">Agent not found.</p>
				<Button variant="ghost" onClick={() => router.push("/crew")}>
					<ArrowLeft className="h-4 w-4 mr-2" />
					Back to Agents
				</Button>
			</div>
		);
	}

	const handleSave = async (payload: AgentFormPayload) => {
		await updateAgent(agent.id, {
			name: payload.name,
			icon: payload.icon,
			description: payload.description,
			instructions: payload.instructions,
			skillIds: agent.skillIds,
			status: payload.status,
			backend: payload.backend,
			allowedTools: payload.allowedTools,
			skipPermissions: payload.skipPermissions,
			yolo: payload.yolo,
			updatedAt: new Date().toISOString(),
		});
		router.push(`/crew/${id}`);
	};

	const handleDelete = async () => {
		await deleteAgent(agent.id);
		router.push("/crew");
	};

	const handleStatusToggle = async () => {
		const newStatus = agent.status === "active" ? "inactive" : "active";
		await updateAgent(agent.id, { status: newStatus });
	};

	return (
		<AgentForm
			mode="edit"
			initialData={agent}
			currentStatus={agent.status}
			onSave={handleSave}
			onDelete={handleDelete}
			onStatusToggle={handleStatusToggle}
			onCancel={() => router.push(`/crew/${id}`)}
		/>
	);
}
