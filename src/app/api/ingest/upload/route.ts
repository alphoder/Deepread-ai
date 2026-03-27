import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sources, chunks } from "@/lib/db/schema";
import { parsePdf } from "@/lib/ingest/pdf-loader";
import { parseTxt } from "@/lib/ingest/txt-loader";
import { parseDocx } from "@/lib/ingest/docx-loader";
import { chunkText } from "@/lib/rag/chunking";
import { generateEmbeddings } from "@/lib/rag/embeddings";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Determine file type
    const name = file.name.toLowerCase();
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

    // Create source record (processing state)
    const [source] = await db
      .insert(sources)
      .values({
        userId: session.user.id,
        title: file.name.replace(/\.[^/.]+$/, ""),
        type,
        fileSize: file.size,
        status: "processing",
      })
      .returning({ id: sources.id });

    // Process in background (non-blocking)
    processFile(source.id, file, type).catch(async (err) => {
      console.error("Ingestion failed:", err);
      await db
        .update(sources)
        .set({ status: "failed" })
        .where(eq(sources.id, source.id));
    });

    return NextResponse.json({ sourceId: source.id });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Upload failed" },
      { status: 500 }
    );
  }
}

async function processFile(
  sourceId: string,
  file: File,
  type: "pdf" | "txt" | "docx"
) {
  const buffer = Buffer.from(await file.arrayBuffer());
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
    return;
  }

  // Re-index chunks
  allChunks = allChunks.map((c, i) => ({ ...c, index: i }));

  // Generate embeddings in batches of 50
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
}
