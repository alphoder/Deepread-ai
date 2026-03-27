export interface Chunk {
  content: string;
  index: number;
  pageNumber: number | null;
  chapter: string | null;
  section: string | null;
  url: string | null;
}

const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_CHUNK_OVERLAP = 200;

export function chunkText(
  text: string,
  options?: {
    chunkSize?: number;
    chunkOverlap?: number;
    pageNumber?: number | null;
    chapter?: string | null;
    section?: string | null;
    url?: string | null;
  }
): Chunk[] {
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const chunkOverlap = options?.chunkOverlap ?? DEFAULT_CHUNK_OVERLAP;

  if (text.length <= chunkSize) {
    return [
      {
        content: text.trim(),
        index: 0,
        pageNumber: options?.pageNumber ?? null,
        chapter: options?.chapter ?? null,
        section: options?.section ?? null,
        url: options?.url ?? null,
      },
    ];
  }

  const chunks: Chunk[] = [];
  let start = 0;
  let index = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    // Try to break at a sentence or paragraph boundary
    if (end < text.length) {
      const slice = text.slice(start, end + 100);
      const sentenceEnd = slice.lastIndexOf(". ");
      const paragraphEnd = slice.lastIndexOf("\n\n");
      const breakPoint = Math.max(sentenceEnd, paragraphEnd);

      if (breakPoint > chunkSize * 0.5) {
        end = start + breakPoint + 1;
      }
    } else {
      end = text.length;
    }

    const content = text.slice(start, end).trim();
    if (content.length > 0) {
      chunks.push({
        content,
        index,
        pageNumber: options?.pageNumber ?? null,
        chapter: options?.chapter ?? null,
        section: options?.section ?? null,
        url: options?.url ?? null,
      });
      index++;
    }

    start = end - chunkOverlap;
    if (start >= text.length) break;
  }

  return chunks;
}
