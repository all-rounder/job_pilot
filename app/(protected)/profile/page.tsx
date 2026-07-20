import type { Metadata } from "next";

import { ProfilePage } from "@/components/profile/ProfilePage";
import { createInsForgeServerClient } from "@/lib/insforge-server";
import { getProfileCompletion, profileFromRow } from "@/lib/profile";

export const metadata: Metadata = {
  title: "Profile | JobPilot",
  description: "Manage your JobPilot career profile and resume.",
};

export default async function Page() {
  const insforge = await createInsForgeServerClient();
  const { data: authData } = await insforge.auth.getCurrentUser();
  const user = authData.user;

  if (!user?.email) {
    return <ProfilePage profile={profileFromRow(null, "")} completion={getProfileCompletion(profileFromRow(null, ""))} loadError="We could not load your authenticated profile. Sign in again and retry." />;
  }

  const { data, error } = await insforge.database
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  const profile = profileFromRow(data as Record<string, unknown> | null, user.email);

  return (
    <ProfilePage
      profile={profile}
      completion={getProfileCompletion(profile)}
      loadError={error ? "We could not load your saved profile. Refresh the page to retry." : undefined}
    />
  );
}
