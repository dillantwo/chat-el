import { connectDB } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { requireTopicApi } from "@/lib/subject-access";
import { VocabBank } from "@/models/VocabBank";

const MAX_WORDS = 500;
const MAX_WORD_LENGTH = 100;

/** Normalise an incoming words array: strings only, trimmed, de-duped, capped. */
function cleanWords(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") continue;
    const word = raw.trim().slice(0, MAX_WORD_LENGTH);
    if (!word) continue;
    const key = word.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(word);
    if (out.length >= MAX_WORDS) break;
  }
  return out;
}

export async function GET() {
  try {
    const denied = await requireTopicApi("english", "reading-comprehension");
    if (denied) return denied;

    const session = await getSession();
    if (!session) {
      return new Response(JSON.stringify({ error: "未登錄" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    await connectDB();

    const doc = await VocabBank.findOne({ userId: session.userId }).lean();
    return Response.json({ words: Array.isArray(doc?.words) ? doc!.words : [] });
  } catch (error) {
    console.error("[english-vocab-bank] GET Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

export async function PUT(req: Request) {
  try {
    const denied = await requireTopicApi("english", "reading-comprehension");
    if (denied) return denied;

    const session = await getSession();
    if (!session) {
      return new Response(JSON.stringify({ error: "未登錄" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as { words?: unknown };
    const words = cleanWords(body.words);

    await connectDB();

    const doc = await VocabBank.findOneAndUpdate(
      { userId: session.userId },
      {
        $set: {
          userId: session.userId,
          username: session.username,
          words,
        },
      },
      { returnDocument: "after", upsert: true },
    );

    return Response.json({ words: Array.isArray(doc?.words) ? doc.words : [] });
  } catch (error) {
    console.error("[english-vocab-bank] PUT Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
