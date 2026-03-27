import mammoth from "mammoth";

export async function parseDocx(buffer: Buffer): Promise<{
  text: string;
  metadata: Record<string, unknown>;
}> {
  const result = await mammoth.extractRawText({ buffer });
  return {
    text: result.value,
    metadata: {},
  };
}
