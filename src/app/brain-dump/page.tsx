"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function BrainDumpRedirectPage() {
	const router = useRouter();

	useEffect(() => {
		router.replace("/?tab=inbox");
	}, [router]);

	return null;
}
