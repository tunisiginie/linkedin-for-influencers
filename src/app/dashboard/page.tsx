import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoiBadge } from "@/components/roi-badge";
import { RoiBreakdown } from "@/components/charts/roi-breakdown";
import { GrowthChart } from "@/components/charts/growth-chart";
import {
  getConversationsForUser,
  getCreatorById,
  getOrgIdForUser,
  getOrgProducts,
  getTalentLists,
} from "@/lib/queries";
import { getMyClaimedCreator, getRole, requireUser } from "@/lib/auth";
import { MessageSquare, Package, Search, Users } from "lucide-react";
import type { RoiComponents } from "@/lib/types";

export default async function DashboardPage() {
  const user = await requireUser();
  const role = await getRole();
  const myCreator = role === "creator" ? await getMyClaimedCreator() : null;

  if (role === "creator" && !myCreator) {
    // Declared as a creator but hasn't claimed a profile yet — this used to
    // silently fall through to the sponsor dashboard, which made no sense
    // for someone who just signed up as a creator.
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Claim your creator profile</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <p className="text-sm text-muted-foreground">
              You&apos;re signed up as a creator, but haven&apos;t claimed your auto-generated
              profile yet. Find it and verify ownership to unlock your dashboard, ROI score, and
              inbox.
            </p>
            <LinkButton href="/claim" size="sm" className="mt-4">
              Find and claim your profile
            </LinkButton>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (myCreator) {
    const [creator, conversations] = await Promise.all([
      getCreatorById(myCreator.id),
      getConversationsForUser(user.id, "creator"),
    ]);

    const byDateFollowers = new Map<string, number>();
    for (const account of creator?.creator_accounts ?? []) {
      for (const m of account.account_metrics) {
        byDateFollowers.set(m.snapshot_date, (byDateFollowers.get(m.snapshot_date) ?? 0) + m.followers);
      }
    }
    const followerSeries = Array.from(byDateFollowers.entries())
      .map(([date, value]) => ({ date, value }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Your creator dashboard</h1>
          <LinkButton href={`/creators/${myCreator.slug}`} variant="outline" size="sm">
            View public profile
          </LinkButton>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Follower growth</CardTitle>
              </CardHeader>
              <CardContent className="px-4">
                <GrowthChart data={followerSeries} label="Followers" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Recent conversations</CardTitle>
              </CardHeader>
              <CardContent className="px-4">
                {conversations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No sponsors have reached out yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {conversations.slice(0, 5).map((c) => (
                      <Link
                        key={c.id}
                        href={`/messages/${c.id}`}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                      >
                        <MessageSquare className="size-4 text-muted-foreground" />
                        {c.organizations?.name ?? "Unknown organization"}
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Your ROI score</CardTitle>
            </CardHeader>
            <CardContent className="px-4">
              <RoiBadge
                score={creator?.roi_scores?.score ?? null}
                grade={creator?.roi_scores?.grade ?? null}
                size="lg"
              />
              {creator?.roi_scores?.score != null ? (
                <div className="mt-4">
                  <RoiBreakdown
                    components={creator.roi_scores.components as RoiComponents}
                    confidence={creator.roi_scores.confidence}
                    reasons={creator.roi_scores.reasons}
                  />
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  Not enough history yet to compute a score.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Sponsor dashboard
  const orgId = await getOrgIdForUser(user.id);
  const [conversations, lists, products] = await Promise.all([
    getConversationsForUser(user.id, "sponsor"),
    orgId ? getTalentLists(orgId) : Promise.resolve([]),
    orgId ? getOrgProducts(orgId) : Promise.resolve([]),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Sponsor dashboard</h1>
        <LinkButton href="/search" size="sm">
          <Search className="size-4" /> Find creators
        </LinkButton>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Products</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            {products.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No products yet. Add one to get a matched-creators feed.
              </p>
            ) : (
              <div className="space-y-2">
                {products.slice(0, 5).map((p) => (
                  <Link
                    key={p.id}
                    href={`/products/${p.id}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <Package className="size-4 text-muted-foreground" />
                    {p.name}
                  </Link>
                ))}
              </div>
            )}
            <LinkButton href="/products" variant="ghost" size="sm" className="mt-2 w-full">
              Manage products
            </LinkButton>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Talent lists</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            {lists.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No saved lists yet. Save creators from search results.
              </p>
            ) : (
              <div className="space-y-2">
                {lists.map((l) => (
                  <Link
                    key={l.id}
                    href={`/lists/${l.id}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <Users className="size-4 text-muted-foreground" />
                    {l.name}
                  </Link>
                ))}
              </div>
            )}
            <LinkButton href="/lists" variant="ghost" size="sm" className="mt-2 w-full">
              Manage lists
            </LinkButton>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Conversations</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            {conversations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No conversations yet. Message a creator from their profile.
              </p>
            ) : (
              <div className="space-y-2">
                {conversations.slice(0, 5).map((c) => (
                  <Link
                    key={c.id}
                    href={`/messages/${c.id}`}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <span className="flex items-center gap-2">
                      <MessageSquare className="size-4 text-muted-foreground" />
                      {c.creators?.display_name ?? "Unknown creator"}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {new Date(c.updated_at).toLocaleDateString()}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
            <LinkButton href="/messages" variant="ghost" size="sm" className="mt-2 w-full">
              Open inbox
            </LinkButton>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
