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
        "text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap",
        "prose prose-sm prose-invert max-w-none",
        "[&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&>ul]:pl-4 [&>ol]:pl-4",
        "[&>h1]:text-sm [&>h2]:text-sm [&>h3]:text-xs",
        "[&>pre]:bg-muted [&>pre]:rounded [&>pre]:p-2 [&>pre]:overflow-x-auto",
        "[&>blockquote]:border-l-2 [&>blockquote]:border-muted-foreground/40 [&>blockquote]:pl-3 [&>blockquote]:italic",
        "[&_a]:text-blue-400 [&_a]:underline [&_a:hover]:text-blue-300",
        "[&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_code]:text-[11px] [&_code]:font-mono",
        "[&_img]:rounded [&_img]:max-w-full [&_img]:max-h-64 [&_img]:object-contain",
        "[&_strong]:text-foreground [&_em]:text-muted-foreground/80",
        className
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
    return parts.map((part, i) =>
      /^@[a-z0-9-]+$/.test(part) ? (
        <span key={i} className="text-blue-400 font-medium">
          {part}
        </span>
      ) : (
        part
      )
    );
  }
  if (Array.isArray(children)) {
    return children.map((child, i) =>
      typeof child === "string" ? highlightMentions(child) : child
    );
  }
  return children;
}
