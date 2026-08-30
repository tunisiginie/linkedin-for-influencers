import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { RoiBadge } from "@/components/roi-badge";
import { SaveToListButton } from "@/components/save-to-list-button";
import { ResolvedIcon } from "@/lib/icon-map";
import { BadgeCheck } from "lucide-react";
import type { CreatorSummary } from "@/lib/types";

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function CreatorCard({
  creator,
  withSaveAction = false,
}: {
  creator: CreatorSummary;
  withSaveAction?: boolean;
}) {
  const primaryAccount =
    creator.creator_accounts.find((a) => a.is_primary) ?? creator.creator_accounts[0];

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="flex items-start gap-3 px-4">
        <Link href={`/creators/${creator.slug}`} className="shrink-0">
          <Avatar className="size-14 border border-border">
            <AvatarImage src={creator.avatar_url ?? undefined} alt={creator.display_name} />
            <AvatarFallback>{initials(creator.display_name)}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/creators/${creator.slug}`} className="min-w-0">
              <div className="flex items-center gap-1 truncate font-semibold hover:underline">
                {creator.display_name}
                {creator.claimed_by ? (
                  <BadgeCheck className="size-4 shrink-0 text-primary" aria-label="Claimed profile" />
                ) : null}
              </div>
            </Link>
            <div className="flex shrink-0 items-center gap-1">
              <RoiBadge score={creator.roi_scores?.score ?? null} grade={creator.roi_scores?.grade ?? null} size="sm" />
              {withSaveAction ? <SaveToListButton creatorId={creator.id} /> : null}
            </div>
          </div>
          {creator.headline ? (
            <p className="truncate text-sm text-muted-foreground">{creator.headline}</p>
          ) : null}

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {primaryAccount ? (
              <span className="inline-flex items-center gap-1">
                <ResolvedIcon iconName={primaryAccount.platforms?.icon} className="size-3.5" />
                {compactNumber(creator.reach?.total_followers ?? 0)}
              </span>
            ) : null}
            {creator.country ? <span>{creator.country}</span> : null}
          </div>

          {creator.creator_categories.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {creator.creator_categories.slice(0, 3).map((cc) => (
                <Badge key={cc.category_id} variant="secondary" className="text-[10px]">
                  {cc.categories?.name}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
