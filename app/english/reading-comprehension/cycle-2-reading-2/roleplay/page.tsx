import EnglishReadingComprehensionChat from "../../EnglishReadingComprehensionChat";
import { basePath } from "@/lib/utils";

export default function EnglishReadingComprehensionCycle2Reading2RoleplayPage() {
  return (
    <EnglishReadingComprehensionChat
      reading="cycle-2-reading-2"
      topicLabel="Cycle 2 · Reading 2 — Chop Makers"
      backHref="/english/reading-comprehension/cycle-2-reading-2"
      startMessageText={`Here is our reading. Let's read it together!\n\n![Chop Makers article](${basePath}/english/chop%20makers.png)`}
    />
  );
}
