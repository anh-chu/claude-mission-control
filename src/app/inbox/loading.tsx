import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { GridSkeleton, RowSkeleton } from "@/components/skeletons";

export default function InboxLoading() {
	return (
		<div className="space-y-6">
			<BreadcrumbNav items={[{ label: "Inbox" }]} />
			<GridSkeleton
				className="space-y-2"
				count={5}
				renderItem={() => (
					<RowSkeleton
						className="rounded-xl border bg-card/50 p-3"
						leading={[
							{ key: "icon", className: "h-4 w-4 rounded" },
							{ key: "badge", className: "h-5 w-16 rounded-full" },
						]}
						lines={[{ key: "title", className: "h-4 w-full" }]}
						linesClassName="flex-1"
						trailing={[{ key: "meta", className: "h-3 w-20" }]}
					/>
				)}
			/>
		</div>
	);
}
