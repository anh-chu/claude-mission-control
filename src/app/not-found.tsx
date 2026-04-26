import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
	return (
		<div className="flex flex-col items-center justify-center py-20 px-6 text-center">
			<div className="rounded-sm bg-muted p-3 mb-4">
				<FileQuestion className="size-5 text-muted-foreground" />
			</div>
			<h2 className="text-lg font-normal">Page not found</h2>
			<p className="text-sm text-muted-foreground mt-1 max-w-[300px]">
				The page you&apos;re looking for doesn&apos;t exist or has been moved.
			</p>
			<Button variant="outline" size="sm" asChild className="mt-4">
				<Link href="/">Go to Dashboard</Link>
			</Button>
		</div>
	);
}
