import {
	BreadcrumbNav,
	type BreadcrumbPeer,
} from "@/components/breadcrumb-nav";
import { Skeleton } from "@/components/ui/skeleton";

const workPeers: BreadcrumbPeer[] = [
	{ label: "Tasks", href: "/work" },
	{ label: "Projects", href: "/work/projects" },
	{ label: "Initiatives", href: "/work/initiatives" },
	{ label: "Map", href: "/work/map" },
];

export default function MapLoading() {
	return (
		<div className="space-y-4">
			<BreadcrumbNav
				items={[{ label: "Work", href: "/work" }, { label: "Map" }]}
				peers={workPeers}
			/>
			<Skeleton className="h-[calc(100vh-12rem)] w-full rounded-xl" />
		</div>
	);
}
