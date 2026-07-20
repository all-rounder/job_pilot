export default function Loading() {
  return (
    <main id="main-content" className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6 sm:py-10" aria-busy="true" aria-label="Loading profile">
      <div className="h-40 animate-pulse rounded-xl border border-border bg-surface" />
      <div className="h-80 animate-pulse rounded-xl border border-border bg-surface" />
      <div className="h-96 animate-pulse rounded-xl border border-border bg-surface" />
    </main>
  );
}
