import { signOut } from "@/actions/auth";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { createInsForgeServerClient } from "@/lib/insforge-server";
import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Dashboard | JobPilot",
};

export default async function DashboardPage() {
  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.auth.getCurrentUser();
  const displayName = data.user?.profile?.name || data.user?.email || "there";

  return (
    <main id="main-content" className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
          <Link href="/dashboard" aria-label="JobPilot dashboard" className="rounded-md focus-visible:ring-2 focus-visible:ring-accent">
            <Image src="/logo.png" alt="JobPilot" width={118} height={40} className="h-8 w-auto" priority />
          </Link>
          <form action={signOut}><SignOutButton /></form>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-8">
        <div className="rounded-xl border border-border bg-surface p-8 shadow-sm sm:p-12">
          <p className="text-sm font-semibold text-accent">Authentication complete</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-text-darkest">Welcome, {displayName}</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-text-secondary">
            Your JobPilot account is ready. The full dashboard arrives in Phase 5, after your profile and job matching tools are connected.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/profile" className="inline-flex min-h-11 items-center rounded-md bg-overlay px-5 text-sm font-semibold text-surface hover:bg-overlay-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
              Set up your profile
            </Link>
            <Link href="/" className="inline-flex min-h-11 items-center rounded-md border border-border px-5 text-sm font-semibold text-text-dark hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
              Return home
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
