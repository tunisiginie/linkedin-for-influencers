"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getMyClaimedCreator, requireUser } from "@/lib/auth";
import { isCreatorContactable } from "@/lib/queries";

export interface SendMessageResult {
  ok: boolean;
  error?: string;
}

/** Sends a message in an existing conversation. Enforces the compliance
 * guard here rather than at conversation-creation time: a sponsor's first
 * message to a creator who has opted out (or requested deletion) is
 * blocked; everything else — including a creator replying — goes through.
 * RLS (`messages` insert policy) is the authorization backstop underneath
 * this; the check here is the product-facing compliance rule. */
export async function sendMessage(formData: FormData): Promise<SendMessageResult> {
  const user = await requireUser();
  const conversationId = String(formData.get("conversation_id"));
  const body = String(formData.get("body") ?? "").trim();
  const aiDrafted = formData.get("ai_drafted") === "true";
  if (!conversationId || !body) return { ok: false, error: "Message can't be empty." };

  const supabase = await createClient();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, creator_id, org_id")
    .eq("id", conversationId)
    .maybeSingle();
  if (!conversation) return { ok: false, error: "Conversation not found." };

  const myCreator = await getMyClaimedCreator();
  const senderType = myCreator?.id === conversation.creator_id ? "creator" : "sponsor";

  if (senderType === "sponsor") {
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId);
    const isFirstMessage = (count ?? 0) === 0;

    if (isFirstMessage) {
      const contactable = await isCreatorContactable(conversation.creator_id);
      if (!contactable) {
        return {
          ok: false,
          error: "This creator has opted out of new outreach.",
        };
      }
    }
  }

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_type: senderType,
    sender_user_id: user.id,
    body,
    ai_drafted: aiDrafted,
  });
  if (error) return { ok: false, error: error.message };

  await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  revalidatePath(`/messages/${conversationId}`);
  revalidatePath("/messages");
  return { ok: true };
}
