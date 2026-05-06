"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LogsRedirectPage() {
	const router = useRouter();

	useEffect(() => {
		router.replace("/?tab=logs");
	}, [router]);

	return null;
}
