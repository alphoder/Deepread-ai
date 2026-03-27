export type SourceType = "pdf" | "txt" | "docx" | "website";

export type SourceStatus = "processing" | "ready" | "failed";

export interface Source {
  id: string;
  userId: string;
  title: string;
  type: SourceType;
  url: string | null;
  fileSize: number | null;
  pageCount: number | null;
  status: SourceStatus;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[] | null;
  createdAt: Date;
}

export interface Citation {
  chunkId: string;
  content: string;
  pageNumber: number | null;
  chapter: string | null;
  section: string | null;
  url: string | null;
}

export interface Conversation {
  id: string;
  userId: string;
  sourceId: string;
  title: string;
  createdAt: Date;
}

export interface ChunkWithScore {
  id: string;
  content: string;
  pageNumber: number | null;
  chapter: string | null;
  section: string | null;
  url: string | null;
  score: number;
}
