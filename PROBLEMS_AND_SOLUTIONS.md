# DeepRead AI — Problems Encountered & Solutions

A running log of every significant bug, error, and architectural problem hit during development, and exactly how each was fixed.

---

## 1. Vercel Build — "No Output Directory named public"

**Problem:** Vercel couldn't build the project. Error: `No Output Directory named 'public' was found after the Build completed.`

**Root cause:** Vercel's auto-detection picked the wrong framework (static site instead of Next.js).

**Fix:** In Vercel dashboard → Project Settings → General → Framework Preset, manually set to **Next.js**.

---

## 2. Google OAuth — `redirect_uri_mismatch` (Error 400)

**Problem:** After signing in with Google, the OAuth callback failed with `redirect_uri_mismatch`.

**Root cause:** Google Cloud Console only had `http://localhost:3000/api/auth/callback/google` as an allowed redirect URI. The production URL was missing.

**Fix:**
1. Added `https://g-ita-guru.vercel.app/api/auth/callback/google` to Google Cloud Console → Credentials → OAuth 2.0 Client → Authorized redirect URIs.
2. Set `NEXTAUTH_URL=https://g-ita-guru.vercel.app` in Vercel environment variables.

---

## 3. NextAuth 500 — "Configuration" error on sign-in

**Problem:** Sign-in returned a 500 Configuration error.

**Root cause:** The database tables (`users`, `accounts`, `sessions`, etc.) didn't exist in Neon yet. Drizzle ORM schema had not been pushed.

**Fix:**
1. Enabled pgvector extension in Neon: `CREATE EXTENSION IF NOT EXISTS vector;`
2. Ran `npx drizzle-kit push` to create all tables.

**Note:** `drizzle-kit` doesn't read `.env.local` — had to copy env vars to `.env` and add `import "dotenv/config"` to `drizzle.config.ts`.

---

## 4. Upload 500 — "Content-Type was not multipart/form-data"

**Problem:** `POST /api/ingest/upload` returned 500. Vercel logs: `"Content-Type was not multipart/form-data"`.

**Root cause:** Vercel's serverless runtime was stripping or mangling the `multipart/form-data` boundary from the request headers.

**Fix:** Added `export const runtime = "nodejs"` to the upload route. This forces the full Node.js runtime instead of the Edge runtime, which handles FormData correctly.

---

## 5. Upload 500 — JSON SyntaxError "No number after minus sign"

**Problem:** After switching from FormData to a base64 JSON approach (to work around FormData issues), upload failed with `SyntaxError: No number after minus sign in JSON at position 1`.

**Root cause:** Using `btoa()` on a binary PDF buffer corrupts binary data — `btoa` is for ASCII strings only.

