"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { NolanMessage } from "@/lib/types";

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  body: string;
  pending?: boolean;
}

export function NolanChat({
  threadId,
  initialMessages,
}: {
  threadId: string;
  initialMessages: NolanMessage[];
}) {
  const [messages, setMessages] = useState<DisplayMessage[]>(
    initialMessages.map((m) => ({ id: m.id, role: m.role, body: m.body })),
  );
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessageBody = messages.at(-1)?.body;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, lastMessageBody]);

  async function handleSend() {
    const text = input.trim();
    if (!text || isSending) return;

    const userMsgId = `local-${Date.now()}`;
    const assistantMsgId = `${userMsgId}-assistant`;
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", body: text },
      { id: assistantMsgId, role: "assistant", body: "", pending: true },
    ]);
    setInput("");
    setIsSending(true);

    try {
      const res = await fetch("/api/nolan/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId, message: text }),
      });

      const isStream = res.headers.get("X-Nolan-Response") === "stream";

      if (!isStream) {
        const data = await res.json().catch(() => ({}));
        if (data?.type === "fallback") {
          toast.info("Nolan isn't configured on this deployment yet.");
        } else {
          toast.error(data?.error ?? "Nolan couldn't respond.");
        }
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
        return;
      }

      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsgId ? { ...m, body: accumulated } : m)),
        );
      }
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantMsgId ? { ...m, body: accumulated, pending: false } : m)),
      );
    } catch (err) {
      console.error(err);
      toast.error("Nolan couldn't respond — try again.");
      setMessages((prev) => prev.filter((m) => m.id !== assistantMsgId));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <Bot className="size-8 text-muted-foreground/40" />
            <p>
              Ask Nolan about a deal, or upload a contract or screenshot from the panel on the
              right.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-line",
                  m.role === "user"
                    ? "rounded-br-sm bg-primary text-primary-foreground"
                    : "rounded-bl-sm bg-muted text-foreground",
                )}
              >
                {m.body || (m.pending ? "…" : "")}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Nolan about a deal..."
          rows={3}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Educational, not legal advice.</p>
          <Button type="button" size="sm" onClick={handleSend} disabled={isSending || !input.trim()}>
            {isSending ? "Sending..." : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
