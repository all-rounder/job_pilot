"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

type MatchFilter = "all" | "strong" | "other";
type SortOrder = "score" | "newest" | "oldest";

type Job = {
  id: number;
  company: string;
  role: string;
  score: number;
  salary: string;
  date: string;
  age: number;
};

const jobs: Job[] = [
  { id: 1, company: "Vercel", role: "Senior Frontend Engineer", score: 94, salary: "$160k - $200k", date: "2 hours ago", age: 0 },
  { id: 2, company: "Stripe", role: "Staff UI Engineer", score: 88, salary: "$180k - $240k", date: "Yesterday", age: 1 },
  { id: 3, company: "Linear", role: "Product Engineer", score: 96, salary: "$150k - $190k", date: "Yesterday", age: 1 },
  { id: 4, company: "Notion", role: "Frontend Developer", score: 72, salary: "$130k - $170k", date: "2 days ago", age: 2 },
  { id: 5, company: "OpenAI", role: "Design Engineer", score: 91, salary: "$200k - $280k", date: "3 days ago", age: 3 },
  { id: 6, company: "Figma", role: "Software Engineer, Editor", score: 85, salary: "$170k - $220k", date: "4 days ago", age: 4 },
  { id: 7, company: "Ramp", role: "Frontend Engineer", score: 89, salary: "$165k - $215k", date: "5 days ago", age: 5 },
  { id: 8, company: "Loom", role: "Senior Product Engineer", score: 78, salary: "$145k - $185k", date: "6 days ago", age: 6 },
  { id: 9, company: "Shopify", role: "Staff Frontend Developer", score: 83, salary: "$155k - $210k", date: "1 week ago", age: 7 },
  { id: 10, company: "Webflow", role: "UI Platform Engineer", score: 87, salary: "$150k - $205k", date: "1 week ago", age: 8 },
  { id: 11, company: "GitLab", role: "Senior UX Engineer", score: 76, salary: "$140k - $180k", date: "1 week ago", age: 9 },
  { id: 12, company: "Dropbox", role: "Frontend Systems Engineer", score: 81, salary: "$160k - $220k", date: "1 week ago", age: 10 },
  { id: 13, company: "Discord", role: "Senior UI Engineer", score: 90, salary: "$170k - $230k", date: "2 weeks ago", age: 11 },
  { id: 14, company: "Atlassian", role: "Product Frontend Engineer", score: 74, salary: "$135k - $175k", date: "2 weeks ago", age: 12 },
  { id: 15, company: "Canva", role: "Design Systems Engineer", score: 93, salary: "$150k - $205k", date: "2 weeks ago", age: 13 },
  { id: 16, company: "Airtable", role: "Frontend Engineer", score: 79, salary: "$145k - $195k", date: "2 weeks ago", age: 14 },
  { id: 17, company: "Asana", role: "Senior Product Engineer", score: 86, salary: "$155k - $210k", date: "3 weeks ago", age: 15 },
  { id: 18, company: "Twilio", role: "UI Infrastructure Engineer", score: 71, salary: "$135k - $180k", date: "3 weeks ago", age: 16 },
  { id: 19, company: "Palantir", role: "Frontend Software Engineer", score: 82, salary: "$175k - $235k", date: "3 weeks ago", age: 17 },
  { id: 20, company: "HubSpot", role: "Senior Web Engineer", score: 77, salary: "$140k - $185k", date: "3 weeks ago", age: 18 },
  { id: 21, company: "Brex", role: "Product UI Engineer", score: 92, salary: "$170k - $230k", date: "1 month ago", age: 19 },
  { id: 22, company: "Plaid", role: "Frontend Engineer", score: 84, salary: "$160k - $215k", date: "1 month ago", age: 20 },
  { id: 23, company: "Robinhood", role: "Senior UI Developer", score: 73, salary: "$150k - $205k", date: "1 month ago", age: 21 },
  { id: 24, company: "Cloudflare", role: "Design Systems Developer", score: 88, salary: "$160k - $215k", date: "1 month ago", age: 22 },
];

