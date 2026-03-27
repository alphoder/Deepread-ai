"use client";

import { FileText, Globe } from "lucide-react";
import type { Citation } from "@/types";

export function CitationCard({ citation }: { citation: Citation }) {
  const location = [
    citation.pageNumber && `Page ${citation.pageNumber}`,
    citation.chapter,
    citation.section,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-1.5 flex items-center gap-2">
        {citation.url ? (
          <Globe className="h-3.5 w-3.5 text-blue-500" />
        ) : (
          <FileText className="h-3.5 w-3.5 text-orange-500" />
        )}
        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          {citation.url ? citation.url : location || "Source"}
        </span>
      </div>
      <p className="text-neutral-700 dark:text-neutral-300 line-clamp-3">
        {citation.content}
      </p>
    </div>
  );
}
