import Image from "next/image";
import Link from "next/link";

export function Testimonial() {
  return (
    <>
      <section aria-labelledby="testimonial-title" className="section-divider border-y border-border px-6 py-20 text-center sm:py-24">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">Success Stories</p>
        <h2 id="testimonial-title" className="mx-auto mt-7 max-w-4xl text-2xl font-medium leading-snug text-text-darker sm:text-3xl">“I used to spend my evenings copy-pasting resumes. Now I open my dashboard to see interviews waiting. It feels like cheating. Had 3 offers on the table simultaneously.”</h2>
        <div className="mt-7 flex items-center justify-center gap-3 text-start">
          <Image src="/images/user-icon.png" alt="Tom Wilson" width={48} height={48} className="h-12 w-12 rounded-md object-cover" />
          <p className="text-sm font-semibold text-text-primary">Tom Wilson<br /><span className="text-xs font-normal text-text-secondary">Junior Developer</span></p>
        </div>
      </section>
      <section aria-labelledby="cta-title" className="hero-glow px-6 py-20 text-center sm:py-24">
        <h2 id="cta-title" className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-text-black sm:text-5xl">Your next job search can feel a<br className="hidden sm:block" /> lot less overwhelming</h2>
        <p className="mt-6 text-base text-text-secondary">Set up your profile, upload your resume, and start finding matches in minutes.</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/login" className="inline-flex min-h-11 items-center justify-center rounded-md bg-overlay px-6 text-sm font-medium text-surface hover:bg-overlay-dark focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">Get Started <span aria-hidden="true" className="ms-2">›</span></Link>
          <Link href="/find-jobs" className="inline-flex min-h-11 items-center justify-center rounded-md border border-border-muted bg-surface/70 px-6 text-sm font-medium text-text-primary hover:bg-surface focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">Find Your First Match</Link>
        </div>
      </section>
    </>
  );
}
