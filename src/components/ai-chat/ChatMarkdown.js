"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ChatMarkdown({ content }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none text-foreground prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-a:text-foreground prose-blockquote:text-foreground prose-p:my-1 prose-li:my-0 prose-headings:mb-1 prose-headings:mt-2 prose-pre:bg-muted prose-pre:rounded-lg prose-table:text-sm prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-code:before:content-none prose-code:after:content-none prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
