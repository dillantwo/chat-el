import EnglishReadingComprehensionChat from "../../EnglishReadingComprehensionChat";
import { basePath } from "@/lib/utils";

export default function EnglishReadingComprehensionCycle3Reading3RoleplayPage() {
  return (
    <EnglishReadingComprehensionChat
      reading="cycle-3-reading-3"
      topicLabel="Cycle 3 · Reading 3 — Red Tides in Hong Kong"
      backHref="/english/reading-comprehension/cycle-3-reading-3"
      startMessageText={`Here is our reading. Let's read it together!\n\n![The beach](${basePath}/english/the%20beach.png)`}
    />
  );
}
