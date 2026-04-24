import { Fragment, type ReactNode } from "react";

import { Skeleton as SkeletonPrimitive } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export { SkeletonPrimitive as Skeleton };

export type SkeletonLine = {
	className: string;
	key?: string;
};

export type CardSkeletonProps = {
	className?: string;
	lines?: SkeletonLine[];
	footer?: SkeletonLine[];
	footerClassName?: string;
	children?: ReactNode;
	childrenPosition?: "beforeLines" | "afterLines" | "afterFooter";
};

export type RowSkeletonProps = {
	className?: string;
	leading?: SkeletonLine[];
	lines?: SkeletonLine[];
	trailing?: SkeletonLine[];
	linesClassName?: string;
	trailingClassName?: string;
};

export type GridSkeletonProps = {
	className?: string;
	count: number;
	renderItem: (index: number) => ReactNode;
};

export type PageSkeletonProps = {
	className?: string;
	children: ReactNode;
};

function skeletonKey(line: SkeletonLine) {
	return line.key ?? line.className;
}

function renderSkeleton(line: SkeletonLine, index: number) {
	return (
		<SkeletonPrimitive
			key={`${skeletonKey(line)}-${index}`}
			className={line.className}
		/>
	);
}

function skeletonKeys(prefix: string, count: number) {
	return Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);
}

export function CardSkeleton({
	className,
	lines = [],
	footer = [],
	footerClassName = "flex gap-1.5 pt-1",
	children,
	childrenPosition = "beforeLines",
}: CardSkeletonProps) {
	return (
		<div className={cn("rounded-xl border bg-card p-4 space-y-3", className)}>
			{childrenPosition === "beforeLines" && children}
			{lines.map(renderSkeleton)}
			{childrenPosition === "afterLines" && children}
			{footer.length > 0 && (
				<div className={footerClassName}>{footer.map(renderSkeleton)}</div>
			)}
			{childrenPosition === "afterFooter" && children}
		</div>
	);
}

export function RowSkeleton({
	className,
	leading = [],
	lines = [],
	trailing = [],
	linesClassName = "flex-1 space-y-1",
	trailingClassName = "flex gap-1",
}: RowSkeletonProps) {
	return (
		<div className={cn("flex items-center gap-3", className)}>
			{leading.map(renderSkeleton)}
			<div className={linesClassName}>{lines.map(renderSkeleton)}</div>
			{trailing.length > 0 && (
				<div className={trailingClassName}>{trailing.map(renderSkeleton)}</div>
			)}
		</div>
	);
}

export function GridSkeleton({
	className,
	count,
	renderItem,
}: GridSkeletonProps) {
	return (
		<div className={className}>
			{skeletonKeys("grid-item", count).map((key, index) => (
				<Fragment key={key}>{renderItem(index)}</Fragment>
			))}
		</div>
	);
}

export function PageSkeleton({ className, children }: PageSkeletonProps) {
	return <div className={cn("space-y-6", className)}>{children}</div>;
}
