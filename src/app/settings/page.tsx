import { Button, LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { OptOutSwitch } from "@/components/settings/opt-out-switch";
import { DeletionRequestButton } from "@/components/settings/deletion-request-button";
import {
  getContactPreferences,
  getCreatorPreferences,
  getOrganizationById,
  getOrgIdForUser,
} from "@/lib/queries";
import { getMyClaimedCreator, getProfile, getRole, requireUser } from "@/lib/auth";
import {
  updateCreatorPreferences,
  updateCreatorProfile,
  updateOrganization,
  updateProfile,
} from "@/lib/actions/settings";

export default async function SettingsPage() {
  const user = await requireUser();
  const [profile, role, myCreator] = await Promise.all([
    getProfile(),
    getRole(),
    getMyClaimedCreator(),
  ]);
  const isCreatorRole = role === "creator";

  const contactPrefs = myCreator ? await getContactPreferences(myCreator.id) : null;
  const sponsorshipPrefs = myCreator ? await getCreatorPreferences(myCreator.id) : null;
  const orgId = !isCreatorRole ? await getOrgIdForUser(user.id) : null;
  const org = orgId ? await getOrganizationById(orgId) : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-xl font-semibold">Settings</h1>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Profile</CardTitle>
          </CardHeader>
          <CardContent className="px-4">
            <form action={updateProfile} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="full_name">Full name</Label>
                <Input id="full_name" name="full_name" defaultValue={profile?.full_name ?? ""} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={profile?.email ?? ""} disabled />
              </div>
              <Button type="submit" size="sm">
                Save
              </Button>
            </form>
          </CardContent>
        </Card>

        {isCreatorRole && myCreator ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Creator profile</CardTitle>
              </CardHeader>
              <CardContent className="px-4">
                <form action={updateCreatorProfile} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="headline">Headline</Label>
                    <Input id="headline" name="headline" defaultValue={myCreator.headline ?? ""} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea id="bio" name="bio" rows={4} defaultValue={myCreator.bio ?? ""} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="country">Country</Label>
                    <Input id="country" name="country" defaultValue={myCreator.country ?? ""} className="w-24" />
                  </div>
                  <Button type="submit" size="sm">
                    Save
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Sponsorship preferences</CardTitle>
              </CardHeader>
              <CardContent className="px-4">
                <p className="mb-3 text-xs text-muted-foreground">
                  Shown on your public profile so sponsors can see fit before reaching out.
                  Separate entries with commas.
                </p>
                <form action={updateCreatorPreferences} className="space-y-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium">Open to sponsorships</p>
                      <p className="text-xs text-muted-foreground">
                        Turn off to signal you&apos;re not currently taking new deals.
                      </p>
                    </div>
                    <Switch
                      key={sponsorshipPrefs?.updated_at ?? "unset"}
                      name="open_to_sponsorships"
                      value="true"
                      defaultChecked={sponsorshipPrefs?.open_to_sponsorships ?? true}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="product_types">Product types you&apos;ll promote</Label>
                    <Input
                      id="product_types"
                      name="product_types"
                      placeholder="skincare, mobile games, protein powder"
                      defaultValue={(sponsorshipPrefs?.product_types ?? []).join(", ")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="products_i_use">Brands/products you already use</Label>
                    <Input
                      id="products_i_use"
                      name="products_i_use"
                      placeholder="e.g. brands you'd genuinely endorse"
                      defaultValue={(sponsorshipPrefs?.products_i_use ?? []).join(", ")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="dream_brands">Dream brands to work with</Label>
                    <Input
                      id="dream_brands"
                      name="dream_brands"
                      defaultValue={(sponsorshipPrefs?.dream_brands ?? []).join(", ")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="excluded_topics">Won&apos;t promote</Label>
                    <Input
                      id="excluded_topics"
                      name="excluded_topics"
                      placeholder="gambling, alcohol, crypto"
                      defaultValue={(sponsorshipPrefs?.excluded_topics ?? []).join(", ")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="content_formats">Formats you produce</Label>
                    <Input
                      id="content_formats"
                      name="content_formats"
                      placeholder="long-form, shorts, livestream"
                      defaultValue={(sponsorshipPrefs?.content_formats ?? []).join(", ")}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="min_rate_dollars">Minimum rate (USD, optional)</Label>
                    <Input
                      id="min_rate_dollars"
                      name="min_rate_dollars"
                      type="number"
                      min={0}
                      step="1"
                      className="w-32"
                      defaultValue={
                        sponsorshipPrefs?.min_rate_cents != null
                          ? String(Math.round(sponsorshipPrefs.min_rate_cents / 100))
                          : ""
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="rate_notes">Rate notes</Label>
                    <Textarea
                      id="rate_notes"
                      name="rate_notes"
                      rows={2}
                      placeholder="Visible on your profile, e.g. 'rates negotiable for long-term partnerships'"
                      defaultValue={sponsorshipPrefs?.rate_notes ?? ""}
                    />
                  </div>
                  <Button type="submit" size="sm">
                    Save
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Contact preferences</CardTitle>
              </CardHeader>
              <CardContent className="px-4">
                <OptOutSwitch initialOptedOut={Boolean(contactPrefs?.opt_out_at)} />
                <Separator className="my-4" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-destructive">Danger zone</p>
                  <DeletionRequestButton alreadyRequested={Boolean(contactPrefs?.deletion_requested_at)} />
                </div>
              </CardContent>
            </Card>
          </>
        ) : isCreatorRole ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Creator profile</CardTitle>
            </CardHeader>
            <CardContent className="px-4">
              <p className="text-sm text-muted-foreground">
                You haven&apos;t claimed your creator profile yet, so there&apos;s nothing to edit
                here.
              </p>
              <LinkButton href="/claim" size="sm" className="mt-3">
                Find and claim your profile
              </LinkButton>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Organization</CardTitle>
            </CardHeader>
            <CardContent className="px-4">
              <form action={updateOrganization} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Organization name</Label>
                  <Input id="name" name="name" defaultValue={org?.name ?? ""} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="website">Website</Label>
                  <Input id="website" name="website" defaultValue={org?.website ?? ""} placeholder="https://" />
                </div>
                <Button type="submit" size="sm">
                  Save
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
