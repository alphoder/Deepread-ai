import * as cheerio from "cheerio";

export interface ScrapedPage {
  title: string;
  content: string;
  url: string;
}

export async function scrapeUrl(url: string): Promise<ScrapedPage> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; DeepReadBot/1.0; +https://deepread.ai)",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  // Remove non-content elements
  $(
    "script, style, nav, footer, header, aside, iframe, noscript, .nav, .footer, .header, .sidebar, .menu, .ad, .advertisement, .cookie-banner"
  ).remove();

  // Extract title
  const title =
    $("title").text().trim() ||
    $("h1").first().text().trim() ||
    new URL(url).hostname;

  // Try to find main content area
  const mainSelectors = [
    "main",
    "article",
    "[role='main']",
    ".content",
    ".post-content",
    ".article-content",
    ".entry-content",
    "#content",
    "#main",
  ];

  let content = "";
  for (const selector of mainSelectors) {
    const el = $(selector);
    if (el.length > 0) {
      content = el.text().trim();
      break;
    }
  }

  // Fallback to body text
  if (!content) {
    content = $("body").text().trim();
  }

  // Clean up whitespace
  content = content.replace(/\s+/g, " ").replace(/\n{3,}/g, "\n\n");

  return { title, content, url };
}
