import Link from "next/link";
import { Briefcase, Search, Sparkles, ArrowRight } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CreatorCard } from "@/components/creator-card";
import { AiSearchBar } from "@/components/ai-search-bar";
import { getCategories, getFeaturedCreators } from "@/lib/queries";
import { getProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { ResolvedIcon } from "@/lib/icon-map";

export default async function SponsorHomePage() {
  const [profile, categories, featured] = await Promise.all([
    getProfile(),
    getCategories(),
    getFeaturedCreators(9),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-10 sm:py-16">
      <span className="flex size-14 items-center justify-center rounded-(--radius-2xl) bg-primary text-primary-foreground shadow-[var(--shadow-md)]">
        <Briefcase className="size-7" />
      </span>
      <h1 className="mt-4 text-2xl font-semibold sm:text-3xl">
        Find creators sponsors can trust.
      </h1>
      <p className="mt-1 max-w-md text-center text-sm text-muted-foreground">
        Every profile carries a transparent ROI score built from real platform metrics.
      </p>

      <div className="mt-6 w-full max-w-xl">
        <AiSearchBar size="lg" />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/search?category=${c.slug}`}
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground/90 hover:bg-accent"
          >
            <ResolvedIcon iconName={c.icon} className="size-3.5 text-muted-foreground" />
            {c.name}
          </Link>
        ))}
      </div>

      {!isSupabaseConfigured() ? (
        <Card className="mt-8 w-full border-dashed">
          <CardContent className="px-4 py-3 text-sm text-muted-foreground">
            Supabase isn&apos;t configured yet, so this is running with empty data. Add your
            keys to <code>.env.local</code> and run <code>npm run seed</code> to see real
            creator profiles here.
          </CardContent>
        </Card>
      ) : null}

      <div className="mt-10 w-full">
        <div className="mb-3 flex items-center justify-between">
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
                No creators yet. Run <code>npm run seed</code> against a configured Supabase
                project to populate the directory.
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <div className="mt-8 w-full">
        <LinkButton href="/search" variant="outline" className="w-full">
          <Search className="size-4" /> Open full talent search <ArrowRight className="size-4" />
        </LinkButton>
      </div>

      {!profile ? (
        <Card className="mt-10 w-full">
          <CardContent className="flex flex-col items-center gap-3 px-5 py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Sign up as a sponsor to message creators, save talent lists, and draft
              sponsorship paperwork with Claude.
            </p>
            <LinkButton href="/signup?role=sponsor" size="lg">
              Sign up as a sponsor
            </LinkButton>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
