"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChatInterface } from "@/components/chat/chat-interface";
import {
  ArrowLeft,
  FileText,
  Globe,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import type { Source } from "@/types";

export default function SourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { status } = useSession();
  const router = useRouter();
  const [source, setSource] = useState<Source | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  useEffect(() => {
    fetchSource();
  }, [id]);

  // Poll while processing
  useEffect(() => {
    if (source?.status === "processing") {
      const interval = setInterval(fetchSource, 3000);
      return () => clearInterval(interval);
    }
  }, [source?.status]);

  async function fetchSource() {
    try {
      const res = await fetch(`/api/sources/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("Source not found");
        } else {
          setError("Failed to load source");
        }
        return;
      }
      const data = await res.json();
      setSource(data);
    } catch {
      setError("Failed to load source");
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="text-neutral-600 dark:text-neutral-400">{error}</p>
        <Link href="/dashboard">
          <Button variant="outline">Back to dashboard</Button>
        </Link>
      </div>
    );
  }

  if (!source) return null;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Link
            href="/dashboard"
            className="rounded p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2">
            {source.type === "website" ? (
              <Globe className="h-5 w-5 text-blue-500" />
            ) : (
              <FileText className="h-5 w-5 text-orange-500" />
            )}
            <h1 className="font-semibold text-neutral-900 dark:text-white truncate">
              {source.title}
            </h1>
            <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium uppercase text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
              {source.type}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      {source.status === "processing" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-neutral-400" />
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
              Processing your source...
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              We're extracting content, generating embeddings, and indexing
              everything. This usually takes a few seconds.
            </p>
          </div>
        </div>
      ) : source.status === "failed" ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
              Processing failed
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Something went wrong while processing this source. Please try
              uploading again.
            </p>
          </div>
          <Link href="/source/new">
            <Button>Try again</Button>
          </Link>
        </div>
      ) : (
        <ChatInterface sourceId={source.id} />
      )}
    </div>
  );
}
