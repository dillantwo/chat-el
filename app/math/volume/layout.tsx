import { requireTopicPage } from "@/lib/subject-access";
import { requireMathToolPage } from "@/lib/toolbox-access";

export const runtime = "nodejs";

// Not using mathToolLayout() because this tool needs its own full-size wrapper.
export default async function VolumeLayout({ children }: { children: React.ReactNode }) {
  await requireTopicPage("math", "ai-problem-solving");
  await requireMathToolPage("volume-cubes");

  return <div className="h-full w-full">{children}</div>;
}
