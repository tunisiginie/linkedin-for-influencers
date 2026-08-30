import { MessageSquare } from "lucide-react";

export default function MessagesEmptyPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
      <MessageSquare className="size-10 text-muted-foreground/40" />
      <p>Select a conversation to view messages.</p>
    </div>
  );
}
