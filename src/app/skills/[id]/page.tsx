"use client";

import { useParams, useRouter } from "next/navigation";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { SkillForm } from "@/components/skill-form";
import { useSkills } from "@/hooks/use-data";

export default function SkillEditorPage() {
	const params = useParams();
	const skillId = params.id as string;
	const router = useRouter();
	const { skills, remove: deleteSkill } = useSkills();

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

	return <SkillForm mode="edit" initialData={skill} onDelete={handleDelete} />;
}
