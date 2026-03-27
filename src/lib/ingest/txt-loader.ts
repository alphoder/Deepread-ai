export interface ParsedSection {
  content: string;
  lineStart: number;
}

export function parseTxt(text: string): {
  sections: ParsedSection[];
} {
  // Split by double newlines to get paragraphs
  const paragraphs = text.split(/\n{2,}/);
  let lineNumber = 1;
  const sections: ParsedSection[] = [];

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (trimmed.length > 0) {
      sections.push({ content: trimmed, lineStart: lineNumber });
    }
    lineNumber += para.split("\n").length + 1;
  }

  return { sections };
}
