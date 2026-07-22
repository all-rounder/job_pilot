import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { getDashboardActivity } from "@/lib/dashboard-activity";
import { getDashboardStats } from "@/lib/dashboard-stats";
import { createInsForgeServerClient } from "@/lib/insforge-server";

export const metadata = {
  title: "Dashboard | JobPilot",
};

export default async function DashboardRoute() {
  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.auth.getCurrentUser();
  const displayName = data.user?.profile?.name || data.user?.email || "there";
  const stats = data.user
    ? await getDashboardStats(insforge.database, data.user.id)
    : [];
  const recentActivity = data.user
    ? await getDashboardActivity(insforge.database, data.user.id)
    : [];

  return <DashboardPage displayName={displayName} stats={stats} recentActivity={recentActivity} />;
}
