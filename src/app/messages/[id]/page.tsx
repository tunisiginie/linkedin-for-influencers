import { notFound } from "next/navigation";
import { MessageThread } from "@/components/message-thread";
import { DocumentsPanel } from "@/components/documents-panel";
import { getConversationDetail, getDocuments, getMessages } from "@/lib/queries";
import { getMyClaimedCreator, requireUser } from "@/lib/auth";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();

  const [conversation, messages, documents, myCreator] = await Promise.all([
    getConversationDetail(id),
    getMessages(id),
    getDocuments(id),
    getMyClaimedCreator(),
  ]);

  if (!conversation) notFound();

  const viewerSenderType = myCreator?.id === conversation.creator_id ? "creator" : "sponsor";
  const otherPartyName =
    viewerSenderType === "sponsor"
      ? (conversation.creators?.display_name ?? "Unknown creator")
      : (conversation.organizations?.name ?? "Unknown organization");
  const otherPartyAvatarUrl =
    viewerSenderType === "sponsor" ? (conversation.creators?.avatar_url ?? null) : (conversation.organizations?.logo_url ?? null);

  return (
    <div className="flex h-full">
      <div className="flex-1">
        <MessageThread
          conversationId={conversation.id}
          initialMessages={messages}
          viewerSenderType={viewerSenderType}
          otherPartyName={otherPartyName}
          otherPartyAvatarUrl={otherPartyAvatarUrl}
          creatorId={conversation.creator_id}
        />
      </div>
      <DocumentsPanel conversationId={conversation.id} initialDocuments={documents} />
    </div>
  );
}
