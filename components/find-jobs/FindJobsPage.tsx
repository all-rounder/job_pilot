"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  buildJobsApiPath,
  jobsQueryKey,
  parseJobsQuery,
  type JobsListing,
  type JobsMatchFilter,
  type JobsQuery,
  type JobsSortOrder,
} from "@/lib/jobs";

type FindJobsPageProps = {
  initialListing: JobsListing | null;
  initialQuery: JobsQuery;
  initialError?: string;
};

const iconPaths = {
  search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
  grid: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
  user: <><circle cx="12" cy="8" r="3" /><path d="M6.5 20a5.5 5.5 0 0 1 11 0" /></>,
  building: <><path d="M5 20V7l7-3 7 3v13" /><path d="M3 20h18M9 20v-4h6v4M9 9h.01M15 9h.01M9 12h.01M15 12h.01" /></>,
  spark: <><path d="m12 3-1.5 4.5L6 9l4.5 1.5L12 15l1.5-4.5L18 9l-4.5-1.5L12 3Z" /><path d="m19 15-.7 2.3L16 18l2.3.7L19 21l.7-2.3L16 18l2.3-.7L19 15Z" /></>,
};

function Icon({ name, className = "size-5" }: { name: keyof typeof iconPaths; className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>{iconPaths[name]}</svg>;
}

function scoreColor(score: number): string {
  if (score >= 90) return "bg-success";
  if (score >= 80) return "bg-info-medium";
  return "bg-warning";
}

function formatFoundDate(value: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return "Just now";
  const hours = Math.max(0, Math.floor((Date.now() - timestamp) / (1000 * 60 * 60)));
  if (hours < 1) return "Just now";
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

function AppHeader() {
  const nav = [
    { href: "/dashboard", label: "Dashboard", icon: "grid" as const },
    { href: "/find-jobs", label: "Find Jobs", icon: "search" as const },
    { href: "/profile", label: "Profile", icon: "user" as const },
  ];

  return <header className="border-b border-border bg-surface">
    <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6">
      <Link href="/dashboard" aria-label="JobPilot dashboard" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
        <Image src="/logo.png" alt="JobPilot" width={118} height={40} className="h-9 w-auto" priority />
      </Link>
      <nav aria-label="Primary">
        <ul className="flex h-16 items-stretch gap-2 sm:gap-7">
          {nav.map((item) => <li key={item.href}><Link href={item.href} aria-current={item.href === "/find-jobs" ? "page" : undefined} className={`flex h-full min-w-11 items-center gap-2 border-b-2 px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${item.href === "/find-jobs" ? "border-accent text-accent" : "border-transparent text-text-dark hover:text-accent"}`}><Icon name={item.icon} className="size-5" /><span className="hidden sm:inline">{item.label}</span></Link></li>)}
        </ul>
      </nav>
    </div>
  </header>;
}

type SearchSuccess = { success: true; data: { message: string; warning: string | null } };
type JobsSuccess = { success: true; data: JobsListing };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSearchSuccess(value: unknown): value is SearchSuccess {
  return isRecord(value) && value.success === true && isRecord(value.data)
    && typeof value.data.message === "string"
    && (value.data.warning === null || typeof value.data.warning === "string");
}

function readApiError(value: unknown): string {
  return isRecord(value) && value.success === false && typeof value.error === "string"
    ? value.error
    : "We could not load your jobs. Please try again.";
}

function isJobsSuccess(value: unknown): value is JobsSuccess {
  return isRecord(value) && value.success === true && isRecord(value.data)
    && Array.isArray(value.data.jobs)
    && typeof value.data.total === "number"
    && typeof value.data.page === "number"
    && typeof value.data.pageSize === "number"
    && typeof value.data.pageCount === "number";
}

export function FindJobsPage({ initialListing, initialQuery, initialError }: FindJobsPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const initialKey = jobsQueryKey(initialQuery);
  const currentQuery = useMemo(() => parseJobsQuery(searchParams), [searchParams]);
  const currentKey = jobsQueryKey(currentQuery);
  const skippedInitialLoad = useRef(false);
  const [listing, setListing] = useState<JobsListing | null>(initialListing);
  const [listingError, setListingError] = useState(initialError ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [jobTitle, setJobTitle] = useState("");
  const [location, setLocation] = useState("");
  const [searchMessage, setSearchMessage] = useState("Search for roles to add jobs to your list.");
  const [searchError, setSearchError] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!skippedInitialLoad.current && currentKey === initialKey) {
      skippedInitialLoad.current = true;
      return;
    }

    skippedInitialLoad.current = true;
    const controller = new AbortController();
    setIsLoading(true);
    setListingError("");

    fetch(buildJobsApiPath(currentQuery), { signal: controller.signal })
      .then(async (response) => {
        const result: unknown = await response.json();
        if (!response.ok || !isJobsSuccess(result)) throw new Error(readApiError(result));
        setListing(result.data);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setListingError(error instanceof Error ? error.message : "We could not load your jobs. Please try again.");
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [currentKey, initialKey, currentQuery, reloadVersion]);

  function updateQuery(changes: Partial<JobsQuery>): void {
    const nextQuery = { ...currentQuery, ...changes };
    router.replace(`${pathname}${jobsQueryKey(nextQuery)}`, { scroll: false });
  }

  async function submitSearch(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!jobTitle.trim()) {
      setSearchError("Enter a job title before searching.");
      return;
    }

    setIsSearching(true);
    setSearchError("");
    try {
      const response = await fetch("/api/agent/find", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobTitle, location }),
      });
      const result: unknown = await response.json();
      if (!response.ok || !isSearchSuccess(result)) {
        throw new Error(isRecord(result) && result.success === false && typeof result.error === "string" ? result.error : "We could not complete the job search. Please retry.");
      }
      setSearchMessage(result.data.message);
      setSearchError(result.data.warning ?? "");
      setReloadVersion((value) => value + 1);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "We could not complete the job search. Please retry.");
    } finally {
      setIsSearching(false);
    }
  }

  const page = listing?.page ?? 1;
  const pageCount = listing?.pageCount ?? 0;
  const total = listing?.total ?? 0;
  const resultStart = total === 0 ? 0 : (page - 1) * 8 + 1;
  const resultEnd = Math.min(page * 8, total);

  return <div className="min-h-screen bg-background">
    <AppHeader />
    <main id="main-content" className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
      <form onSubmit={submitSearch} className="rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-dark">Job title</span><span className="relative block"><Icon name="search" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-text-muted" /><input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="Frontend Engineer" className="min-h-14 w-full rounded-md border border-border bg-surface px-12 text-base text-text-primary shadow-sm outline-none placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20" /></span></label>
          <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-dark">Location</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Remote, New York..." className="min-h-14 w-full rounded-md border border-border bg-surface px-4 text-base text-text-primary shadow-sm outline-none placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20" /></label>
          <button type="submit" disabled={isSearching} className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-accent px-7 text-base font-semibold text-accent-foreground shadow-sm transition-colors hover:bg-accent-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"><Icon name="search" />{isSearching ? "Searching..." : "Find Jobs"}</button>
        </div>
        <div role="status" aria-live="polite" className="mt-5 flex items-center gap-3 rounded-md border border-success-light bg-success-lightest px-4 py-4 text-base font-medium text-success-darker"><Icon name="spark" className="size-5 shrink-0" />{isSearching ? "Searching Adzuna and scoring your matches..." : searchMessage}</div>
        {searchError ? <p role="alert" className="mt-3 rounded-md border border-error-light bg-error-lightest px-4 py-3 text-sm font-medium text-error-darker">{searchError}</p> : null}
      </form>

      <section aria-labelledby="results-heading" className="mt-6 rounded-xl border border-border bg-surface shadow-sm">
        <h2 id="results-heading" className="sr-only">Job search results</h2>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
          <label className="relative min-w-0 flex-1"><span className="sr-only">Filter by company or role</span><Icon name="search" className="pointer-events-none absolute left-1 top-1/2 size-5 -translate-y-1/2 text-text-muted" /><input value={currentQuery.q} onChange={(event) => updateQuery({ q: event.target.value, page: 1 })} placeholder="Filter by company or role..." className="min-h-11 w-full border-0 border-b border-border-light bg-transparent pl-8 text-base text-text-primary outline-none placeholder:text-text-muted focus:border-accent focus:ring-0" /></label>
          <div className="flex flex-col gap-3 sm:flex-row sm:border-l sm:border-border-light sm:pl-5"><label className="sr-only" htmlFor="match-filter">Match filter</label><select id="match-filter" value={currentQuery.match} onChange={(event) => updateQuery({ match: event.target.value as JobsMatchFilter, page: 1 })} className="min-h-11 rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-dark shadow-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"><option value="all">All Matches</option><option value="high">High Match</option><option value="low">Low Match</option></select><label className="sr-only" htmlFor="sort-order">Sort results</label><select id="sort-order" value={currentQuery.sort} onChange={(event) => updateQuery({ sort: event.target.value as JobsSortOrder, page: 1 })} className="min-h-11 rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-dark shadow-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"><option value="score">Match Score</option><option value="newest">Newest</option><option value="oldest">Oldest</option></select></div>
        </div>

        {listingError ? <div role="alert" className="mx-6 mb-5 rounded-md border border-error-light bg-error-lightest px-4 py-4 text-sm font-medium text-error-darker"><p>{listingError}</p><button type="button" onClick={() => setReloadVersion((value) => value + 1)} className="mt-3 min-h-10 rounded-md border border-error px-4 font-semibold hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error">Try again</button></div> : null}
        {isLoading ? <p role="status" aria-live="polite" className="px-6 py-12 text-center text-text-secondary">Loading your saved jobs...</p> : null}
        {!isLoading && !listingError && total === 0 ? <p className="px-6 py-12 text-center text-text-secondary">No jobs match your filters.</p> : null}
        {!isLoading && !listingError && total > 0 ? <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse text-left"><thead className="bg-surface-secondary"><tr className="border-y border-border"><th className="px-6 py-5 text-xs font-semibold uppercase tracking-wide text-text-secondary">Company</th><th className="px-6 py-5 text-xs font-semibold uppercase tracking-wide text-text-secondary">Role</th><th className="px-6 py-5 text-xs font-semibold uppercase tracking-wide text-text-secondary">Match score</th><th className="px-6 py-5 text-xs font-semibold uppercase tracking-wide text-text-secondary">Salary est.</th><th className="px-6 py-5 text-xs font-semibold uppercase tracking-wide text-text-secondary">Date found</th></tr></thead><tbody>{listing?.jobs.map((job) => { const score = job.match_score ?? 0; return <tr key={job.id} className="border-b border-border transition-colors hover:bg-surface-secondary"><td className="px-6 py-5"><div className="flex items-center gap-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-surface-tertiary text-text-secondary"><Icon name="building" className="size-5" /></span><span className="font-semibold text-text-darkest">{job.company}</span></div></td><td className="px-6 py-5 text-base font-medium text-text-dark">{job.title}</td><td className="px-6 py-5"><div className="flex items-center gap-3">{job.match_score === null ? <span className="font-semibold text-text-secondary">Not scored</span> : <><span className="h-2 w-28 rounded-full bg-border-muted"><span className={`block h-2 rounded-full ${scoreColor(score)}`} style={{ width: `${score}%` }} /></span><span className="font-semibold text-text-dark">{score}%</span></>}</div></td><td className="px-6 py-5 text-base text-text-secondary">{job.salary ?? "Not listed"}</td><td className="px-6 py-5 text-base text-text-secondary">{formatFoundDate(job.found_at)}</td></tr>; })}</tbody></table>
        </div> : null}

        <div className="flex flex-col gap-4 px-6 py-5 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between"><p>Showing <span className="font-semibold text-text-dark">{resultStart}</span> to <span className="font-semibold text-text-dark">{resultEnd}</span> of <span className="font-semibold text-text-dark">{total}</span> results</p><nav aria-label="Job results pages" className="flex items-center gap-2"><button type="button" disabled={page <= 1 || isLoading} onClick={() => updateQuery({ page: page - 1 })} className="min-h-10 rounded-md border border-border px-4 font-medium text-text-secondary hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50">Previous</button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => <button type="button" key={pageNumber} aria-current={page === pageNumber ? "page" : undefined} onClick={() => updateQuery({ page: pageNumber })} className={`min-h-10 min-w-10 rounded-md border px-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${page === pageNumber ? "border-accent-light bg-accent-muted text-accent" : "border-border text-text-dark hover:border-accent hover:text-accent"}`}>{pageNumber}</button>)}<button type="button" disabled={pageCount === 0 || page >= pageCount || isLoading} onClick={() => updateQuery({ page: page + 1 })} className="min-h-10 rounded-md border border-border px-4 font-medium text-text-dark hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50">Next</button></nav></div>
      </section>
    </main>
  </div>;
}
