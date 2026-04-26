import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { CardSkeleton, GridSkeleton, Skeleton } from "@/components/skeletons";

export default function CrewLoading() {
	return (
		<div className="space-y-6">
			<BreadcrumbNav items={[{ label: "Agents" }]} />
			<GridSkeleton
				className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
				count={6}
				renderItem={() => (
					<CardSkeleton className="p-5 space-y-3">
						<div className="flex items-start justify-between">
							<div className="flex items-center gap-3">
								<Skeleton className="h-10 w-10 rounded-full" />
								<div className="space-y-1.5">
									<Skeleton className="h-4 w-28" />
									<Skeleton className="h-3 w-40" />
								</div>
							</div>
							<Skeleton className="h-3 w-3 rounded-full" />
						</div>
						<div className="flex gap-1">
							<Skeleton className="h-4 w-16 rounded-sm" />
							<Skeleton className="h-4 w-20 rounded-sm" />
							<Skeleton className="h-4 w-14 rounded-sm" />
						</div>
						<div className="flex items-center justify-between pt-3 border-t">
							<Skeleton className="h-3 w-20" />
							<Skeleton className="h-3 w-16" />
						</div>
					</CardSkeleton>
				)}
			/>
		</div>
	);
}
