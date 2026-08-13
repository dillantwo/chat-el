import { connectDB } from "@/lib/mongodb";
import { getSession } from "@/lib/session";
import { requireTopicApi } from "@/lib/subject-access";
import { WenyanProgress, type IWenyanProgress } from "@/models/WenyanProgress";
import {
  emptyProgress,
  applyTextCompleted,
  applyChallenge,
  type ChallengeMode,
  type ProgressSnapshot,
} from "@/lib/wenyan-scoring";

type WenyanProgressDoc = Pick<
  IWenyanProgress,
  | "completedTexts"
  | "bestTranslate"
  | "bestPuzzle"
  | "bestTheme"
  | "bestApplication"
  | "playsTranslate"
  | "playsPuzzle"
  | "playsTheme"
  | "playsApplication"
  | "badges"
>;

function docToSnapshot(doc: WenyanProgressDoc | null): ProgressSnapshot {
  const base = emptyProgress();
  if (!doc) return base;
  const bestTranslate = doc.bestTranslate ?? 0;
  const bestPuzzle = doc.bestPuzzle ?? 0;
  const bestTheme = doc.bestTheme ?? 0;
  const bestApplication = doc.bestApplication ?? 0;
  return {
    completedTexts: Array.isArray(doc.completedTexts) ? doc.completedTexts : [],
    bestTranslate,
    bestPuzzle,
    bestTheme,
    bestApplication,
    playsTranslate: doc.playsTranslate ?? 0,
    playsPuzzle: doc.playsPuzzle ?? 0,
    playsTheme: doc.playsTheme ?? 0,
    playsApplication: doc.playsApplication ?? 0,
    totalScore: bestTranslate + bestPuzzle + bestTheme + bestApplication,
    badges: Array.isArray(doc.badges) ? doc.badges : [],
  };
}

function snapshotToFields(snap: ProgressSnapshot) {
  return {
    completedTexts: snap.completedTexts,
    bestTranslate: snap.bestTranslate,
    bestPuzzle: snap.bestPuzzle,
    bestTheme: snap.bestTheme,
    bestApplication: snap.bestApplication,
    playsTranslate: snap.playsTranslate,
    playsPuzzle: snap.playsPuzzle,
    playsTheme: snap.playsTheme,
    playsApplication: snap.playsApplication,
    badges: snap.badges,
  };
}

function unauthorized() {
  return new Response(JSON.stringify({ error: "未登錄" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

export async function GET() {
  try {
    const denied = await requireTopicApi("chinese", "wenyan");
    if (denied) return denied;

    const session = await getSession();
    if (!session) return unauthorized();

    await connectDB();
    const doc = await WenyanProgress.findOne({
      userId: session.userId,
    }).lean<WenyanProgressDoc | null>();

    return Response.json({ progress: docToSnapshot(doc) });
  } catch (error) {
    console.error("[wenyan-progress] GET Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

export async function POST(req: Request) {
  try {
    const denied = await requireTopicApi("chinese", "wenyan");
    if (denied) return denied;

    const session = await getSession();
    if (!session) return unauthorized();

    const body = (await req.json()) as {
      type?: "completeText" | "recordChallenge";
      textId?: string;
      mode?: ChallengeMode;
      score?: number;
      maxStreak?: number;
    };

    await connectDB();

    const existing = await WenyanProgress.findOne({
      userId: session.userId,
    }).lean<WenyanProgressDoc | null>();
    const current = docToSnapshot(existing);

    let outcome;
    if (body.type === "completeText") {
      if (!body.textId) {
        return new Response(JSON.stringify({ error: "textId is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      outcome = applyTextCompleted(current, body.textId);
    } else if (body.type === "recordChallenge") {
      const validModes: ChallengeMode[] = [
        "translate",
        "puzzle",
        "theme",
        "application",
      ];
      if (!body.mode || !validModes.includes(body.mode)) {
        return new Response(JSON.stringify({ error: "invalid mode" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      outcome = applyChallenge(current, body.mode, {
        score: Number(body.score) || 0,
        maxStreak: Number(body.maxStreak) || 0,
      });
    } else {
      return new Response(JSON.stringify({ error: "invalid type" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    await WenyanProgress.findOneAndUpdate(
      { userId: session.userId },
      {
        $set: {
          userId: session.userId,
          username: session.username,
          ...snapshotToFields(outcome.snapshot),
        },
      },
      { returnDocument: "after", upsert: true },
    );

    return Response.json({
      progress: outcome.snapshot,
      newBadges: outcome.newBadges,
    });
  } catch (error) {
    console.error("[wenyan-progress] POST Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
