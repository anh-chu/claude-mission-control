import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { CardSkeleton, GridSkeleton, Skeleton } from "@/components/skeletons";

export default function PriorityMatrixLoading() {
	return (
		<div className="space-y-6">
			<BreadcrumbNav items={[{ label: "Priority Matrix" }]} />
			<GridSkeleton
				className="grid grid-cols-1 sm:grid-cols-2 gap-3"
				count={4}
				renderItem={() => (
					<CardSkeleton className="bg-card p-4 min-h-[200px] space-y-2">
						<Skeleton className="h-5 w-24" />
						<Skeleton className="h-3 w-32" />
						<GridSkeleton
							className="space-y-2 pt-2"
							count={2}
							renderItem={() => (
								<CardSkeleton
									className="p-3 space-y-2"
									lines={[
										{ key: "line-1", className: "h-3 w-full" },
										{ key: "line-2", className: "h-3 w-2/3" },
									]}
									footer={[
										{ key: "tag-1", className: "h-4 w-16 rounded-sm" },
										{ key: "tag-2", className: "h-4 w-14 rounded-sm" },
									]}
								>
									<div className="flex items-start justify-between gap-2">
										<Skeleton className="h-4 w-3/4" />
										<Skeleton className="h-2 w-2 rounded-full" />
									</div>
								</CardSkeleton>
							)}
						/>
					</CardSkeleton>
				)}
			/>
		</div>
	);
}
