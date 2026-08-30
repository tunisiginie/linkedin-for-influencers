import { AiSearchBar } from "@/components/ai-search-bar";
import { CreatorCard } from "@/components/creator-card";
import { SearchFilters } from "@/components/search-filters";
import { Card, CardContent } from "@/components/ui/card";
import { getCategories, getPlatforms, searchCreators } from "@/lib/queries";

const PAGE_SIZE = 24;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const get = (key: string) => {
    const v = sp[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const page = Math.max(1, Number(get("page")) || 1);

  const [categories, platforms, { creators, total }] = await Promise.all([
    getCategories(),
    getPlatforms(),
    searchCreators({
      q: get("q"),
      category: get("category"),
      platform: get("platform"),
      country: get("country"),
      minFollowers: get("minFollowers") ? Number(get("minFollowers")) : undefined,
      maxFollowers: get("maxFollowers") ? Number(get("maxFollowers")) : undefined,
      minRoiScore: get("minRoiScore") ? Number(get("minRoiScore")) : undefined,
      sort: (get("sort") as never) || "roi",
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
  ]);

  return (
    <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-6 md:grid-cols-[260px_1fr]">
      <aside>
        <div className="sticky top-[4.5rem]">
          <SearchFilters categories={categories} platforms={platforms} />
        </div>
      </aside>

      <div>
        <AiSearchBar />
        <div className="mb-3 flex items-baseline justify-between">
          <h1 className="text-lg font-semibold">
            {total.toLocaleString()} creator{total === 1 ? "" : "s"}
          </h1>
        </div>

        {creators.length === 0 ? (
          <Card>
            <CardContent className="px-4 py-10 text-center text-sm text-muted-foreground">
              No creators match these filters yet. Try widening your search, or run{" "}
              <code>npm run seed</code> against a configured Supabase project.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {creators.map((c) => (
              <CreatorCard key={c.id} creator={c} withSaveAction />
            ))}
          </div>
        )}

        {total > PAGE_SIZE ? (
          <div className="mt-6 flex items-center justify-center gap-3 text-sm">
            {page > 1 ? (
              <a
                className="text-primary hover:underline"
                href={`?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] ?? "" : v ?? ""])), page: String(page - 1) })}`}
              >
                Previous
              </a>
            ) : null}
            <span className="text-muted-foreground">
              Page {page} of {Math.ceil(total / PAGE_SIZE)}
            </span>
            {page * PAGE_SIZE < total ? (
              <a
                className="text-primary hover:underline"
                href={`?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] ?? "" : v ?? ""])), page: String(page + 1) })}`}
              >
                Next
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