const iconPaths = {
  search: <><circle cx="11" cy="11" r="6" /><path d="m16 16 4 4" /></>,
  grid: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
  user: <><circle cx="12" cy="8" r="3" /><path d="M6.5 20a5.5 5.5 0 0 1 11 0" /></>,
  building: <><path d="M5 20V7l7-3 7 3v13" /><path d="M3 20h18M9 20v-4h6v4M9 9h.01M15 9h.01M9 12h.01M15 12h.01" /></>,
  spark: <><path d="m12 3-1.5 4.5L6 9l4.5 1.5L12 15l1.5-4.5L18 9l-4.5-1.5L12 3Z" /><path d="m19 15-.7 2.3L16 18l2.3.7L19 21l.7-2.3L22 18l-2.3-.7L19 15Z" /></>,
};

function Icon({ name, className = "size-5" }: { name: keyof typeof iconPaths; className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>{iconPaths[name]}</svg>;
}

function scoreColor(score: number): string {
  if (score >= 90) return "bg-success";
  if (score >= 80) return "bg-info-medium";
  return "bg-warning";
}

function readMatchFilter(value: string): MatchFilter {
  return value === "strong" || value === "other" ? value : "all";
}

function readSortOrder(value: string): SortOrder {
  return value === "newest" || value === "oldest" ? value : "score";
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

export function FindJobsPage() {
  const [jobTitle, setJobTitle] = useState("");
  const [location, setLocation] = useState("");
  const [filter, setFilter] = useState("");
  const [matchFilter, setMatchFilter] = useState<MatchFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("score");
  const [page, setPage] = useState(1);
  const [searchMessage, setSearchMessage] = useState("Found 8 jobs and saved 4 strong matches.");
  const pageSize = 6;

  const visibleJobs = useMemo(() => {
    const filtered = jobs.filter((job) => {
      const matchesText = `${job.company} ${job.role}`.toLowerCase().includes(filter.toLowerCase());
      const matchesScore = matchFilter === "all" || (matchFilter === "strong" ? job.score >= 80 : job.score < 80);
      return matchesText && matchesScore;
    });
    return [...filtered].sort((first, second) => sortOrder === "score" ? second.score - first.score : sortOrder === "newest" ? first.age - second.age : second.age - first.age);
  }, [filter, matchFilter, sortOrder]);

  const pageCount = Math.max(1, Math.ceil(visibleJobs.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageJobs = visibleJobs.slice((safePage - 1) * pageSize, safePage * pageSize);
  const resultStart = visibleJobs.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const resultEnd = Math.min(safePage * pageSize, visibleJobs.length);

  function submitSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setSearchMessage(`Found 8 jobs and saved 4 strong matches for ${jobTitle.trim() || "your search"}.`);
  }

  function updateFilter(value: string): void {
    setFilter(value);
    setPage(1);
  }

  function updateMatchFilter(value: MatchFilter): void {
    setMatchFilter(value);
    setPage(1);
  }

  function updateSortOrder(value: SortOrder): void {
    setSortOrder(value);
    setPage(1);
  }

  return <div className="min-h-screen bg-background">
    <AppHeader />
    <main id="main-content" className="mx-auto max-w-[1440px] px-4 py-10 sm:px-6 lg:px-8">
      <form onSubmit={submitSearch} className="rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
          <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-dark">Job title</span><span className="relative block"><Icon name="search" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-text-muted" /><input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="Frontend Engineer" className="min-h-14 w-full rounded-md border border-border bg-surface px-12 text-base text-text-primary shadow-sm outline-none placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20" /></span></label>
          <label className="block"><span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-dark">Location</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Remote, New York..." className="min-h-14 w-full rounded-md border border-border bg-surface px-4 text-base text-text-primary shadow-sm outline-none placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20" /></label>
          <button type="submit" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-md bg-accent px-7 text-base font-semibold text-accent-foreground shadow-sm transition-colors hover:bg-accent-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"><Icon name="search" />Find Jobs</button>
        </div>
        <div role="status" aria-live="polite" className="mt-5 flex items-center gap-3 rounded-md border border-success-light bg-success-lightest px-4 py-4 text-base font-medium text-success-darker"><Icon name="spark" className="size-5 shrink-0" />{searchMessage}</div>
      </form>

      <section aria-labelledby="results-heading" className="mt-6 rounded-xl border border-border bg-surface shadow-sm">
        <h2 id="results-heading" className="sr-only">Job search results</h2>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
          <label className="relative min-w-0 flex-1"><span className="sr-only">Filter by company or role</span><Icon name="search" className="pointer-events-none absolute left-1 top-1/2 size-5 -translate-y-1/2 text-text-muted" /><input value={filter} onChange={(event) => updateFilter(event.target.value)} placeholder="Filter by company or role..." className="min-h-11 w-full border-0 border-b border-border-light bg-transparent pl-8 text-base text-text-primary outline-none placeholder:text-text-muted focus:border-accent focus:ring-0" /></label>
          <div className="flex flex-col gap-3 sm:flex-row sm:border-l sm:border-border-light sm:pl-5"><label className="sr-only" htmlFor="match-filter">Match filter</label><select id="match-filter" value={matchFilter} onChange={(event) => updateMatchFilter(readMatchFilter(event.target.value))} className="min-h-11 rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-dark shadow-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"><option value="all">All Matches</option><option value="strong">Strong Matches</option><option value="other">Other Matches</option></select><label className="sr-only" htmlFor="sort-order">Sort results</label><select id="sort-order" value={sortOrder} onChange={(event) => updateSortOrder(readSortOrder(event.target.value))} className="min-h-11 rounded-md border border-border bg-surface px-4 text-sm font-medium text-text-dark shadow-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"><option value="score">Match Score</option><option value="newest">Newest</option><option value="oldest">Oldest</option></select></div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse text-left"><thead className="bg-surface-secondary"><tr className="border-y border-border"><th className="px-6 py-5 text-xs font-semibold uppercase tracking-wide text-text-secondary">Company</th><th className="px-6 py-5 text-xs font-semibold uppercase tracking-wide text-text-secondary">Role</th><th className="px-6 py-5 text-xs font-semibold uppercase tracking-wide text-text-secondary">Match score</th><th className="px-6 py-5 text-xs font-semibold uppercase tracking-wide text-text-secondary">Salary est.</th><th className="px-6 py-5 text-xs font-semibold uppercase tracking-wide text-text-secondary">Date found</th></tr></thead><tbody>{pageJobs.map((job) => <tr key={job.id} className="border-b border-border transition-colors hover:bg-surface-secondary"><td className="px-6 py-5"><div className="flex items-center gap-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-surface-tertiary text-text-secondary"><Icon name="building" className="size-5" /></span><span className="font-semibold text-text-darkest">{job.company}</span></div></td><td className="px-6 py-5 text-base font-medium text-text-dark">{job.role}</td><td className="px-6 py-5"><div className="flex items-center gap-3"><span className="h-2 w-28 rounded-full bg-border-muted"><span className={`block h-2 rounded-full ${scoreColor(job.score)}`} style={{ width: `${job.score}%` }} /></span><span className="font-semibold text-text-dark">{job.score}%</span></div></td><td className="px-6 py-5 text-base text-text-secondary">{job.salary}</td><td className="px-6 py-5 text-base text-text-secondary">{job.date}</td></tr>)}</tbody></table>
          {pageJobs.length === 0 ? <p className="px-6 py-12 text-center text-text-secondary">No jobs match your filters.</p> : null}
        </div>

        <div className="flex flex-col gap-4 px-6 py-5 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between"><p>Showing <span className="font-semibold text-text-dark">{resultStart}</span> to <span className="font-semibold text-text-dark">{resultEnd}</span> of <span className="font-semibold text-text-dark">{visibleJobs.length}</span> results</p><nav aria-label="Job results pages" className="flex items-center gap-2"><button type="button" disabled={safePage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="min-h-10 rounded-md border border-border px-4 font-medium text-text-secondary hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50">Previous</button>{Array.from({ length: pageCount }, (_, index) => index + 1).map((pageNumber) => <button type="button" key={pageNumber} aria-current={safePage === pageNumber ? "page" : undefined} onClick={() => setPage(pageNumber)} className={`min-h-10 min-w-10 rounded-md border px-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${safePage === pageNumber ? "border-accent-light bg-accent-muted text-accent" : "border-border text-text-dark hover:border-accent hover:text-accent"}`}>{pageNumber}</button>)}<button type="button" disabled={safePage === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))} className="min-h-10 rounded-md border border-border px-4 font-medium text-text-dark hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50">Next</button></nav></div>
      </section>
    </main>
  </div>;
}
