import { redirect } from "next/navigation";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CreatorCard } from "@/components/creator-card";
import { AiSearchBar } from "@/components/ai-search-bar";
import { CountUp } from "@/components/count-up";
import { getFeaturedCreators } from "@/lib/queries";
import { getProfile, roleHome } from "@/lib/auth";
import { BadgeCheck, Bot, Search, Sparkles, Users } from "lucide-react";

export default async function HomePage() {
  const profile = await getProfile();
  if (profile) redirect(roleHome(profile.account_type));

  const featured = await getFeaturedCreators(6);

  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center px-4 py-16 text-center sm:py-24">
      <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
        <Sparkles className="size-3.5 text-primary" /> Transparent JAE Scores, not guesswork
      </span>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
        The professional network for <span className="text-primary">creators</span> and the{" "}
        <span className="text-primary">sponsors</span> who back them.
      </h1>
      <p className="mt-4 max-w-xl text-balance text-muted-foreground sm:text-lg">
        One side gets a profile that proves their worth with real metrics. The other gets a
        faster way to find creators who actually deliver.
      </p>

      {/* Illustrative, not a live statistic — this animates the same two
          numbers on every load. Real per-creator figures live on their own
          profile and dashboard, computed from their actual metrics. */}
      <div className="mt-10 flex w-full max-w-lg items-stretch justify-center gap-4 sm:gap-8">
        <div className="flex-1 rounded-(--radius-2xl) border border-border bg-card px-4 py-5 shadow-[var(--shadow-sm)]">
          <div className="text-xs font-medium text-muted-foreground">JAE Score</div>
          <CountUp
            value={842}
            className="mt-1 block text-3xl font-semibold tabular-nums text-primary sm:text-4xl"
          />
          <div className="mt-1 text-xs text-muted-foreground">Grade A</div>
        </div>
        <div className="flex-1 rounded-(--radius-2xl) border border-border bg-card px-4 py-5 shadow-[var(--shadow-sm)]">
          <div className="text-xs font-medium text-muted-foreground">Sponsorship earnings</div>
          <CountUp
            value={128400}
            prefix="$"
            className="mt-1 block text-3xl font-semibold tabular-nums sm:text-4xl"
          />
          <div className="mt-1 text-xs text-muted-foreground">Trending up</div>
        </div>
      </div>
      <Link href="/jae-score" className="mt-2 text-xs text-muted-foreground hover:underline">
        Illustrative — see how your real score is computed →
      </Link>

      <div className="mt-8 w-full max-w-xl">
        <AiSearchBar size="lg" />
      </div>

      <Link
        href="/nolan"
        className="group mt-4 flex w-full max-w-xl items-center gap-3 rounded-(--radius-xl) border border-border bg-card px-4 py-3 text-left shadow-[var(--shadow-sm)] transition-all hover:shadow-[var(--shadow-md)]"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-(--radius-lg) bg-primary/10 text-primary">
          <Bot className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1 text-sm">
          <span className="font-semibold">Ask Nolan</span>{" "}
          <span className="text-muted-foreground">
            — your sponsorship AI, free to try, no account needed.
          </span>
        </span>
        <span className="shrink-0 text-sm font-medium text-primary group-hover:underline">
          Chat →
        </span>
      </Link>

      <div className="mt-10 grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/creator"
          className="group flex flex-col items-start gap-3 rounded-(--radius-2xl) border border-border bg-card p-6 text-left shadow-[var(--shadow-sm)] transition-all hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5"
        >
          <span className="flex size-11 items-center justify-center rounded-(--radius-lg) bg-primary/10 text-primary">
            <BadgeCheck className="size-6" />
          </span>
          <span className="text-lg font-semibold">I&apos;m a Creator</span>
          <span className="text-sm text-muted-foreground">
            Claim your auto-generated profile, see your JAE Score, and get discovered by
            sponsors who already know what you deliver.
          </span>
          <span className="mt-auto text-sm font-medium text-primary group-hover:underline">
            Go to creator home →
          </span>
        </Link>

        <Link
          href="/sponsor"
          className="group flex flex-col items-start gap-3 rounded-(--radius-2xl) border border-border bg-card p-6 text-left shadow-[var(--shadow-sm)] transition-all hover:shadow-[var(--shadow-md)] hover:-translate-y-0.5"
        >
          <span className="flex size-11 items-center justify-center rounded-(--radius-lg) bg-primary/10 text-primary">
            <Search className="size-6" />
          </span>
          <span className="text-lg font-semibold">I&apos;m a Sponsor</span>
          <span className="text-sm text-muted-foreground">
            Search the directory by category, platform, and JAE Score, then message creators
            directly.
          </span>
          <span className="mt-auto text-sm font-medium text-primary group-hover:underline">
            Go to sponsor home →
          </span>
        </Link>
      </div>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <LinkButton href="/signup" size="lg">
          Create an account
        </LinkButton>
        <LinkButton href="/login" variant="ghost" size="lg">
          Log in
        </LinkButton>
      </div>

      {featured.length > 0 ? (
        <div className="mt-16 w-full">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
              <Sparkles className="size-4" /> A few creators already here
            </h2>
            <Link href="/search?sort=roi" className="text-sm text-primary hover:underline">
              See all
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((c) => (
              <CreatorCard key={c.id} creator={c} />
            ))}
          </div>
        </div>
      ) : null}

      <Card className="mt-16 w-full max-w-2xl text-left">
        <CardContent className="flex items-start gap-3 px-5 py-4">
          <Users className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            You can browse either side without an account — the buttons above lead straight
            there. Sign up when you&apos;re ready to claim a profile, message someone, or save a
            list.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
