import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sources, chunks } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { createGroq } from "@ai-sdk/groq";
import { streamText } from "ai";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sourceId } = await params;

  // Verify ownership and status
  const [source] = await db
    .select()
    .from(sources)
    .where(
      and(eq(sources.id, sourceId), eq(sources.userId, session.user.id))
    );

  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  if (source.status !== "ready") {
    return NextResponse.json(
      { error: "Source is still processing" },
      { status: 400 }
    );
  }

  // Get all chunks in order (limit to first ~50 for context window)
  const sourceChunks = await db
    .select({ content: chunks.content, chunkIndex: chunks.chunkIndex })
    .from(chunks)
    .where(eq(chunks.sourceId, sourceId))
    .orderBy(asc(chunks.chunkIndex))
    .limit(50);

  const combinedContent = sourceChunks
    .map((c) => c.content)
    .join("\n\n");

  // Trim to fit context window (~12k chars)
  const trimmedContent = combinedContent.slice(0, 12000);

  const result = streamText({
    model: groq("llama-3.3-70b-versatile"),
    system: `You are a research assistant. Summarize the provided source material comprehensively.

Your summary MUST:
1. Cover all major topics, themes, and arguments in the source
2. Be structured with clear headings and bullet points
3. Highlight key findings, data points, and conclusions
4. Note the overall structure of the source (chapters, sections, etc.)
5. Be based ONLY on the provided content — do not add outside knowledge

Format the summary in markdown.`,
    prompt: `Summarize the following source material:\n\n---\n${trimmedContent}\n---`,
    temperature: 0.2,
    maxOutputTokens: 2048,
  });

  return result.toTextStreamResponse();
}
