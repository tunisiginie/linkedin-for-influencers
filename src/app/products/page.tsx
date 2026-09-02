import Link from "next/link";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getOrgIdForUser, getOrgProducts } from "@/lib/queries";
import { requireUser } from "@/lib/auth";
import { createOrgProductAndRedirect } from "@/lib/actions/products";

export default async function ProductsPage() {
  const user = await requireUser();
  const orgId = await getOrgIdForUser(user.id);
  const products = orgId ? await getOrgProducts(orgId) : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-semibold">Products</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        What you&apos;re looking to place. Each product gets its own matched-creators feed.
      </p>

      <form action={createOrgProductAndRedirect} className="mb-4 flex gap-2">
        <Input name="name" placeholder="New product name, e.g. Summer protein launch" required />
        <Button type="submit">Create</Button>
      </form>

      {products.length === 0 ? (
        <Card>
          <CardContent className="px-4 py-10 text-center text-sm text-muted-foreground">
            No products yet. Create one above to see matched creators.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {products.map((p) => (
            <Link key={p.id} href={`/products/${p.id}`}>
              <Card className="transition-shadow hover:shadow-[var(--shadow-md)]">
                <CardContent className="flex items-center gap-3 px-4">
                  <Package className="size-5 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="truncate font-medium">{p.name}</div>
                    {p.topics.length > 0 ? (
                      <div className="truncate text-xs text-muted-foreground">
                        {p.topics.join(", ")}
                      </div>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
