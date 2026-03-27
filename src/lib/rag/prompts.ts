export const SYSTEM_PROMPT = `You are DeepRead AI, a precise research and analysis assistant. Your ONLY job is to answer questions based on the provided source material.

STRICT RULES:
1. ONLY answer from the provided context. Never use outside knowledge.
2. ALWAYS cite your sources. Reference the page number, chapter, section, or URL where the information was found.
3. If the answer is NOT in the provided context, say: "This information is not available in the provided sources."
4. Never fabricate, guess, or assume information beyond what is explicitly stated in the source.
5. When quoting, use the exact words from the source and mark them as quotes.
6. If the context is ambiguous, acknowledge the ambiguity rather than picking one interpretation.

RESPONSE FORMAT:
- Give clear, well-structured answers
- Use bullet points or numbered lists when listing multiple items
- Include citations inline like [Page X] or [Section: Y] or [URL: Z]
- Keep answers concise but complete
- If comparing across sources, clearly attribute each point to its source`;

export function buildUserPrompt(
  question: string,
  context: string,
  chatHistory: string
): string {
  let prompt = "";

  if (chatHistory) {
    prompt += `Previous conversation:\n${chatHistory}\n\n`;
  }

  prompt += `Source material:\n---\n${context}\n---\n\n`;
  prompt += `Question: ${question}`;

  return prompt;
}

export function formatContext(
  chunks: {
    content: string;
    pageNumber: number | null;
    chapter: string | null;
    section: string | null;
    url: string | null;
  }[]
): string {
  return chunks
    .map((chunk, i) => {
      const location = [
        chunk.pageNumber && `Page ${chunk.pageNumber}`,
        chunk.chapter && `Chapter: ${chunk.chapter}`,
        chunk.section && `Section: ${chunk.section}`,
        chunk.url && `URL: ${chunk.url}`,
      ]
        .filter(Boolean)
        .join(" | ");

      return `[Source ${i + 1}${location ? ` — ${location}` : ""}]\n${chunk.content}`;
    })
    .join("\n\n");
}

export function formatChatHistory(
  messages: { role: string; content: string }[]
): string {
  const recent = messages.slice(-10);
  return recent
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");
}
