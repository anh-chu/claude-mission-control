"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { SkillForm } from "@/components/skill-form";
import { useSkills } from "@/hooks/use-data";
import { useWorkspace } from "@/hooks/use-workspace";

export default function SkillEditorPage() {
	const params = useParams();
	const skillId = params.id as string;
	const router = useRouter();
	const { currentId: workspaceId } = useWorkspace();
	const {
		skills,
		remove: deleteSkill,
		activate,
		deactivate,
	} = useSkills(workspaceId);
	const [toggling, setToggling] = useState(false);

	const skill = skills.find((s) => s.id === skillId);

	if (!skill) {
		return (
			<div className="space-y-6">
				<BreadcrumbNav
					items={[
						{ label: "Skills Library", href: "/skills" },
						{ label: "Not Found" },
					]}
				/>
				<p className="text-muted-foreground">Skill not found.</p>
			</div>
		);
	}

	const handleDelete = async () => {
		if (!confirm("Are you sure you want to delete this skill?")) return;
		await deleteSkill(skill.id);
		router.push("/skills");
	};

	const handleToggleActivation = async () => {
		setToggling(true);
		try {
			if (skill.activated) {
				await deactivate(skill.id);
			} else {
				await activate(skill.id);
			}
		} finally {
			setToggling(false);
		}
	};

	return (
		<SkillForm
			mode="edit"
			initialData={skill}
			onDelete={handleDelete}
			activationProps={{
				activated: skill.activated === true,
				onToggle: handleToggleActivation,
				loading: toggling,
			}}
		/>
	);
}
