import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sources, chunks } from "@/lib/db/schema";
import { scrapeUrl } from "@/lib/ingest/web-scraper";
import { chunkText } from "@/lib/rag/chunking";
import { generateEmbeddings } from "@/lib/rag/embeddings";
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

    if (!scraped.content || scraped.content.length < 50) {
      await db
        .update(sources)
        .set({ status: "failed" })
        .where(eq(sources.id, sourceId));
      return NextResponse.json(
        { error: "Could not extract enough content from the URL" },
        { status: 400 }
      );
    }

    const allChunks = chunkText(scraped.content, { url: scraped.url });

    // Generate embeddings in batches
    const batchSize = 50;
    for (let i = 0; i < allChunks.length; i += batchSize) {
      const batch = allChunks.slice(i, i + batchSize);
      const texts = batch.map((c) => c.content);
      const embeddings = await generateEmbeddings(texts);

      const values = batch.map((chunk, j) => ({
        sourceId,
        content: chunk.content,
        embedding: embeddings[j],
        pageNumber: chunk.pageNumber,
        chapter: chunk.chapter,
        section: chunk.section,
        chunkIndex: chunk.index,
        url: chunk.url,
      }));

      await db.insert(chunks).values(values);
    }

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

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to add URL" },
      { status: 500 }
    );
  }
}
