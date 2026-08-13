import EnglishReadingComprehensionChat from "../../EnglishReadingComprehensionChat";
import { basePath } from "@/lib/utils";

export default function EnglishReadingComprehensionCycle2Reading1RoleplayPage() {
  return (
    <EnglishReadingComprehensionChat
      reading="cycle-2-reading-1"
      topicLabel="Cycle 2 · Reading 1 — Story Day"
      backHref="/english/reading-comprehension/cycle-2-reading-1"
      startMessageText={`Here is our reading. Let's read it together!\n\n![Story Day poster](${basePath}/english/story%20day.png)`}
    />
  );
}
