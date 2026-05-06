"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ActivityRedirectPage() {
	const router = useRouter();

	useEffect(() => {
		router.replace("/?tab=activity");
	}, [router]);

	return null;
}