**Fix:** Reverted back to FormData (with `runtime = "nodejs"` from fix #4).

---

## 6. Upload 500 — `pdf-parse` crashes on Vercel cold start

**Problem:** `pdf-parse` threw an error immediately on import (before any file was even uploaded).

**Root cause:** `pdf-parse/index.js` reads a test PDF file at `require()` time when `module.parent` is falsy (which is always true in Vercel serverless). This crashes the cold start.

**Fix:** Import the internal module directly, bypassing the test-file logic:
```typescript
const pdf = require("pdf-parse/lib/pdf-parse.js");
```

---

## 7. Upload 500 — `pdf-parse` version breaking change

**Problem:** After updating packages, `pdf-parse` stopped working — the import was returning a class instead of a callable function.

**Root cause:** `pdf-parse` v2 changed its export from a function to a class-based API.

**Fix:** Pinned to `pdf-parse@1.1.1` in `package.json`.

---

## 8. TypeScript — `maxTokens` does not exist

**Problem:** TypeScript error: `Object literal may only specify known properties, and 'maxTokens' does not exist`.

**Root cause:** The AI SDK (`ai` package) uses `maxOutputTokens`, not `maxTokens`.

**Fix:** Renamed `maxTokens` → `maxOutputTokens` in `src/lib/rag/chain.ts`.

---

## 9. TypeScript — `toDataStreamResponse` does not exist

**Problem:** TypeScript error on `result.toDataStreamResponse()`.

**Root cause:** This AI SDK version uses `toTextStreamResponse()`, not `toDataStreamResponse()`.

**Fix:** Changed to `result.toTextStreamResponse()`.

---

## 10. TypeScript — `sourceId: string | null` not assignable

**Problem:** TypeScript complained that `sourceId` (typed as `string | null`) could not be passed where `string` was expected.

**Fix:** Used non-null assertion `sourceId!` at the call site after the null check guard.

---

## 11. Frontend — Unexpected token `<` — JSON parse error

**Problem:** The frontend threw `Unexpected token '<'... is not valid JSON` when the upload or URL ingestion failed.

**Root cause:** When the API returned an auth error (401/500), it sent an HTML error page. The frontend called `res.json()` unconditionally, which failed on HTML.

**Fix:** Checked `Content-Type` header before calling `.json()`:
```typescript
const contentType = res.headers.get("content-type") || "";
if (contentType.includes("application/json")) {
  const data = await res.json();
  throw new Error(data.error || "failed");
}
```

---

## 12. Web Scraper — "Could not extract enough content from URL"

**Problem:** Scraping many websites returned almost no text.

**Root cause:** Many modern sites are JavaScript-rendered. Simple `fetch` + cheerio only gets the static HTML shell, which is often nearly empty.

**Fix:** Integrated Apify's Actor API (`apify/website-content-crawler`) as primary scraper, with cheerio as fallback. If `APIFY_API_TOKEN` is set in env, the Apify path is used.

---

## 13. Upload OOM — Vercel function killed (root cause: pdf-parse / PDF.js)

**Problem:** `POST /api/ingest/upload` returned 500 with Vercel log: `"Vercel Runtime Error: instance was killed because it ran out of available memory"`. Happened even with a 1.1 MB PDF.

**Root cause (final):** `pdf-parse` bundles `pdfjs-dist` (PDF.js), an ~8 MB JavaScript library that builds a full in-memory document model when parsing. On Vercel's serverless runtime, combined with Next.js baseline overhead, this consistently exceeded available memory.

**Things that did NOT fix it:**
- Reducing chunk limit (300 → 150 → 100) — chunks are tiny, not the problem
- Switching from parallel to sequential embedding — embeddings were never the issue
- Adding `max: 20` pages option — PDF.js still partially loads the full document before stopping
- Reducing PDF file size limit to 2 MB — 1.1 MB was already under that limit

**Actual fix:** Moved PDF parsing out of Vercel entirely into a **standalone Railway microservice** (`pdf-parser/`).
- Railway service runs Express + pdf-parse with full memory available
- Vercel upload route sends the PDF buffer via HTTP `POST /parse`
- Gets back plain text `{ pages, pageCount, metadata }`
- Vercel then does chunking + embedding (lightweight) locally

**Architecture change:**
```
Before: Vercel → pdf-parse (OOM)
After:  Vercel → HTTP POST → Railway pdf-parser → text → Vercel (chunk + embed)
```

---

## Environment Variables Required

| Variable | Where | Purpose |
|---|---|---|
| `DATABASE_URL` | Vercel | Neon PostgreSQL connection string |
| `NEXTAUTH_URL` | Vercel | Production URL for NextAuth callbacks |
| `NEXTAUTH_SECRET` | Vercel | Random secret for session signing |
| `GOOGLE_CLIENT_ID` | Vercel | Google OAuth app ID |
| `GOOGLE_CLIENT_SECRET` | Vercel | Google OAuth app secret |
| `GROQ_API_KEY` | Vercel | Groq LLM API key |
| `PDF_PARSER_URL` | Vercel | Railway service URL (e.g. `https://pdf-parser.up.railway.app`) |
| `PARSER_SECRET` | Vercel + Railway | Shared secret to authenticate parser requests |
| `APIFY_API_TOKEN` | Vercel (optional) | Enables JS-rendered website scraping |
| `OPENAI_API_KEY` | Vercel (optional) | Enables real semantic embeddings (vs hash-based) |
