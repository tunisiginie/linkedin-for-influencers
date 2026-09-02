import { Bot } from "lucide-react";

export default function NolanEmptyPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
      <Bot className="size-10 text-muted-foreground/40" />
      <p>Select a conversation, or start a new one.</p>
    </div>
  );
}
