import { notFound, redirect } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BioTokenClaim } from "@/components/claim/bio-token-claim";
import { getCreatorBySlug } from "@/lib/queries";
import { getMyClaimedCreator, requireUser } from "@/lib/auth";

function initials(name: string): string {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

export default async function ClaimCreatorPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;
  const { error } = await searchParams;

  const [creator, myCreator] = await Promise.all([getCreatorBySlug(slug), getMyClaimedCreator()]);
  if (!creator) notFound();
  if (myCreator?.id === creator.id) redirect("/settings");

  const primaryAccount = creator.creator_accounts.find((a) => a.is_primary) ?? creator.creator_accounts[0];
  const isYoutube = primaryAccount?.platforms?.slug === "youtube";
  const googleConfigured = Boolean(process.env.GOOGLE_OAUTH_CLIENT_ID);

  const ERROR_MESSAGES: Record<string, string> = {
    mismatch: "That Google account doesn't own this channel.",
    no_channel: "Couldn't find a YouTube channel on that Google account.",
    not_configured: "Google verification isn't available on this deployment yet.",
    failed: "Verification failed. Please try again.",
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Card className="mb-4">
        <CardContent className="flex items-center gap-3 px-4">
          <Avatar className="size-14">
            <AvatarImage src={creator.avatar_url ?? undefined} alt={creator.display_name} />
            <AvatarFallback>{initials(creator.display_name)}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-semibold">{creator.display_name}</div>
            {creator.headline ? (
              <div className="text-sm text-muted-foreground">{creator.headline}</div>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {creator.claimed_by ? (
        <Card>
          <CardContent className="px-4 py-6 text-center text-sm text-muted-foreground">
            This profile has already been claimed.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Verify ownership</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-4">
            {error ? (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {ERROR_MESSAGES[error] ?? "Something went wrong."}
              </p>
            ) : null}

            {isYoutube && primaryAccount ? (
              <div>
                <p className="mb-2 text-sm text-muted-foreground">
                  Fastest way: sign in with the Google account that owns this
                  YouTube channel.
                </p>
                {googleConfigured ? (
                  <LinkButton
                    href={`/api/claim/youtube/start?creator_id=${creator.id}&slug=${creator.slug}`}
                    size="sm"
                  >
                    Verify with Google
                  </LinkButton>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Google verification isn&apos;t configured on this
                    deployment — use bio verification below.
                  </p>
                )}
              </div>
            ) : null}

            {isYoutube ? <Separator /> : null}

            <div>
              <p className="mb-2 text-sm text-muted-foreground">
                Or verify by temporarily adding a code to your channel bio.
              </p>
              <BioTokenClaim creatorId={creator.id} />
            </div>
          </CardContent>
        </Card>
      )}

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Signed in as {user.email}
      </p>
    </div>
  );
}
