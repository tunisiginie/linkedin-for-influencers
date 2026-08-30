import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreatorCard } from "@/components/creator-card";
import { getCategories, getFeaturedCreators } from "@/lib/queries";
import { getMyClaimedCreator, getProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { ResolvedIcon } from "@/lib/icon-map";
import { ArrowRight, Search, Sparkles } from "lucide-react";

function initials(name: string | null): string {
  if (!name) return "?";
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default async function HomePage() {
  const [profile, creator, categories, featured] = await Promise.all([
    getProfile(),
    getMyClaimedCreator(),
    getCategories(),
    getFeaturedCreators(9),
  ]);

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-6 lg:grid-cols-[240px_1fr_280px]">
      {/* Left rail */}
      <div className="hidden flex-col gap-4 lg:flex">
        <Card>
          <CardContent className="px-4 pt-2">
            {profile ? (
              <Link href="/dashboard" className="flex items-center gap-3">
                <Avatar className="size-11">
                  <AvatarImage src={profile.photo_url ?? undefined} alt={profile.full_name ?? ""} />
                  <AvatarFallback>{initials(profile.full_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{profile.full_name ?? "Your account"}</div>
                  <div className="text-xs text-muted-foreground capitalize">{profile.account_type}</div>
                </div>
              </Link>
            ) : (
              <div className="space-y-2 py-1">
                <p className="text-sm text-muted-foreground">
                  Join to message creators, save talent lists, and claim your page.
                </p>
                <LinkButton href="/signup" size="sm" className="w-full">
                  Get started
                </LinkButton>
              </div>
            )}
            {profile && !creator && profile.account_type === "creator" ? (
              <LinkButton href="/claim" variant="outline" size="sm" className="mt-3 w-full">
                Claim your page
              </LinkButton>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Browse categories</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-0.5 px-2">
            {categories.map((c) => (
              <Link
                key={c.id}
                href={`/search?category=${c.slug}`}
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-foreground/90 hover:bg-accent"
              >
                <ResolvedIcon iconName={c.icon} className="size-4 text-muted-foreground" />
                {c.name}
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Main */}
      <div className="flex flex-col gap-4">
        <Card className="bg-gradient-to-br from-primary/10 via-card to-card">
          <CardContent className="flex flex-col gap-3 px-5 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold">Find creators sponsors can trust.</h1>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Every profile carries a transparent ROI score built from real
                platform metrics — no more guessing who actually delivers.
              </p>
            </div>
            <LinkButton href="/search">
              <Search /> Search talent <ArrowRight />
            </LinkButton>
          </CardContent>
        </Card>

        {!isSupabaseConfigured() ? (
          <Card className="border-dashed">
            <CardContent className="px-4 py-3 text-sm text-muted-foreground">
              Supabase isn&apos;t configured yet, so this is running with empty
              data. Add your keys to <code>.env.local</code> and run{" "}
              <code>npm run seed</code> to see real creator profiles here.
            </CardContent>
          </Card>
        ) : null}

        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <Sparkles className="size-4" /> Top-scoring creators
          </h2>
          <Link href="/search?sort=roi" className="text-sm text-primary hover:underline">
            See all
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {featured.map((c) => (
            <CreatorCard key={c.id} creator={c} />
          ))}
          {featured.length === 0 ? (
            <Card className="sm:col-span-2">
              <CardContent className="px-4 py-8 text-center text-sm text-muted-foreground">
                No creators yet. Run <code>npm run seed</code> against a configured
                Supabase project to populate the directory.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {/* Right rail */}
      <div className="hidden flex-col gap-4 lg:flex">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">For sponsors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 text-sm text-muted-foreground">
            <p>
              Filter by category, platform, follower range, and ROI score —
              then message creators and draft paperwork with Claude.
            </p>
            <LinkButton href="/search" variant="outline" size="sm" className="w-full">
              Open talent search
            </LinkButton>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">For creators</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 px-4 text-sm text-muted-foreground">
            <p>
              Claim your auto-generated profile to edit it, see your ROI
              breakdown, and control who can contact you.
            </p>
            <LinkButton href="/claim" variant="outline" size="sm" className="w-full">
              Claim your page
            </LinkButton>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
