import Link from "next/link";

import { CompanyResearch } from "@/components/job-details/CompanyResearch";
import type { JobDetails } from "@/lib/job-details";

const iconPaths = {
  arrowLeft: <path d="m15 18-6-6 6-6" />,
  arrowUpRight: <><path d="M7 17 17 7" /><path d="M7 7h10v10" /></>,
  building: <><path d="M5 20V7l7-3 7 3v13" /><path d="M3 20h18M9 20v-4h6v4M9 9h.01M15 9h.01M9 12h.01M15 12h.01" /></>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></>,
  location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  money: <><path d="M12 2v20M17 5.5C16.2 4.5 14.7 4 13 4h-2a4 4 0 0 0 0 8h2a4 4 0 0 1 0 8h-2c-1.7 0-3.2-.5-4-1.5" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" /></>,
  spark: <><path d="m12 3-1.5 4.5L6 9l4.5 1.5L12 15l1.5-4.5L18 9l-4.5-1.5L12 3Z" /><path d="m19 15-.7 2.3L16 18l2.3.7L19 21l.7-2.3L16 18l2.3-.7" /></>,
  file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
};

function Icon({ name, className = "size-5" }: { name: keyof typeof iconPaths; className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>{iconPaths[name]}</svg>;
}

function formatDate(value: string): string {
  const time = Date.parse(value);
  if (Number.isNaN(time)) return "Date unavailable";
  const hours = Math.max(0, Math.floor((Date.now() - time) / 3600000));
  if (hours < 1) return "Just now";
  if (hours === 1) return "1 hour ago";
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
}

function jobType(value: string | null): string {
  if (!value) return "—";
  return value === "fulltime" ? "Full time" : value === "parttime" ? "Part time" : value[0].toUpperCase() + value.slice(1);
}

function MetaCard({ icon, value, label, tone = "accent" }: { icon: keyof typeof iconPaths; value: string; label: string; tone?: "accent" | "success" | "info" }) {
  const toneClasses = { accent: "bg-accent-muted text-accent", success: "bg-success-lightest text-success", info: "bg-info-lightest text-info-medium" };
  return <div className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm"><span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${toneClasses[tone]}`}><Icon name={icon} /></span><div className="min-w-0"><p className="truncate text-base font-semibold text-text-primary">{value}</p><p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p></div></div>;
}

type JobDetailsPageProps = { job: JobDetails };

export function JobDetailsPage({ job }: JobDetailsPageProps) {
  const score = job.match_score ?? 0;
  const applyUrl = job.external_apply_url ?? "#";
  const matchedSkills = job.matched_skills ?? [];
  const missingSkills = job.missing_skills ?? [];

  return <div className="min-h-screen bg-background"><header className="border-b border-border bg-surface"><div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6"><Link href="/dashboard" className="text-lg font-bold text-text-darkest">JobPilot</Link><nav aria-label="Primary" className="flex items-center gap-5 text-sm font-medium sm:gap-8"><Link href="/dashboard" className="text-text-dark hover:text-accent">Dashboard</Link><Link href="/find-jobs" className="text-accent">Find Jobs</Link><Link href="/profile" className="text-text-dark hover:text-accent">Profile</Link><span className="hidden text-text-secondary sm:inline">Sign out</span></nav></div></header><main id="main-content" className="mx-auto max-w-[920px] px-4 py-9 sm:px-6 lg:py-10"><Link href="/find-jobs" className="mb-8 inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"><Icon name="arrowLeft" className="size-4" />Back to Jobs</Link><section className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-7"><div className="flex min-w-0 items-center gap-5"><span className="flex size-16 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface-tertiary text-text-secondary"><Icon name="building" className="size-8" /></span><div className="min-w-0"><h1 className="text-2xl font-bold tracking-tight text-text-primary sm:text-[28px]">{job.title}</h1><p className="mt-1 text-base font-medium text-text-muted">{job.company}<span className="mx-2">•</span><span className="inline-flex rounded-full bg-success-lightest px-3 py-1 text-sm font-semibold text-success-foreground">{job.match_score === null ? "Not scored" : `${score}% Match Score`}</span></p></div></div><a href={applyUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold text-text-primary hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"><Icon name="arrowUpRight" className="size-4" />View Job Post</a></section><div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"><MetaCard icon="money" value={job.salary ?? "—"} label="Salary Est." tone="success" /><MetaCard icon="location" value={job.location ?? "—"} label="Location" tone="info" /><MetaCard icon="briefcase" value={jobType(job.job_type)} label="Job Type" /><MetaCard icon="calendar" value={formatDate(job.found_at)} label="Date Found" tone="info" /></div><section className="mt-6 rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-7"><div className="flex items-center gap-3"><span className="flex size-8 items-center justify-center rounded-full bg-success-lightest text-success"><Icon name="spark" className="size-4" /></span><h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">AI Match Reasoning</h2></div><p className="mt-5 text-base font-medium leading-7 text-text-primary">{job.match_reason ?? "No match reasoning is available for this job yet."}</p></section><section className="mt-5 rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-7"><h2 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Required Skills vs Your Profile</h2><div className="mt-5"><p className="text-sm font-medium text-text-muted">You have</p><div className="mt-2 flex flex-wrap gap-2">{matchedSkills.length ? matchedSkills.map((skill) => <span key={skill} className="rounded-full bg-success-lightest px-3 py-1.5 text-sm font-medium text-success-foreground">✓ {skill}</span>) : <span className="text-sm text-text-muted">No matched skills listed.</span>}</div><p className="mt-4 text-sm font-medium text-text-muted">Gap skills</p><div className="mt-2 flex flex-wrap gap-2">{missingSkills.length ? missingSkills.map((skill) => <span key={skill} className="rounded-full bg-accent-muted px-3 py-1.5 text-sm font-medium text-accent">↳ {skill}</span>) : <span className="text-sm text-text-muted">No gaps listed.</span>}</div></div></section><section className="mt-5 rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-7"><div className="flex items-center gap-3"><span className="flex size-8 items-center justify-center rounded-full bg-surface-secondary text-text-secondary"><Icon name="file" className="size-4" /></span><h2 className="text-lg font-semibold text-text-primary">Job Description</h2></div><p className="mt-6 whitespace-pre-line text-base font-medium leading-7 text-text-primary">{job.about_role ?? "No job description is available."}</p></section><CompanyResearch jobId={job.id} company={job.company} initialDossier={job.company_research} /><a href={applyUrl} target="_blank" rel="noreferrer" className="mt-7 flex min-h-12 items-center justify-center rounded-xl bg-accent px-6 text-base font-semibold text-accent-foreground shadow-sm hover:bg-accent-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">Apply Now at {job.company}</a></main></div>;
}
