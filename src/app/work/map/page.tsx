"use client";

import {
	BreadcrumbNav,
	type BreadcrumbPeer,
} from "@/components/breadcrumb-nav";
import { WorkMapView } from "@/components/work-map-view";

const workPeers: BreadcrumbPeer[] = [
	{ label: "Tasks", href: "/work" },
	{ label: "Projects", href: "/work/projects" },
	{ label: "Initiatives", href: "/work/initiatives" },
	{ label: "Map", href: "/work/map" },
];

export default function MapPage() {
	return (
		<div className="space-y-4">
			<BreadcrumbNav
				items={[{ label: "Work", href: "/work" }, { label: "Map" }]}
				peers={workPeers}
			/>
			<WorkMapView />
		</div>
	);
}
