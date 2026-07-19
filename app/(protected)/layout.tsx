import { PostHogIdentify } from "@/components/analytics/PostHogIdentify";
import { createInsForgeServerClient } from "@/lib/insforge-server";
import { redirect } from "next/navigation";

export default async function ProtectedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const insforge = await createInsForgeServerClient();
  const { data, error } = await insforge.auth.getCurrentUser();

  if (error || !data.user) {
    redirect("/login?error=session");
  }

  return (
    <>
      <PostHogIdentify userId={data.user.id} />
      {children}
    </>
  );
}
