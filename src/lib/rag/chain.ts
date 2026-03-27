import { createGroq } from "@ai-sdk/groq";
import { streamText } from "ai";
import { db } from "@/lib/db";
import { chunks, messages as messagesTable, conversations } from "@/lib/db/schema";
import { eq, sql, desc, and } from "drizzle-orm";
import { generateEmbedding } from "./embeddings";
import { SYSTEM_PROMPT, buildUserPrompt, formatContext, formatChatHistory } from "./prompts";

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

const TOP_K = 5;

export async function querySources(
  sourceId: string,
  question: string,
  conversationId: string
) {
  // 1. Generate embedding for the question
  const queryEmbedding = await generateEmbedding(question);

  // 2. Search for similar chunks using pgvector cosine similarity
  const similarChunks = await db
    .select({
      id: chunks.id,
      content: chunks.content,
      pageNumber: chunks.pageNumber,
      chapter: chunks.chapter,
      section: chunks.section,
      url: chunks.url,
      similarity: sql<number>`1 - (${chunks.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector)`,
    })
    .from(chunks)
    .where(eq(chunks.sourceId, sourceId))
    .orderBy(sql`${chunks.embedding} <=> ${JSON.stringify(queryEmbedding)}::vector`)
    .limit(TOP_K);

  // 3. Get conversation history
  const history = await db
    .select({
      role: messagesTable.role,
      content: messagesTable.content,
    })
    .from(messagesTable)
    .where(eq(messagesTable.conversationId, conversationId))
    .orderBy(messagesTable.createdAt);

  // 4. Build the prompt
  const context = formatContext(similarChunks);
  const chatHistory = formatChatHistory(history);
  const userPrompt = buildUserPrompt(question, context, chatHistory);

  // 5. Save the user message
  await db.insert(messagesTable).values({
    conversationId,
    role: "user",
    content: question,
  });

  // 6. Stream the response
  const result = streamText({
    model: groq("llama-3.3-70b-versatile"),
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.2,
    maxOutputTokens: 2048,
    async onFinish({ text }) {
      // Build citations from the chunks used
      const citations = similarChunks.map((chunk) => ({
        chunkId: chunk.id,
        content: chunk.content.slice(0, 200),
        pageNumber: chunk.pageNumber,
        chapter: chunk.chapter,
        section: chunk.section,
        url: chunk.url,
      }));

      // Save the assistant message with citations
      await db.insert(messagesTable).values({
        conversationId,
        role: "assistant",
        content: text,
        citations,
      });
    },
  });

  return {
    stream: result.toTextStreamResponse(),
    sources: similarChunks,
  };
}
