import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { OptOutSwitch } from "@/components/settings/opt-out-switch";
import { DeletionRequestButton } from "@/components/settings/deletion-request-button";
import { getContactPreferences, getOrganizationById, getOrgIdForUser } from "@/lib/queries";
import { getMyClaimedCreator, getProfile, requireUser } from "@/lib/auth";
import {
  updateCreatorProfile,
  updateOrganization,
  updateProfile,
} from "@/lib/actions/settings";

export default async function SettingsPage() {
  const user = await requireUser();
  const [profile, myCreator] = await Promise.all([getProfile(), getMyClaimedCreator()]);

  const contactPrefs = myCreator ? await getContactPreferences(myCreator.id) : null;
  const orgId = !myCreator ? await getOrgIdForUser(user.id) : null;
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

        {myCreator ? (
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
