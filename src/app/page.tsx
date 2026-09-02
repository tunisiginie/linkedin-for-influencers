import { redirect } from "next/navigation";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getProfile, roleHome } from "@/lib/auth";
import { BadgeCheck, Search, Sparkles, Users } from "lucide-react";

export default async function HomePage() {
  const profile = await getProfile();
  if (profile) redirect(roleHome(profile.account_type));

  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center px-4 py-16 text-center sm:py-24">
      <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
        <Sparkles className="size-3.5 text-primary" /> Transparent ROI scores, not guesswork
      </span>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
        The professional network for <span className="text-primary">creators</span> and the{" "}
        <span className="text-primary">sponsors</span> who back them.
      </h1>
      <p className="mt-4 max-w-xl text-balance text-muted-foreground sm:text-lg">
        One side gets a profile that proves their worth with real metrics. The other gets a
        faster way to find creators who actually deliver.
      </p>

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
            Claim your auto-generated profile, see your ROI score, and get discovered by
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
            Search the directory by category, platform, and ROI score, then message creators
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
