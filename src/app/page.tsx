"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Globe,
  MessageSquare,
  FileText,
  ArrowRight,
  Search,
} from "lucide-react";

export default function Home() {
  const { data: session } = useSession();

  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center gap-8 px-4 py-24 text-center sm:py-32">
        <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-1.5 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          <Search className="h-3.5 w-3.5" />
          AI-Powered Research & Analysis
        </div>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-neutral-900 dark:text-white sm:text-6xl">
          Upload a book. Paste a URL.
          <br />
          <span className="text-neutral-500 dark:text-neutral-400">
            Ask anything.
          </span>
        </h1>
        <p className="max-w-xl text-lg text-neutral-600 dark:text-neutral-400">
          DeepRead AI ingests your books and websites, then answers every
          question strictly from the source — with page-level citations. No
          hallucination. No guessing.
        </p>
        <div className="flex gap-3">
          <Link href={session ? "/dashboard" : "/auth/signin"}>
            <Button size="lg">
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 pb-24 sm:grid-cols-3">
        <FeatureCard
          icon={<FileText className="h-6 w-6" />}
          title="Upload Books"
          description="PDF, DOCX, or TXT files. We extract every page, chapter, and section with full metadata."
        />
        <FeatureCard
          icon={<Globe className="h-6 w-6" />}
          title="Scrape Websites"
          description="Paste any URL. We crawl and index the content, stripping ads and navigation noise."
        />
        <FeatureCard
          icon={<MessageSquare className="h-6 w-6" />}
          title="Source-Grounded Q&A"
          description="Every answer cites the exact page, chapter, or URL. If it's not in the source, we say so."
        />
      </section>

      {/* How it works */}
      <section className="border-t border-neutral-200 bg-neutral-50 px-4 py-24 dark:border-neutral-800 dark:bg-neutral-900/50">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-12 text-3xl font-bold text-neutral-900 dark:text-white">
            How it works
          </h2>
          <div className="grid grid-cols-1 gap-8 text-left sm:grid-cols-3">
            <Step
              number="1"
              title="Upload or paste"
              description="Upload a PDF, DOCX, or TXT file — or paste a website URL."
            />
            <Step
              number="2"
              title="We ingest & index"
              description="Content is chunked, embedded, and stored in your private knowledge base."
            />
            <Step
              number="3"
              title="Ask anything"
              description="Chat with your source. Get answers with citations back to the original."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-200 px-4 py-8 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
        <div className="flex items-center justify-center gap-2">
          <BookOpen className="h-4 w-4" />
          DeepRead AI
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950">
      <div className="mb-3 text-neutral-900 dark:text-white">{icon}</div>
      <h3 className="mb-2 text-lg font-semibold text-neutral-900 dark:text-white">
        {title}
      </h3>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {description}
      </p>
    </div>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-sm font-bold text-white dark:bg-white dark:text-neutral-900">
        {number}
      </div>
      <h3 className="mb-1 font-semibold text-neutral-900 dark:text-white">
        {title}
      </h3>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {description}
      </p>
    </div>
  );
}
