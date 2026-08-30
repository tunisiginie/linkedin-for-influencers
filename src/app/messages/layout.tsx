import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessagesShell } from "@/components/messages-shell";
import { getConversationsForUser, getOrgIdForUser } from "@/lib/queries";
import { getMyClaimedCreator, getProfile, requireUser } from "@/lib/auth";
import { MessageSquare } from "lucide-react";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [profile, myCreator] = await Promise.all([getProfile(), getMyClaimedCreator()]);
  const accountType = myCreator ? "creator" : "sponsor";
  const conversations = await getConversationsForUser(user.id, accountType);

  // A sponsor with no org yet just hasn't messaged anyone.
  if (accountType === "sponsor") await getOrgIdForUser(user.id);

  const sidebar = (
    <>
      <div className="border-b border-border px-4 py-3">
        <h1 className="font-semibold">Messages</h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
            <MessageSquare className="size-8 text-muted-foreground/50" />
            <p>
              No conversations yet.{" "}
              {accountType === "sponsor" ? (
                <>
                  Visit a{" "}
                  <Link href="/search" className="text-primary hover:underline">
                    creator&apos;s profile
                  </Link>{" "}
                  to start one.
                </>
              ) : (
                "Sponsors will reach out here."
              )}
            </p>
          </div>
        ) : (
          conversations.map((c) => {
            const name =
              accountType === "sponsor"
                ? (c.creators?.display_name ?? "Unknown creator")
                : (c.organizations?.name ?? "Unknown org");
            const avatarUrl = accountType === "sponsor" ? c.creators?.avatar_url : c.organizations?.logo_url;
            return (
              <Link
                key={c.id}
                href={`/messages/${c.id}`}
                className="flex items-center gap-3 border-b border-border px-4 py-3 hover:bg-accent"
              >
                <Avatar className="size-9">
                  <AvatarImage src={avatarUrl ?? undefined} alt={name} />
                  <AvatarFallback className="text-xs">{initials(name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {c.subject ?? "No subject"}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>
      <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
        Signed in as {profile?.full_name ?? profile?.email}
      </div>
    </>
  );

  return <MessagesShell sidebar={sidebar}>{children}</MessagesShell>;
}
