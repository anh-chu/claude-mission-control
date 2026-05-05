"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ModelInfo {
	value: string;
	displayName: string;
}

interface ModelSelectProps {
	value: string;
	onChange: (model: string) => void;
	className?: string;
}

const FALLBACK_MODELS: ModelInfo[] = [
	{ value: "haiku", displayName: "Haiku" },
	{ value: "sonnet", displayName: "Sonnet" },
	{ value: "opus", displayName: "Opus" },
];

export function ModelSelect({ value, onChange, className }: ModelSelectProps) {
	const [mounted, setMounted] = useState(false);
	const [models, setModels] = useState<ModelInfo[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		let mounted = true;

		async function fetchModels() {
			try {
				const res = await fetch("/api/claude/models");
				if (!res.ok) throw new Error("Failed to fetch");
				const data = await res.json();
				if (!mounted) return;
				if (data.models && Array.isArray(data.models)) {
					setModels(data.models);
				}
			} catch {
				if (!mounted) return;
				setError(true);
				setModels(FALLBACK_MODELS);
			} finally {
				if (mounted) {
					setLoading(false);
				}
			}
		}

		fetchModels();

		return () => {
			mounted = false;
		};
	}, []);

	const filtered = models.filter(
		(m) =>
			!m.displayName.startsWith("Default") && !m.value.startsWith("default"),
	);

	const selectOptions = loading
		? [{ value: "", displayName: "Loading..." }]
		: filtered;

	return (
		<select
			value={value}
			onChange={(e) => onChange(e.target.value)}
			disabled={mounted && loading ? true : undefined}
			suppressHydrationWarning
			className={cn(
				"h-7 rounded-sm border bg-secondary px-2 text-xs",
				className,
			)}
		>
			{!loading && error && (
				<option value="" disabled>
					Default
				</option>
			)}
			{selectOptions.map((model) => (
				<option key={model.value} value={model.value}>
					{model.displayName}
				</option>
			))}
		</select>
	);
}
