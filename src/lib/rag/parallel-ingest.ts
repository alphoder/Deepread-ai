import { db } from "@/lib/db";
import { chunks } from "@/lib/db/schema";
import { generateEmbeddings } from "./embeddings";
import type { Chunk } from "./chunking";

interface ChunkWithEmbedding {
  sourceId: string;
  content: string;
  embedding: number[];
  pageNumber: number | null;
  chapter: string | null;
  section: string | null;
  chunkIndex: number;
  url: string | null;
}

/**
 * Split chunks into 3 parallel workers, generate embeddings concurrently,
 * then merge and insert all into the database.
 */
export async function parallelIngest(
  sourceId: string,
  allChunks: Chunk[]
): Promise<void> {
  if (allChunks.length === 0) return;

  // Split into 3 roughly equal groups
  const groupSize = Math.ceil(allChunks.length / 3);
  const group1 = allChunks.slice(0, groupSize);
  const group2 = allChunks.slice(groupSize, groupSize * 2);
  const group3 = allChunks.slice(groupSize * 2);

  // Run all 3 agents in parallel
  const [result1, result2, result3] = await Promise.all([
    processGroup(sourceId, group1),
    processGroup(sourceId, group2),
    processGroup(sourceId, group3),
  ]);

  // Merge results from all 3 agents
  const allResults = [...result1, ...result2, ...result3];

  // Insert into database in batches of 20
  const insertBatch = 20;
  for (let i = 0; i < allResults.length; i += insertBatch) {
    const batch = allResults.slice(i, i + insertBatch);
    await db.insert(chunks).values(batch);
  }
}

/**
 * Single worker: generates embeddings for a group of chunks.
 * Each worker processes its chunks in small batches to stay within memory.
 */
async function processGroup(
  sourceId: string,
  group: Chunk[]
): Promise<ChunkWithEmbedding[]> {
  if (group.length === 0) return [];

  const results: ChunkWithEmbedding[] = [];
  const batchSize = 10;

  for (let i = 0; i < group.length; i += batchSize) {
    const batch = group.slice(i, i + batchSize);
    const texts = batch.map((c) => c.content);
    const embeddings = await generateEmbeddings(texts);

    for (let j = 0; j < batch.length; j++) {
      results.push({
        sourceId,
        content: batch[j].content,
        embedding: embeddings[j],
        pageNumber: batch[j].pageNumber,
        chapter: batch[j].chapter,
        section: batch[j].section,
        chunkIndex: batch[j].index,
        url: batch[j].url,
      });
    }
  }

  return results;
}
