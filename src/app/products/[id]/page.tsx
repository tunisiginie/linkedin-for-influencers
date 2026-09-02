import { notFound } from "next/navigation";
import Link from "next/link";
import { Trash2, Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoiBadge } from "@/components/roi-badge";
import { getCategories, getMatchesForProduct, getOrgProductById } from "@/lib/queries";
import { requireUser } from "@/lib/auth";
import { deleteOrgProduct, updateOrgProduct } from "@/lib/actions/products";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const [product, categories] = await Promise.all([getOrgProductById(id), getCategories()]);
  if (!product) notFound();

  const matches = await getMatchesForProduct(id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{product.name}</h1>
        <form action={deleteOrgProduct}>
          <input type="hidden" name="product_id" value={product.id} />
          <Button type="submit" variant="ghost" size="sm">
            <Trash2 className="size-4" /> Delete
          </Button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-sm">Product details</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <form action={updateOrgProduct} className="space-y-3">
              <input type="hidden" name="product_id" value={product.id} />
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" defaultValue={product.name} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={3}
                  defaultValue={product.description ?? ""}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  key={product.updated_at}
                  name="category_id"
                  items={[
                    { value: "", label: "No category" },
                    ...categories.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                  defaultValue={product.category_id ?? ""}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No category</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="topics">Topics</Label>
                <Input
                  id="topics"
                  name="topics"
                  placeholder="skincare, mobile games, protein powder"
                  defaultValue={product.topics.join(", ")}
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated. Matched against what creators say they&apos;ll promote.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="target_audience">Target audience</Label>
                <Input
                  id="target_audience"
                  name="target_audience"
                  defaultValue={product.target_audience ?? ""}
                />
              </div>
              <Button type="submit" size="sm">
                Save
              </Button>
            </form>
          </CardContent>
        </Card>

        <div>
          <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
            <Sparkles className="size-4" /> Matched creators
          </div>
          {matches.length === 0 ? (
            <Card>
              <CardContent className="px-4 py-10 text-center text-sm text-muted-foreground">
                No matches yet. Add topics above, or add a category — matching improves once
                creators have set their own sponsorship preferences too.
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {matches.map(({ match, creator }) => (
                <Card key={creator.id}>
                  <CardContent className="flex items-center gap-3 px-4">
                    <Link href={`/creators/${creator.slug}`} className="shrink-0">
                      <Avatar className="size-10">
                        <AvatarImage src={creator.avatar_url ?? undefined} alt={creator.display_name} />
                        <AvatarFallback className="text-xs">{initials(creator.display_name)}</AvatarFallback>
                      </Avatar>
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/creators/${creator.slug}`}
                        className="truncate font-medium hover:underline"
                      >
                        {creator.display_name}
                      </Link>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{compactNumber(creator.reach?.total_followers ?? 0)} followers</span>
                        {match.category_match ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Category match
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <RoiBadge
                        score={creator.roi_scores?.score ?? null}
                        grade={creator.roi_scores?.grade ?? null}
                        size="sm"
                      />
                      <span className="text-xs text-muted-foreground">
                        {Math.round(match.match_score)}% match
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
