import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { createInsForgeServerClient } from "@/lib/insforge-server";

export const metadata = {
  title: "Dashboard | JobPilot",
};

export default async function DashboardRoute() {
  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.auth.getCurrentUser();
  const displayName = data.user?.profile?.name || data.user?.email || "there";

  return <DashboardPage displayName={displayName} />;
}
