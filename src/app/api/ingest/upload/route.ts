import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sources, chunks } from "@/lib/db/schema";
import { parsePdf } from "@/lib/ingest/pdf-loader";
import { parseTxt } from "@/lib/ingest/txt-loader";
import { parseDocx } from "@/lib/ingest/docx-loader";
import { chunkText } from "@/lib/rag/chunking";
import { parallelIngest } from "@/lib/rag/parallel-ingest";
import { eq } from "drizzle-orm";

export const maxDuration = 60;

// Limit body size to 10MB
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let sourceId: string | null = null;

  try {
    const body = await request.json();
    const { fileName, fileSize, fileData } = body;

    if (!fileName || !fileData) {
      return NextResponse.json(
        { error: "File name and data are required" },
        { status: 400 }
      );
    }

    // Check file size (10MB limit for Vercel)
    if (fileSize > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File must be under 10MB" },
        { status: 400 }
      );
    }

    // Determine file type
    const name = fileName.toLowerCase();
    let type: "pdf" | "txt" | "docx";
    if (name.endsWith(".pdf")) type = "pdf";
    else if (name.endsWith(".txt")) type = "txt";
    else if (name.endsWith(".docx")) type = "docx";
    else {
      return NextResponse.json(
        { error: "Unsupported file type. Use PDF, TXT, or DOCX." },
        { status: 400 }
      );
    }

    // Decode base64 to buffer
    const buffer = Buffer.from(fileData, "base64");

    // Create source record
    const [source] = await db
      .insert(sources)
      .values({
        userId: session.user.id,
        title: fileName.replace(/\.[^/.]+$/, ""),
        type,
        fileSize: buffer.length,
        status: "processing",
      })
      .returning({ id: sources.id });

    sourceId = source.id;

    // Parse file
    let allChunks: ReturnType<typeof chunkText> = [];
    let pageCount: number | null = null;
    let metadata: Record<string, unknown> = {};

    if (type === "pdf") {
      const parsed = await parsePdf(buffer);
      pageCount = parsed.pageCount;
      metadata = parsed.metadata;
      for (const page of parsed.pages) {
        const pageChunks = chunkText(page.content, {
          pageNumber: page.pageNumber,
        });
        allChunks.push(...pageChunks);
      }
    } else if (type === "txt") {
      const text = buffer.toString("utf-8");
      const parsed = parseTxt(text);
      for (const section of parsed.sections) {
        const sectionChunks = chunkText(section.content);
        allChunks.push(...sectionChunks);
      }
    } else if (type === "docx") {
      const parsed = await parseDocx(buffer);
      metadata = parsed.metadata;
      allChunks = chunkText(parsed.text);
    }

    if (allChunks.length === 0) {
      await db
        .update(sources)
        .set({ status: "failed" })
        .where(eq(sources.id, sourceId));
      return NextResponse.json(
        { error: "No content could be extracted from the file" },
        { status: 400 }
      );
    }

    // Re-index and limit chunks to prevent OOM
    allChunks = allChunks.slice(0, 300).map((c, i) => ({ ...c, index: i }));

    // Split into 3 parallel workers for embedding + insertion
    await parallelIngest(sourceId!, allChunks);

    // Update source to ready
    await db
      .update(sources)
      .set({
        status: "ready",
        pageCount,
        metadata,
        updatedAt: new Date(),
      })
      .where(eq(sources.id, sourceId));

    return NextResponse.json({ sourceId });
  } catch (err) {
    console.error("Upload error:", err);

    if (sourceId) {
      await db
        .update(sources)
        .set({ status: "failed" })
        .where(eq(sources.id, sourceId))
        .catch(() => {});
    }

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
