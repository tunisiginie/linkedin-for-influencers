import { redirect } from "next/navigation";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchCreators } from "@/lib/queries";
import { getMyClaimedCreator, requireUser } from "@/lib/auth";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default async function ClaimSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requireUser();
  const myCreator = await getMyClaimedCreator();
  if (myCreator) redirect("/settings");

  const { q } = await searchParams;
  const { creators } = q ? await searchCreators({ q, limit: 10 }) : { creators: [] };

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="mb-1 text-xl font-semibold">Claim your creator profile</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Find your auto-generated profile below, then verify ownership to
        claim it.
      </p>

      <form className="mb-4 flex gap-2">
        <Input name="q" defaultValue={q ?? ""} placeholder="Search your name or channel handle" />
        <Button type="submit">Search</Button>
      </form>

      {q && creators.length === 0 ? (
        <Card>
          <CardContent className="px-4 py-8 text-center text-sm text-muted-foreground">
            No matching profile found. If we haven&apos;t indexed your
            channel yet, check back after the next ingestion run.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {creators.map((c) => (
            <Link key={c.id} href={`/claim/${c.slug}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-3 px-4">
                  <Avatar className="size-10">
                    <AvatarImage src={c.avatar_url ?? undefined} alt={c.display_name} />
                    <AvatarFallback className="text-xs">{initials(c.display_name)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{c.display_name}</div>
                    {c.headline ? (
                      <div className="text-xs text-muted-foreground">{c.headline}</div>
                    ) : null}
                  </div>
                  {c.claimed_by ? (
                    <span className="ml-auto text-xs text-muted-foreground">Already claimed</span>
                  ) : null}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
