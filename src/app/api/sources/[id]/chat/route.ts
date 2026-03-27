import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sources, conversations } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { querySources } from "@/lib/rag/chain";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: sourceId } = await params;

  // Verify ownership
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

  const body = await request.json();
  const { message, conversationId } = body;

  if (!message?.trim()) {
    return NextResponse.json(
      { error: "Message is required" },
      { status: 400 }
    );
  }

  // Get or create conversation
  let convId = conversationId;
  if (!convId) {
    const [conv] = await db
      .insert(conversations)
      .values({
        userId: session.user.id,
        sourceId,
        title: message.slice(0, 100),
      })
      .returning({ id: conversations.id });
    convId = conv.id;
  }

  const { stream } = await querySources(sourceId, message, convId);

  // Return streaming response with conversation ID header
  const response = stream;
  response.headers.set("X-Conversation-Id", convId);
  return response;
}
