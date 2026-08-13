import EnglishReadingComprehensionChat from "../../EnglishReadingComprehensionChat";
import { basePath } from "@/lib/utils";

export default function EnglishReadingComprehensionReading3RoleplayPage() {
  return (
    <EnglishReadingComprehensionChat
      reading="reading-3"
      topicLabel="Reading 3 — Pip the Dragon"
      backHref="/english/reading-comprehension/reading-3"
      startMessageText={`Here is our reading. Let's read it together!\n\n![Pip the Dragon story](${basePath}/english/pip%20the%20dragon.png)`}
    />
  );
}
