import EnglishReadingComprehensionChat from "../../EnglishReadingComprehensionChat";
import { basePath } from "@/lib/utils";

export default function EnglishReadingComprehensionReading2RoleplayPage() {
  return (
    <EnglishReadingComprehensionChat
      reading="reading-2"
      topicLabel="Reading 2 — Amazing Animals"
      backHref="/english/reading-comprehension/reading-2"
      startMessageText={`Here is our reading. Let's read it together!\n\n![Amazing Animals encyclopedia](${basePath}/english/amazing%20animals.png)`}
    />
  );
}
