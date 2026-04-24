import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import {
	CardSkeleton,
	GridSkeleton,
	PageSkeleton,
	Skeleton,
} from "@/components/skeletons";

export default function DashboardLoading() {
	return (
		<PageSkeleton>
			<BreadcrumbNav items={[]} />
			<GridSkeleton
				className="grid grid-cols-2 sm:grid-cols-4 gap-3"
				count={4}
				renderItem={() => (
					<CardSkeleton className="p-4 space-y-2">
						<div className="flex items-center gap-2">
							<Skeleton className="h-5 w-5 rounded" />
							<Skeleton className="h-8 w-12" />
						</div>
						<Skeleton className="h-3 w-20" />
					</CardSkeleton>
				)}
			/>
			<div className="grid gap-4 lg:grid-cols-2">
				<CardSkeleton className="p-6 space-y-3">
					<Skeleton className="h-5 w-24" />
					{["row-1", "row-2", "row-3"].map((key) => (
						<div key={key} className="flex items-center gap-2">
							<Skeleton className="h-4 w-4 rounded" />
							<Skeleton className="h-4 flex-1" />
						</div>
					))}
				</CardSkeleton>
				<CardSkeleton className="p-6 space-y-3">
					<Skeleton className="h-5 w-24" />
					{["row-1", "row-2"].map((key) => (
						<div key={key} className="flex items-center gap-2">
							<Skeleton className="h-4 w-4 rounded" />
							<Skeleton className="h-4 flex-1" />
						</div>
					))}
				</CardSkeleton>
			</div>
			<div className="grid gap-4 lg:grid-cols-2">
				<CardSkeleton className="p-6 space-y-3">
					<Skeleton className="h-5 w-24" />
					{["row-1", "row-2", "row-3", "row-4"].map((key) => (
						<div key={key} className="flex items-center gap-2">
							<Skeleton className="h-4 w-4 rounded" />
							<Skeleton className="h-4 flex-1" />
						</div>
					))}
				</CardSkeleton>
				<CardSkeleton className="p-6 space-y-3">
					<Skeleton className="h-5 w-24" />
					{["row-1", "row-2", "row-3", "row-4", "row-5"].map((key) => (
						<div key={key} className="flex items-center gap-2">
							<Skeleton className="h-4 w-4 rounded" />
							<Skeleton className="h-4 flex-1" />
						</div>
					))}
				</CardSkeleton>
			</div>
			<GridSkeleton
				className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
				count={3}
				renderItem={() => (
					<CardSkeleton
						className="p-6 space-y-3"
						lines={[
							{ key: "summary", className: "h-3 w-full" },
							{ key: "progress", className: "h-1.5 w-full rounded-full" },
							{ key: "meta", className: "h-3 w-24" },
						]}
					>
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<Skeleton className="h-3 w-3 rounded-full" />
								<Skeleton className="h-5 w-32" />
							</div>
							<Skeleton className="h-5 w-14 rounded-full" />
						</div>
					</CardSkeleton>
				)}
			/>
		</PageSkeleton>
	);
}
