import { createGroq } from "@ai-sdk/groq";
import { embed, embedMany } from "ai";

// We use Groq for chat but need an embedding model.
// Using a simple approach: call an embedding API.
// For now, we'll use a lightweight local approach with the AI SDK.

const groq = createGroq({ apiKey: process.env.GROQ_API_KEY });

// Since Groq doesn't provide embeddings, we'll use a simple
// TF-IDF-like approach for vector similarity via Neon's pgvector.
// In production, swap this for OpenAI embeddings or a HuggingFace model.

// For this implementation, we'll use a hash-based embedding approach
// that generates consistent 1536-dim vectors from text.

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash;
}

function simpleEmbed(text: string): number[] {
  const dimensions = 1536;
  const vector = new Array(dimensions).fill(0);
  const words = text.toLowerCase().split(/\s+/);

  for (const word of words) {
    const h = Math.abs(hashCode(word));
    for (let i = 0; i < 8; i++) {
      const idx = (h + i * 191) % dimensions;
      vector[idx] += 1;
    }
  }

  // Normalize
  const magnitude = Math.sqrt(
    vector.reduce((sum: number, v: number) => sum + v * v, 0)
  );
  if (magnitude > 0) {
    for (let i = 0; i < dimensions; i++) {
      vector[i] /= magnitude;
    }
  }

  return vector;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  // If OPENAI_API_KEY is set, use OpenAI embeddings for better quality
  if (process.env.OPENAI_API_KEY) {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: text.slice(0, 8000),
      }),
    });
    const data = await response.json();
    return data.data[0].embedding;
  }

  // Fallback to simple hash-based embeddings
  return simpleEmbed(text);
}

export async function generateEmbeddings(
  texts: string[]
): Promise<number[][]> {
  if (process.env.OPENAI_API_KEY) {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        input: texts.map((t) => t.slice(0, 8000)),
      }),
    });
    const data = await response.json();
    return data.data.map((d: { embedding: number[] }) => d.embedding);
  }

  return texts.map(simpleEmbed);
}
