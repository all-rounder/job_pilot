import { signOut } from "@/actions/auth";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { createInsForgeServerClient } from "@/lib/insforge-server";
import Image from "next/image";
import Link from "next/link";

export const metadata = {
  title: "Profile | JobPilot",
};

export default async function ProfilePage() {
  const insforge = await createInsForgeServerClient();
  const { data } = await insforge.auth.getCurrentUser();
  const displayName = data.user?.profile?.name || "JobPilot member";
  const email = data.user?.email || "Email unavailable";
  const initial = displayName.trim().charAt(0).toUpperCase() || "J";

  return (
    <main id="main-content" className="min-h-screen bg-background">
      <a href="#profile-content" className="sr-only focus:not-sr-only">
        Skip to profile
      </a>

      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
          <Link
            href="/dashboard"
            aria-label="JobPilot dashboard"
            className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Image src="/logo.png" alt="JobPilot" width={118} height={40} className="h-8 w-auto" priority />
          </Link>

          <nav aria-label="Account navigation" className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex min-h-11 items-center rounded-md px-3 text-sm font-semibold text-text-dark hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Dashboard
            </Link>
            <form action={signOut}>
              <SignOutButton />
            </form>
          </nav>
        </div>
      </header>

      <section id="profile-content" className="mx-auto max-w-7xl px-4 py-12 sm:px-8 sm:py-16">
        <div className="mb-8 max-w-2xl">
          <p className="text-sm font-semibold text-accent">Your account</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-text-darkest">Profile</h1>
          <p className="mt-4 text-base leading-7 text-text-secondary">
            This is the identity connected to your private JobPilot workspace. Your full career profile and resume tools arrive in Phase 2.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <section aria-labelledby="account-heading" className="rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8 lg:col-span-2">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-full bg-accent-light text-2xl font-semibold text-accent">
                {initial}
              </div>
              <div className="min-w-0">
                <h2 id="account-heading" className="text-2xl font-semibold text-text-darkest">{displayName}</h2>
                <p className="mt-1 break-words text-base text-text-secondary">{email}</p>
              </div>
            </div>

            <dl className="mt-8 grid gap-4 border-t border-border pt-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-text-secondary">Account status</dt>
                <dd className="mt-2 font-semibold text-success-dark">Signed in</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-text-secondary">Profile details</dt>
                <dd className="mt-2 font-semibold text-text-darkest">Not set up yet</dd>
              </div>
            </dl>
          </section>

          <aside aria-labelledby="next-heading" className="rounded-xl border border-border bg-surface-secondary p-6 sm:p-8">
            <p className="text-sm font-semibold text-accent">Coming next</p>
            <h2 id="next-heading" className="mt-2 text-xl font-semibold text-text-darkest">Build your job search profile</h2>
            <p className="mt-3 text-sm leading-6 text-text-secondary">
              Add your experience, skills, preferred roles, and resume so JobPilot can score jobs against what you actually want.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex min-h-11 items-center rounded-md bg-overlay px-5 text-sm font-semibold text-surface hover:bg-overlay-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Return to dashboard
            </Link>
          </aside>
        </div>
      </section>
    </main>
  );
}
