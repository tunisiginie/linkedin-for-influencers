import Link from "next/link";
import { Bot, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LinkButton, Button } from "@/components/ui/button";
import { MessagesShell } from "@/components/messages-shell";
import { getMyClaimedCreator, requireCreator } from "@/lib/auth";
import { getNolanThreads } from "@/lib/queries";
import { createNolanThread } from "@/lib/actions/nolan";

export default async function NolanLayout({ children }: { children: React.ReactNode }) {
  await requireCreator();
  const myCreator = await getMyClaimedCreator();

  if (!myCreator) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-(--radius-2xl) bg-primary/10 text-primary">
          <Bot className="size-7" />
        </span>
        <h1 className="mt-4 text-2xl font-semibold">Nolan needs your profile first.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Nolan grounds every answer in your real metrics and ROI breakdown, so it only works
          once you&apos;ve claimed your creator profile.
        </p>
        <Card className="mt-6 w-full text-left">
          <CardContent className="flex items-start gap-3 px-5 py-4">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nolan explains what a deal says and flags what&apos;s worth a second look.
              It&apos;s not a lawyer, and it will tell you plainly when to get one.
            </p>
          </CardContent>
        </Card>
        <LinkButton href="/claim" size="lg" className="mt-8">
          Find and claim your profile
        </LinkButton>
      </div>
    );
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
