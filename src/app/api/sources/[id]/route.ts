import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sources, chunks, conversations, messages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

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
    .select()
    .from(sources)
    .where(and(eq(sources.id, id), eq(sources.userId, session.user.id)));

  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  return NextResponse.json(source);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify ownership
  const [source] = await db
    .select()
    .from(sources)
    .where(and(eq(sources.id, id), eq(sources.userId, session.user.id)));

  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  // Cascade delete handles chunks, conversations, messages
  await db.delete(sources).where(eq(sources.id, id));

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify ownership
  const [source] = await db
    .select()
    .from(sources)
    .where(and(eq(sources.id, id), eq(sources.userId, session.user.id)));

  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 });
  }

  const body = await request.json();
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (body.title?.trim()) {
    updates.title = body.title.trim();
  }
  if (body.metadata && typeof body.metadata === "object") {
    updates.metadata = { ...source.metadata, ...body.metadata };
  }

  await db.update(sources).set(updates).where(eq(sources.id, id));

  const [updated] = await db
    .select()
    .from(sources)
    .where(eq(sources.id, id));

  return NextResponse.json(updated);
}
