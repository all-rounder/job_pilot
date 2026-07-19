import { signInWithGitHub, signInWithGoogle } from "@/actions/auth";
import { OAuthButton } from "@/components/auth/OAuthButton";
import Image from "next/image";
import Link from "next/link";

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

const errorMessages: Record<string, string> = {
  configuration: "Sign in is not configured yet. Please try again later.",
  oauth_start: "We could not start sign in. Please try your provider again.",
  oauth_callback: "Sign in was cancelled or could not be completed. Please try again.",
  session: "Your session has expired. Please sign in again.",
};

export const metadata = {
  title: "Sign in | JobPilot",
  description: "Sign in to JobPilot with Google or GitHub.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? errorMessages.oauth_callback : null;

  return (
    <main id="main-content" className="min-h-screen bg-surface">
      <a
        href="#login-card"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-3 focus:ring-2 focus:ring-accent"
      >
        Skip to sign in
      </a>

      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.08fr)_minmax(28rem,0.92fr)]">
        <section className="hero-glow relative hidden overflow-hidden border-r border-border px-12 py-10 lg:flex lg:flex-col lg:justify-between xl:px-20 xl:py-14">
          <Link href="/" aria-label="JobPilot home" className="w-fit rounded-md focus-visible:ring-2 focus-visible:ring-accent">
            <Image src="/logo.png" alt="JobPilot" width={118} height={40} className="h-8 w-auto" priority />
          </Link>

          <div className="max-w-xl py-16">
            <p className="mb-5 text-sm font-bold uppercase tracking-widest text-accent">Your job search, focused</p>
            <h1 className="text-5xl font-semibold leading-tight tracking-tight text-text-darkest xl:text-6xl">
              Better matches. Smarter preparation.
            </h1>
            <p className="mt-7 max-w-lg text-lg leading-8 text-text-secondary">
              JobPilot finds roles that fit your experience, explains the match, and researches every company before you apply.
            </p>

            <ul className="mt-10 grid gap-4 text-sm font-medium text-text-dark">
              <li className="flex items-center gap-3"><span aria-hidden="true" className="size-2 rounded-full bg-success" />AI match scores grounded in your profile</li>
              <li className="flex items-center gap-3"><span aria-hidden="true" className="size-2 rounded-full bg-info-medium" />Company research built for each role</li>
              <li className="flex items-center gap-3"><span aria-hidden="true" className="size-2 rounded-full bg-accent" />One clear workspace for every opportunity</li>
            </ul>
          </div>

          <p className="text-sm text-text-muted">Private by design. Your profile stays connected to your account.</p>
        </section>

        <section className="flex min-h-screen items-center justify-center bg-background px-4 py-10 sm:px-8 lg:px-12">
          <div id="login-card" className="w-full max-w-md rounded-xl border border-border bg-surface p-7 shadow-preview sm:p-10">
            <Link href="/" aria-label="JobPilot home" className="mb-9 inline-block rounded-md focus-visible:ring-2 focus-visible:ring-accent lg:hidden">
              <Image src="/logo.png" alt="JobPilot" width={118} height={40} className="h-8 w-auto" priority />
            </Link>

            <p className="text-sm font-semibold text-accent">Welcome to JobPilot</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-text-darkest">Sign in to continue</h2>
            <p className="mt-3 text-base leading-7 text-text-secondary">
              Choose the account you want to use for your job search workspace.
            </p>

            {errorMessage ? (
              <div role="alert" className="mt-6 rounded-lg border border-error bg-surface-secondary px-4 py-3 text-sm text-text-dark">
                <strong className="block text-error">Sign in was not completed</strong>
                <span className="mt-1 block">{errorMessage}</span>
              </div>
            ) : null}

            <div className="mt-8 grid gap-3" aria-label="Sign in providers">
              <form action={signInWithGoogle}><OAuthButton provider="Google" /></form>
              <form action={signInWithGitHub}><OAuthButton provider="GitHub" /></form>
            </div>

            <p className="mt-7 text-center text-xs leading-5 text-text-muted">
              By continuing, you agree to the <Link href="/terms" className="font-medium text-text-dark underline decoration-border-muted underline-offset-4 hover:text-accent">Terms</Link> and <Link href="/privacy" className="font-medium text-text-dark underline decoration-border-muted underline-offset-4 hover:text-accent">Privacy Policy</Link>.
            </p>

            <div className="mt-8 border-t border-border pt-6 text-center">
              <Link href="/" className="text-sm font-semibold text-text-dark hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                Back to homepage
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
