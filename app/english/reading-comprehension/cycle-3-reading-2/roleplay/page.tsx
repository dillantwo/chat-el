import EnglishReadingComprehensionChat from "../../EnglishReadingComprehensionChat";
import { basePath } from "@/lib/utils";

export default function EnglishReadingComprehensionCycle3Reading2RoleplayPage() {
  return (
    <EnglishReadingComprehensionChat
      reading="cycle-3-reading-2"
      topicLabel="Cycle 3 · Reading 2 — Make a Balloon Puff Up"
      backHref="/english/reading-comprehension/cycle-3-reading-2"
      startMessageText={`Here is our reading. Let's read it together!\n\n![Make a balloon puff up](${basePath}/english/make%20a%20balloon%20puff%20up.png)`}
    />
  );
}
