import EnglishReadingComprehensionChat from "../../EnglishReadingComprehensionChat";
import { basePath } from "@/lib/utils";

export default function EnglishReadingComprehensionCycle2Reading3RoleplayPage() {
  return (
    <EnglishReadingComprehensionChat
      reading="cycle-2-reading-3"
      topicLabel="Cycle 2 · Reading 3 — A Wonderful School Trip"
      backHref="/english/reading-comprehension/cycle-2-reading-3"
      startMessageText={`Here is our reading. Let's read it together!\n\n![An email](${basePath}/english/an%20email.png)`}
    />
  );
}
