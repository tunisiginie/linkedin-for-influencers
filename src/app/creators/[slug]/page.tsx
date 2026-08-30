import { notFound } from "next/navigation";
import Image from "next/image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoiBadge } from "@/components/roi-badge";
import { RoiBreakdown, RoiBreakdownLegend } from "@/components/charts/roi-breakdown";
import { GrowthChart } from "@/components/charts/growth-chart";
import { ResolvedIcon } from "@/lib/icon-map";
import { getCreatorBySlug, isCreatorContactable } from "@/lib/queries";
import { getMyClaimedCreator, getUser } from "@/lib/auth";
import { startConversation } from "@/lib/actions/conversations";
import { BadgeCheck, ExternalLink, MessageSquare } from "lucide-react";
import type { RoiComponents } from "@/lib/types";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default async function CreatorProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [creator, user, myCreator] = await Promise.all([
    getCreatorBySlug(slug),
    getUser(),
    getMyClaimedCreator(),
  ]);

  if (!creator) notFound();

  const contactable = await isCreatorContactable(creator.id);
  const isOwner = creator.claimed_by !== null && creator.claimed_by === user?.id;
  const canClaim = !creator.claimed_by && !myCreator && user;

  // Aggregate every connected account's daily snapshots into one series per
  // metric, summed by date, for the growth chart.
  const byDateFollowers = new Map<string, number>();
  const byDateViews = new Map<string, number>();
  for (const account of creator.creator_accounts) {
    for (const m of account.account_metrics) {
      byDateFollowers.set(m.snapshot_date, (byDateFollowers.get(m.snapshot_date) ?? 0) + m.followers);
      byDateViews.set(m.snapshot_date, (byDateViews.get(m.snapshot_date) ?? 0) + m.total_views);
    }
  }
  const followerSeries = Array.from(byDateFollowers.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const viewSeries = Array.from(byDateViews.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalFollowers = followerSeries.at(-1)?.value ?? 0;
  const hasRoi = creator.roi_scores?.score != null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <Card className="overflow-hidden py-0">
        <div className="relative h-32 w-full bg-gradient-to-br from-primary/30 via-accent to-secondary sm:h-44">
          {creator.cover_url ? (
            <Image
              src={creator.cover_url}
              alt=""
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 1152px"
              unoptimized
            />
          ) : null}
        </div>
        <CardContent className="relative px-5 pt-0 pb-5">
          <Avatar className="-mt-12 size-24 border-4 border-card shadow-sm">
            <AvatarImage src={creator.avatar_url ?? undefined} alt={creator.display_name} />
            <AvatarFallback className="text-xl">{initials(creator.display_name)}</AvatarFallback>
          </Avatar>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold">{creator.display_name}</h1>
                {creator.claimed_by ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    <BadgeCheck className="size-4" /> Claimed
                  </span>
                ) : null}
              </div>
              {creator.headline ? (
                <p className="mt-0.5 text-muted-foreground">{creator.headline}</p>
              ) : null}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {creator.country ? <span>{creator.country}</span> : null}
                <span>{compactNumber(totalFollowers)} total followers</span>
                {creator.years_active_since ? (
                  <span>
                    Creating since {creator.years_active_since} (
                    {new Date().getFullYear() - creator.years_active_since}y)
                  </span>
                ) : null}
              </div>
              {creator.creator_categories.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {creator.creator_categories.map((cc) => (
                    <Badge key={cc.category_id} variant="secondary">
                      {cc.categories?.name}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
              <RoiBadge score={creator.roi_scores?.score ?? null} grade={creator.roi_scores?.grade ?? null} size="lg" />

              {isOwner ? (
                <LinkButton href="/settings" variant="outline" size="sm">
                  Edit your profile
                </LinkButton>
              ) : user ? (
                contactable ? (
                  <form action={startConversation}>
                    <input type="hidden" name="creator_id" value={creator.id} />
                    <Button type="submit" size="sm">
                      <MessageSquare className="size-4" /> Message
                    </Button>
                  </form>
                ) : (
                  <p className="max-w-48 text-right text-xs text-muted-foreground">
                    Not currently accepting new outreach.
                  </p>
                )
              ) : (
                <LinkButton href="/login" size="sm">
                  Log in to contact
                </LinkButton>
              )}

              {canClaim ? (
                <LinkButton href={`/claim/${creator.slug}`} variant="ghost" size="sm">
                  Is this you? Claim this profile
                </LinkButton>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-4">
          {creator.bio ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">About</CardTitle>
              </CardHeader>
              <CardContent className="px-4 text-sm whitespace-pre-line text-foreground/90">
                {creator.bio}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Growth</CardTitle>
            </CardHeader>
            <CardContent className="px-4">
              <Tabs defaultValue="followers">
                <TabsList>
                  <TabsTrigger value="followers">Followers</TabsTrigger>
                  <TabsTrigger value="views">Total views</TabsTrigger>
                </TabsList>
                <TabsContent value="followers">
                  <GrowthChart data={followerSeries} label="Followers" />
                </TabsContent>
                <TabsContent value="views">
                  <GrowthChart data={viewSeries} label="Total views" />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Connected platforms</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 px-4 sm:grid-cols-2">
              {creator.creator_accounts.map((account) => {
                const latest = account.account_metrics.at(-1);
                return (
                  <div key={account.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-medium">
                        <ResolvedIcon iconName={account.platforms?.icon} className="size-4 text-muted-foreground" />
                        {account.platforms?.name}
                      </span>
                      {account.url ? (
                        <a
                          href={account.url}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="size-3.5" />
                        </a>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground">@{account.handle}</p>
                    {latest ? (
                      <dl className="mt-2 grid grid-cols-3 gap-1 text-center text-xs">
                        <div>
                          <dt className="text-muted-foreground">Followers</dt>
                          <dd className="font-semibold tabular-nums">{compactNumber(latest.followers)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Avg views</dt>
                          <dd className="font-semibold tabular-nums">{compactNumber(latest.avg_views)}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">Uploads</dt>
                          <dd className="font-semibold tabular-nums">{compactNumber(latest.upload_count)}</dd>
                        </div>
                      </dl>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground">No metrics yet.</p>
                    )}
                  </div>
                );
              })}
              {creator.creator_accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground sm:col-span-2">
                  No platform accounts connected yet.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">ROI score breakdown</CardTitle>
            </CardHeader>
            <CardContent className="px-4">
              {hasRoi ? (
                <>
                  <RoiBreakdown components={creator.roi_scores!.components as RoiComponents} />
                  <p className="mt-4 text-xs text-muted-foreground">
                    Weighted composite, 0–1000. Every component below is computed from
                    this creator&apos;s own metrics history — nothing here is
                    self-reported.
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Not enough metrics history yet to compute a score (needs at
                  least 30 days).
                </p>
              )}
            </CardContent>
          </Card>

          {hasRoi ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">What each component measures</CardTitle>
              </CardHeader>
              <CardContent className="px-4">
                <RoiBreakdownLegend />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
