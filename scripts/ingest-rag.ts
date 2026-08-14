/**
 * One-off / re-runnable ingestion script that loads curriculum documents into
 * Pinecone so the Humanities / Science chatbots can do real RAG.
 *
 * Folder layout (create these and drop your source docs in):
 *   rag-docs/
 *     water-resources/*.md | *.txt
 *     anti-japanese-war/*.md | *.txt
 *     circuit/*.md | *.txt
 *     aerospace/*.md | *.txt
 *
 * Each sub-folder name is used as the Pinecone namespace (matching the topic
 * slug in /api/humanities-topic/<topic> and /api/science-topic/<topic>).
 *
 * IMPORTANT — the index this writes to must match the one the app reads.
 * At query time the index name is NOT taken from PINECONE_INDEX: lib/rag.ts
 * hardcodes it per topic in RAG_SOURCES, which currently holds two entries,
 * `circuit -> index "science"` and `aerospace -> index "aerospace26"`. So
 * ingesting with the default PINECONE_INDEX ("ai-qef-knowledge") produces
 * vectors nothing ever queries, and the remaining topic folders above have no
 * RAG wired up at all. To make circuit work: PINECONE_INDEX=science; for
 * aerospace: PINECONE_INDEX=aerospace26. To add a topic, add it to RAG_SOURCES.
 *
 * NOTE — this script upserts into a namespace named after the sub-folder, while
 * RAG_SOURCES currently reads the *default* namespace for both topics (neither
 * sets `namespace`). If you ingest with this script, either set `namespace` on
 * the source in lib/rag.ts or upsert into the default namespace instead.
 *
 * RAG is optional — without PINECONE_API_KEY the chatbots degrade to
 * prompt-only answers, so this is not part of first-time deployment.
 *
 * Usage (inside Docker — the tools profile supplies the Azure/Pinecone vars):
 *   docker compose run --rm -e PINECONE_INDEX=science tools npx tsx scripts/ingest-rag.ts
 *   # note: rag-docs/ is not in the repo, so it must exist in the build context
 *
 * Usage (locally, reads env from .env.local or .env):
 *   npm run ingest:rag
 *
 * Requires env: PINECONE_API_KEY, PINECONE_INDEX, AZURE_RESOURCE_NAME,
 * AZURE_API_KEY, AZURE_OPENAI_EMBEDDING_DEPLOYMENT.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Pinecone } from "@pinecone-database/pinecone";
import { embedMany } from "ai";
import { azure } from "@ai-sdk/azure";
import { loadEnv } from "./lib/load-env";

// Populate PINECONE_* / AZURE_* from .env.local or .env when running locally.
// Real environment variables (what Docker injects) always take precedence.
loadEnv();

const DOCS_ROOT = join(process.cwd(), "rag-docs");
const PINECONE_INDEX = process.env.PINECONE_INDEX ?? "ai-qef-knowledge";
const EMBEDDING_DEPLOYMENT =
  process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT ?? "text-embedding-3-small";

// Chunking: keep chunks small enough to be precise but large enough to hold a
// full Q/A pair. Tune to your material.
const CHUNK_SIZE = 800; // characters
const CHUNK_OVERLAP = 100; // characters

function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (clean.length <= CHUNK_SIZE) {
    return clean ? [clean] : [];
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + CHUNK_SIZE, clean.length);
    chunks.push(clean.slice(start, end));
    if (end === clean.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

async function ingestNamespace(
  client: Pinecone,
  namespace: string
): Promise<number> {
  const dir = join(DOCS_ROOT, namespace);
  let files: string[];
  try {
    files = (await readdir(dir)).filter(
      (f) => f.endsWith(".md") || f.endsWith(".txt")
    );
  } catch {
    console.warn(`[ingest] skip "${namespace}": folder not found (${dir})`);
    return 0;
  }

  // Gather chunks across all files in this namespace.
  const records: { id: string; text: string; source: string }[] = [];
  for (const file of files) {
    const content = await readFile(join(dir, file), "utf8");
    chunkText(content).forEach((text, i) => {
      records.push({ id: `${file}#${i}`, text, source: file });
    });
  }

  if (records.length === 0) {
    console.warn(`[ingest] "${namespace}": no chunks found`);
    return 0;
  }

  // Embed in batches to stay within request limits.
  const index = client.index(PINECONE_INDEX).namespace(namespace);
  const BATCH = 96;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const { embeddings } = await embedMany({
      model: azure.embedding(EMBEDDING_DEPLOYMENT),
      values: batch.map((r) => r.text),
    });

    await index.upsert({
      records: batch.map((r, j) => ({
        id: r.id,
        values: embeddings[j],
        metadata: { text: r.text, source: r.source },
      })),
    });
    console.log(
      `[ingest] "${namespace}": upserted ${Math.min(i + BATCH, records.length)}/${records.length}`
    );
  }

  return records.length;
}

async function main() {
  if (!process.env.PINECONE_API_KEY) {
    throw new Error("PINECONE_API_KEY is not set");
  }

  const client = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

  // Discover topic sub-folders automatically.
  let namespaces: string[];
  try {
    const entries = await readdir(DOCS_ROOT, { withFileTypes: true });
    namespaces = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    throw new Error(`rag-docs folder not found at ${DOCS_ROOT}`);
  }

  let total = 0;
  for (const ns of namespaces) {
    total += await ingestNamespace(client, ns);
  }
  console.log(`[ingest] done. ${total} chunks across ${namespaces.length} namespaces.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
