import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getOrgIdForUser, getTalentLists } from "@/lib/queries";
import { requireUser } from "@/lib/auth";
import { createTalentListAndRedirect } from "@/lib/actions/lists";
import { Users } from "lucide-react";

export default async function ListsPage() {
  const user = await requireUser();
  const orgId = await getOrgIdForUser(user.id);
  const lists = orgId ? await getTalentLists(orgId) : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">Talent lists</h1>

      <form action={createTalentListAndRedirect} className="mb-4 flex gap-2">
        <Input name="name" placeholder="New list name, e.g. Q3 fitness campaign" required />
        <Button type="submit">Create</Button>
      </form>

      {lists.length === 0 ? (
        <Card>
          <CardContent className="px-4 py-10 text-center text-sm text-muted-foreground">
            No lists yet. Create one above, or save creators to a list from
            search results.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {lists.map((l) => (
            <Link key={l.id} href={`/lists/${l.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-3 px-4">
                  <Users className="size-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{l.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Created {new Date(l.created_at).toLocaleDateString()}
                    </div>
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
