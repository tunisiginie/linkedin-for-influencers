import { notFound } from "next/navigation";
import { NolanChat } from "@/components/nolan-chat";
import { NolanUpload } from "@/components/nolan-upload";
import { getNolanDocuments, getNolanMessages, getNolanThread } from "@/lib/queries";

export default async function NolanThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const thread = await getNolanThread(id);
  if (!thread) notFound();

  const [messages, documents] = await Promise.all([
    getNolanMessages(id),
    getNolanDocuments(id),
  ]);

  return (
    <div className="flex h-full">
      <div className="flex-1">
        <NolanChat threadId={id} initialMessages={messages} />
      </div>
      <NolanUpload threadId={id} initialDocuments={documents} />
    </div>
  );
}
