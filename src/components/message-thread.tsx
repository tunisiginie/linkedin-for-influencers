"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { sendMessage } from "@/lib/actions/messages";
import { Sparkles } from "lucide-react";
import type { Message, SenderType } from "@/lib/types";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export function MessageThread({
  conversationId,
  initialMessages,
  viewerSenderType,
  otherPartyName,
  otherPartyAvatarUrl,
  creatorId,
}: {
  conversationId: string;
  initialMessages: Message[];
  viewerSenderType: SenderType;
  otherPartyName: string;
  otherPartyAvatarUrl: string | null;
  /** The creator this thread is about — used to ground Claude's draft. */
  creatorId: string;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isDrafting, setIsDrafting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const incoming = payload.new as Message;
          setMessages((prev) =>
            prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming],
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  function handleSend() {
    const text = body.trim();
    if (!text) return;
    const formData = new FormData();
    formData.set("conversation_id", conversationId);
    formData.set("body", text);
    setBody("");
    startTransition(async () => {
      const result = await sendMessage(formData);
      if (!result.ok) {
        toast.error(result.error ?? "Failed to send message.");
        setBody(text); // restore so the user doesn't lose their draft
      }
    });
  }

  async function handleDraftWithClaude() {
    setIsDrafting(true);
    try {
      const res = await fetch("/api/assistant/outreach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId, conversationId }),
      });
      const data = await res.json();
      if (data.type === "fallback") {
        toast.info("Claude isn't configured on this deployment yet.");
        return;
      }
      if (data.draft) {
        setBody(data.draft);
      } else {
        toast.error(data.error ?? "Couldn't generate a draft.");
      }
    } catch {
      toast.error("Couldn't generate a draft.");
    } finally {
      setIsDrafting(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Avatar className="size-8">
          <AvatarImage src={otherPartyAvatarUrl ?? undefined} alt={otherPartyName} />
          <AvatarFallback className="text-xs">{initials(otherPartyName)}</AvatarFallback>
        </Avatar>
        <span className="font-medium">{otherPartyName}</span>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No messages yet. Say hello.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_type === viewerSenderType;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-line",
                    mine
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-muted text-foreground",
                  )}
                >
                  {m.body}
                  {m.ai_drafted ? (
                    <div
                      className={cn(
                        "mt-1 flex items-center gap-1 text-[10px] opacity-70",
                        mine ? "text-primary-foreground" : "text-muted-foreground",
                      )}
                    >
                      <Sparkles className="size-2.5" /> Drafted with Claude
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-3">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message..."
          rows={3}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <div className="mt-2 flex items-center justify-between">
          {viewerSenderType === "sponsor" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDraftWithClaude}
              disabled={isDrafting}
            >
              <Sparkles className="size-3.5" /> {isDrafting ? "Drafting..." : "Draft with Claude"}
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" size="sm" onClick={handleSend} disabled={isPending || !body.trim()}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}
