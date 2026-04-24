import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { GridSkeleton, RowSkeleton } from "@/components/skeletons";

export default function BrainDumpLoading() {
	return (
		<div className="space-y-6">
			<BreadcrumbNav items={[{ label: "Quick Capture" }]} />
			<GridSkeleton
				className="space-y-2"
				count={4}
				renderItem={() => (
					<RowSkeleton
						className="rounded-xl border bg-card/50 p-3 items-start justify-between"
						lines={[
							{ key: "title", className: "h-4 w-4/5" },
							{ key: "meta", className: "h-3 w-24" },
						]}
						linesClassName="flex-1 space-y-2"
						trailing={[
							{ key: "primary-action", className: "h-7 w-14 rounded-md" },
							{ key: "secondary-action", className: "h-7 w-7 rounded-md" },
							{ key: "tertiary-action", className: "h-7 w-7 rounded-md" },
						]}
					/>
				)}
			/>
		</div>
	);
}
