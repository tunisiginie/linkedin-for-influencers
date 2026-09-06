import Link from "next/link";
import { Bot, ExternalLink, Search, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LinkButton, Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RoiBadge } from "@/components/roi-badge";
import { searchCreators } from "@/lib/queries";
import { getMyClaimedCreator, getProfile } from "@/lib/auth";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default async function CreatorHomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [profile, myCreator] = await Promise.all([getProfile(), getMyClaimedCreator()]);
  const { q } = await searchParams;

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-10 sm:py-16">
      {myCreator ? (
        <>
          <Link href={`/creators/${myCreator.slug}`} className="flex flex-col items-center">
            <Avatar className="size-20 border-4 border-card shadow-[var(--shadow-md)]">
              <AvatarImage src={myCreator.avatar_url ?? undefined} alt={myCreator.display_name} />
              <AvatarFallback className="text-xl">{initials(myCreator.display_name)}</AvatarFallback>
            </Avatar>
            <h1 className="mt-3 text-xl font-semibold hover:underline">{myCreator.display_name}</h1>
          </Link>
          {myCreator.headline ? (
            <p className="text-sm text-muted-foreground">{myCreator.headline}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <LinkButton href={`/creators/${myCreator.slug}`} variant="outline" size="sm">
              View public profile <ExternalLink className="size-3.5" />
            </LinkButton>
            <LinkButton href="/dashboard" size="sm">
              Go to dashboard
            </LinkButton>
          </div>
        </>
      ) : (
        <>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" /> Join the herd
          </span>
          <h1 className="mt-4 text-center text-2xl font-semibold sm:text-3xl">
            Get found. Get sponsored. <span className="text-primary">Fast.</span>
          </h1>
          <p className="mt-1 max-w-md text-center text-sm text-muted-foreground">
            We auto-generate a profile from your public metrics — followers, engagement, growth,
            all rolled into one JAE Score sponsors can actually compare. Find yours, verify
            ownership, and start showing up in searches today.
          </p>

          <form action="/creator" className="mt-6 flex w-full max-w-xl gap-2">
            <Input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search your name or channel handle"
              className="h-11 rounded-(--radius-xl) pl-4 text-base shadow-[var(--shadow-sm)]"
            />
            <Button type="submit" size="lg">
              <Search className="size-4" /> Search
            </Button>
          </form>

          {q ? (
            <CreatorSearchResults q={q} />
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Not signed in yet? You can search now — you&apos;ll sign in when you claim a
              result.
            </p>
          )}

          {!profile ? (
            <LinkButton href="/signup?role=creator" size="lg" className="mt-6">
              Sign up as a creator
            </LinkButton>
          ) : null}
        </>
      )}

      <Link
        href="/nolan"
        className="group mt-10 flex w-full items-center gap-4 rounded-(--radius-2xl) border border-border bg-card p-5 text-left shadow-[var(--shadow-sm)] transition-all hover:shadow-[var(--shadow-md)]"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-(--radius-lg) bg-primary/10 text-primary">
          <Bot className="size-6" />
        </span>
        <div className="min-w-0">
          <div className="font-semibold">
            Meet <span className="text-primary">Nolan</span>, your sponsorship AI
          </div>
          <div className="truncate text-sm text-muted-foreground">
            Upload a contract or screenshot and get a plain-language read on the terms —
            educational, not legal advice.
          </div>
        </div>
        <span className="ml-auto shrink-0 text-sm font-medium text-primary group-hover:underline">
          Ask Nolan →
        </span>
      </Link>
    </div>
  );
}

async function CreatorSearchResults({ q }: { q: string }) {
  const { creators } = await searchCreators({ q, limit: 6 });

  if (creators.length === 0) {
    return (
      <Card className="mt-4 w-full max-w-xl">
        <CardContent className="px-4 py-6 text-center text-sm text-muted-foreground">
          No matching profile found. If we haven&apos;t indexed your channel yet, check back
          after the next ingestion run.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mt-4 flex w-full max-w-xl flex-col gap-2">
      {creators.map((c) => (
        <Link key={c.id} href={`/claim/${c.slug}`}>
          <Card className="transition-shadow hover:shadow-[var(--shadow-md)]">
            <CardContent className="flex items-center gap-3 px-4">
              <Avatar className="size-10">
                <AvatarImage src={c.avatar_url ?? undefined} alt={c.display_name} />
                <AvatarFallback className="text-xs">{initials(c.display_name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{c.display_name}</div>
                {c.headline ? (
                  <div className="truncate text-xs text-muted-foreground">{c.headline}</div>
                ) : null}
              </div>
              {c.claimed_by ? (
                <span className="shrink-0 text-xs text-muted-foreground">Already claimed</span>
              ) : (
                <RoiBadge score={c.roi_scores?.score ?? null} grade={c.roi_scores?.grade ?? null} size="sm" />
              )}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
