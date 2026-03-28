"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Plus,
  FileText,
  Globe,
  Loader2,
  Trash2,
  MessageSquare,
} from "lucide-react";
import type { Source } from "@/types";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetchSources();
    }
  }, [session]);

  async function fetchSources() {
    try {
      const res = await fetch("/api/sources");
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const data = await res.json();
          setSources(data);
        }
      }
    } catch (err) {
      console.error("Failed to fetch sources:", err);
    } finally {
      setLoading(false);
    }
  }

  async function deleteSource(id: string) {
    if (!confirm("Delete this source and all its data?")) return;
    const res = await fetch(`/api/sources/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSources((prev) => prev.filter((s) => s.id !== id));
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
            Your Sources
          </h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            Upload books or add websites to your knowledge base.
          </p>
        </div>
        <Link href="/source/new">
          <Button>
            <Plus className="h-4 w-4" />
            Add Source
          </Button>
        </Link>
      </div>

      {sources.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50 py-20 text-center dark:border-neutral-700 dark:bg-neutral-900/50">
          <FileText className="mb-4 h-10 w-10 text-neutral-400" />
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
            No sources yet
          </h3>
          <p className="mt-1 mb-4 max-w-xs text-sm text-neutral-500">
            Upload a PDF, DOCX, or TXT file — or paste a website URL to get
            started.
          </p>
          <Link href="/source/new">
            <Button>
              <Plus className="h-4 w-4" />
              Add your first source
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((source) => (
            <div
              key={source.id}
              className="group relative rounded-xl border border-neutral-200 bg-white p-5 transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-950"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {source.type === "website" ? (
                    <Globe className="h-5 w-5 text-blue-500" />
                  ) : (
                    <FileText className="h-5 w-5 text-orange-500" />
                  )}
                  <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium uppercase text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                    {source.type}
                  </span>
                </div>
                <button
                  onClick={() => deleteSource(source.id)}
                  className="rounded p-1 text-neutral-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <h3 className="mb-1 font-semibold text-neutral-900 dark:text-white line-clamp-2">
                {source.title}
              </h3>

              {source.status === "processing" ? (
                <div className="mt-3 flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Processing...
                </div>
              ) : source.status === "failed" ? (
                <p className="mt-3 text-sm text-red-500">
                  Failed to process
                </p>
              ) : (
                <Link href={`/source/${source.id}`}>
                  <Button variant="outline" size="sm" className="mt-3">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Chat with source
                  </Button>
                </Link>
              )}

              <p className="mt-3 text-xs text-neutral-400">
                {new Date(source.createdAt).toLocaleDateString()}
                {source.pageCount && ` · ${source.pageCount} pages`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
