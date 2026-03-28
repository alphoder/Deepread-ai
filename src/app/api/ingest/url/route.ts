import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sources, chunks } from "@/lib/db/schema";
import { scrapeUrl, ScrapeError } from "@/lib/ingest/web-scraper";
import { chunkText } from "@/lib/rag/chunking";
import { parallelIngest } from "@/lib/rag/parallel-ingest";
import { eq } from "drizzle-orm";

export const maxDuration = 60;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let sourceId: string | null = null;

  try {
    const body = await request.json();
    const { url } = body;

    if (!url?.trim()) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Create source record
    const [source] = await db
      .insert(sources)
      .values({
        userId: session.user.id,
        title: new URL(url).hostname,
        type: "website",
        url,
        status: "processing",
      })
      .returning({ id: sources.id });

    sourceId = source.id;

    // Process inline (Vercel kills background tasks)
    const scraped = await scrapeUrl(url);

    if (!scraped.content || scraped.content.length < 20) {
      await db
        .update(sources)
        .set({ status: "failed" })
        .where(eq(sources.id, sourceId));
      return NextResponse.json(
        { error: `Extracted only ${scraped.content?.length || 0} characters. The site may be blocking scraping or using JavaScript rendering.` },
        { status: 400 }
      );
    }

    const allChunks = chunkText(scraped.content, { url: scraped.url })
      .slice(0, 300)
      .map((c, i) => ({ ...c, index: i }));

    // Split into 3 parallel workers for embedding + insertion
    await parallelIngest(sourceId!, allChunks);

    // Update source
    await db
      .update(sources)
      .set({
        status: "ready",
        title: scraped.title,
        metadata: { url: scraped.url },
        updatedAt: new Date(),
      })
      .where(eq(sources.id, sourceId));

    return NextResponse.json({ sourceId });
  } catch (err) {
    console.error("URL ingestion error:", err);

    if (sourceId) {
      await db
        .update(sources)
        .set({ status: "failed" })
        .where(eq(sources.id, sourceId))
        .catch(() => {});
    }

    // Return user-friendly error from ScrapeError
    if (err instanceof ScrapeError) {
      return NextResponse.json({ error: err.reason }, { status: 400 });
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add URL" },
      { status: 500 }
    );
  }
}
