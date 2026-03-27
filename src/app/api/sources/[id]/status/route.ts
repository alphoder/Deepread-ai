import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sources, chunks } from "@/lib/db/schema";
import { eq, and, count } from "drizzle-orm";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [source] = await db
    .select({
      id: sources.id,
      status: sources.status,
      title: sources.title,
      type: sources.type,
      pageCount: sources.pageCount,
      updatedAt: sources.updatedAt,
    })
    .from(sources)
    .where(and(eq(sources.id, id), eq(sources.userId, session.user.id)));

  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  // Get chunk count for ready sources
  let chunkCount = 0;
  if (source.status === "ready") {
    const [result] = await db
      .select({ count: count() })
      .from(chunks)
      .where(eq(chunks.sourceId, id));
    chunkCount = result.count;
  }

  return NextResponse.json({
    id: source.id,
    status: source.status,
    title: source.title,
    type: source.type,
    pageCount: source.pageCount,
    chunkCount,
    updatedAt: source.updatedAt,
  });
}
