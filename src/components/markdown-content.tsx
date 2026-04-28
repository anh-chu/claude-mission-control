"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

interface MarkdownContentProps {
	content: string;
	className?: string;
}

/**
 * Renders markdown content with GFM support (tables, strikethrough, task lists).
 * @-mentions are highlighted in blue.
 * Used for task/action descriptions and comment bodies.
 */
export function MarkdownContent({ content, className }: MarkdownContentProps) {
	return (
		<div
			className={cn(
				"text-xs text-muted-foreground leading-relaxed",
				"prose prose-sm prose-invert max-w-none",
				"[&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&>ul]:pl-4 [&>ol]:pl-4",
				"[&>h1]:text-base [&>h1]:font-semibold [&>h1]:mt-3 [&>h1]:mb-1.5",
				"[&>h2]:text-sm [&>h2]:font-semibold [&>h2]:mt-2.5 [&>h2]:mb-1 [&>h2]:text-foreground/80",
				"[&>h3]:text-xs [&>h3]:font-semibold [&>h3]:mt-2 [&>h3]:mb-0.5 [&>h3]:uppercase [&>h3]:tracking-wide [&>h3]:text-muted-foreground",
				"[&>pre]:bg-muted [&>pre]:rounded-sm [&>pre]:p-2 [&>pre]:overflow-x-auto",
				"[&>blockquote]:border-l-2 [&>blockquote]:border-muted-foreground/40 [&>blockquote]:pl-3 [&>blockquote]:italic",
				"[&_a]:text-accent [&_a]:underline [&_a:hover]:text-accent/80",
				"[&_code]:bg-muted [&_code]:rounded-sm [&_code]:px-1 [&_code]:text-[11px] [&_code]:font-mono",
				"[&_img]:rounded-sm [&_img]:max-w-full [&_img]:max-h-64 [&_img]:object-contain",
				"[&_strong]:text-foreground [&_em]:text-muted-foreground/80",
				className,
			)}
		>
			<ReactMarkdown
				remarkPlugins={[remarkGfm]}
				components={{
					p({ children }) {
						return <p className="my-1">{highlightMentions(children)}</p>;
					},
					li({ children }) {
						return <li>{highlightMentions(children)}</li>;
					},
					a({ href, children }) {
						return (
							<a href={href} target="_blank" rel="noopener noreferrer">
								{children}
							</a>
						);
					},
				}}
			>
				{content}
			</ReactMarkdown>
		</div>
	);
}

/**
 * Recursively highlights @mention tokens in React children.
 */
function highlightMentions(children: React.ReactNode): React.ReactNode {
	if (typeof children === "string") {
		const parts = children.split(/(@[a-z0-9-]+)/g);
		if (parts.length === 1) return children;
		return parts.map((part, i) => {
			if (/^@[a-z0-9-]+$/.test(part))
				return (
					<span key={`${part}_${i}`} className="text-accent font-normal">
						{part}
					</span>
				);
			return part;
		});
	}
	if (Array.isArray(children)) {
		return children.map((child) =>
			typeof child === "string" ? highlightMentions(child) : child,
		);
	}
	return children;
}
