import { Bot } from "lucide-react";
import { NolanChat } from "@/components/nolan-chat";
import { getMyClaimedCreator } from "@/lib/auth";

/** An anonymous or unclaimed visitor lands here directly (the layout skips
 * the sidebar for them) and gets one ephemeral conversation. A claimed
 * creator sees this only as the empty right pane before picking a thread —
 * their persisted history lives at /nolan/[id]. */
export default async function NolanIndexPage() {
  const myCreator = await getMyClaimedCreator();

  if (!myCreator) {
    return <NolanChat threadId={null} initialMessages={[]} canPersist={false} showUploadHint={false} />;
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
      <Bot className="size-10 text-muted-foreground/40" />
      <p>Select a conversation, or start a new one.</p>
    </div>
  );
}
