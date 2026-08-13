import EnglishReadingComprehensionChat from "../../EnglishReadingComprehensionChat";
import { basePath } from "@/lib/utils";

export default function EnglishReadingComprehensionCycle3Reading1RoleplayPage() {
  return (
    <EnglishReadingComprehensionChat
      reading="cycle-3-reading-1"
      topicLabel="Cycle 3 · Reading 1 — Detective Lee and the Gold Watch"
      backHref="/english/reading-comprehension/cycle-3-reading-1"
      startMessageText={`Here is our reading. Let's read it together!\n\n![Story and book reviews](${basePath}/english/story%20and%20book%20reviews.png)`}
    />
  );
}
