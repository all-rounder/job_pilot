import Image from "next/image";
import Link from "next/link";

export function Hero() {
  return (
    <section aria-labelledby="hero-title">
      <div className="hero-glow flex flex-col items-center px-5 py-16 text-center sm:py-20 lg:py-24">
        <h1 id="hero-title" className="max-w-4xl text-balance text-4xl font-bold tracking-tight text-text-black sm:text-5xl lg:text-6xl lg:leading-[1.08]">
          Job hunting is hard.<br />Your tools shouldn&apos;t be.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-text-secondary">Stop applying blind. JobPilot finds the jobs, researches the companies, and<br className="hidden sm:block" /> gives you everything you need to stand out.</p>
        <div className="mt-8 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
          <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-md bg-overlay px-6 text-sm font-medium text-surface hover:bg-overlay-dark focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">Get Started <span aria-hidden="true" className="ms-2">›</span></Link>
          <Link href="/find-jobs" className="inline-flex min-h-11 items-center justify-center rounded-md border border-border-muted bg-surface/70 px-6 text-sm font-medium text-text-primary hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">Find Your First Match</Link>
        </div>
      </div>
      <div className="bg-surface-tertiary px-5 py-12 sm:px-12 lg:px-16 lg:py-14">
        <figure className="mx-auto overflow-hidden rounded-xl bg-surface shadow-preview">
          <div className="flex h-12 items-center border-b border-border px-5" aria-hidden="true">
            <div className="flex gap-2"><span className="h-2 w-2 rounded-full bg-border" /><span className="h-2 w-2 rounded-full bg-border" /><span className="h-2 w-2 rounded-full bg-border" /></div>
            <div className="mx-auto rounded-md bg-surface-secondary px-16 py-2 text-xs text-text-muted">jobpilot.ai/dashboard</div>
          </div>
          <Image src="/images/dashboard-demo.png" alt="JobPilot dashboard showing job search statistics, recent activity, and research analytics" width={1197} height={604} className="h-auto w-full" priority />
        </figure>
      </div>
    </section>
  );
}
