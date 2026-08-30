import { notFound } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RoiBadge } from "@/components/roi-badge";
import { getTalentListWithCreators } from "@/lib/queries";
import { requireUser } from "@/lib/auth";
import { removeCreatorFromList } from "@/lib/actions/lists";
import Link from "next/link";
import { X } from "lucide-react";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const list = await getTalentListWithCreators(id);
  if (!list) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-semibold">{list.name}</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        {list.items.length} creator{list.items.length === 1 ? "" : "s"}
      </p>

      {list.items.length === 0 ? (
        <Card>
          <CardContent className="px-4 py-10 text-center text-sm text-muted-foreground">
            No creators saved to this list yet. Use the bookmark icon on
            search results to add some.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {list.items.map(({ creator }) => (
            <Card key={creator.id}>
              <CardContent className="flex items-center gap-3 px-4">
                <Link href={`/creators/${creator.slug}`} className="shrink-0">
                  <Avatar className="size-10">
                    <AvatarImage src={creator.avatar_url ?? undefined} alt={creator.display_name} />
                    <AvatarFallback className="text-xs">{initials(creator.display_name)}</AvatarFallback>
                  </Avatar>
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/creators/${creator.slug}`} className="truncate font-medium hover:underline">
                    {creator.display_name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {compactNumber(creator.reach?.total_followers ?? 0)} followers
                  </div>
                </div>
                <RoiBadge score={creator.roi_scores?.score ?? null} grade={creator.roi_scores?.grade ?? null} size="sm" />
                <form action={removeCreatorFromList}>
                  <input type="hidden" name="list_id" value={list.id} />
                  <input type="hidden" name="creator_id" value={creator.id} />
                  <Button type="submit" variant="ghost" size="icon-sm" aria-label="Remove from list">
                    <X className="size-4" />
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
