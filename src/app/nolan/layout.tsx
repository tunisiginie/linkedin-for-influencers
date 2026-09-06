import Link from "next/link";
import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MessagesShell } from "@/components/messages-shell";
import { getMyClaimedCreator } from "@/lib/auth";
import { getNolanThreads } from "@/lib/queries";
import { createNolanThread } from "@/lib/actions/nolan";

/** Nolan is open to everyone now (front-of-site overhaul, part 1) — no
 * sign-in gate, no claimed-profile interstitial. An anonymous or unclaimed
 * visitor gets a single ephemeral conversation with no sidebar (rendered by
 * `children`, i.e. src/app/nolan/page.tsx); persistence and the
 * multi-thread history view are still exclusive to a claimed creator
 * profile, since a real thread has to belong to a real creator row. */
export default async function NolanLayout({ children }: { children: React.ReactNode }) {
  const myCreator = await getMyClaimedCreator();

  if (!myCreator) {
    return <div className="flex h-[calc(100vh-3.5rem)] flex-col">{children}</div>;
  }

  const threads = await getNolanThreads(myCreator.id);

  const sidebar = (
    <>
      <div className="border-b border-border px-4 py-3">
        <h1 className="font-semibold">Nolan</h1>
        <p className="text-xs text-muted-foreground">Your sponsorship AI</p>
      </div>
      <div className="border-b border-border p-3">
        <form action={createNolanThread}>
          <Button type="submit" size="sm" className="w-full">
            New conversation
          </Button>
        </form>
      </div>
      <div className="flex-1 overflow-y-auto">
        {threads.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
            <Bot className="size-8 text-muted-foreground/50" />
            <p>Start a conversation to ask Nolan anything about a deal.</p>
          </div>
        ) : (
          threads.map((t) => (
            <Link
              key={t.id}
              href={`/nolan/${t.id}`}
              className="flex flex-col gap-0.5 border-b border-border px-4 py-3 hover:bg-accent"
            >
              <span className="truncate text-sm font-medium">
                {t.title ?? "New conversation"}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(t.updated_at).toLocaleDateString()}
              </span>
            </Link>
          ))
        )}
      </div>
      <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        Educational, not legal advice.
      </div>
    </>
  );

  return (
    <MessagesShell sidebar={sidebar} basePath="/nolan">
      {children}
    </MessagesShell>
  );
}
