import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sources } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userSources = await db
    .select()
    .from(sources)
    .where(eq(sources.userId, session.user.id))
    .orderBy(desc(sources.createdAt));

  return NextResponse.json(userSources);
}
