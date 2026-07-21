import Image from "next/image";
import Link from "next/link";

import { signOut } from "@/actions/auth";
import { SignOutButton } from "@/components/auth/SignOutButton";
import type { ActivityItem, ChartPoint, DashboardStat } from "@/lib/dashboard-placeholder";
import { companyResearchActivity, dashboardStats, jobsFoundOverTime, matchScoreDistribution, recentActivity } from "@/lib/dashboard-placeholder";

type DashboardPageProps = { displayName: string };

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-border bg-surface shadow-sm ${className}`}>{children}</section>;
}

function StatCard({ stat }: { stat: DashboardStat }) {
  return <Card className="p-5 sm:p-6"><p className="text-sm font-medium text-text-secondary">{stat.label}</p><p className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">{stat.value}</p><div className="mt-3 flex min-h-6 items-center gap-2 text-xs">{stat.trend ? <span className="rounded-sm bg-success-lightest px-2 py-1 font-medium text-success-darker">{stat.trend}</span> : null}<span className="text-text-muted">{stat.subtitle}</span></div></Card>;
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center"><p className="text-sm font-semibold text-text-primary">{title}</p><p className="mt-2 max-w-sm text-sm leading-6 text-text-muted">{message}</p></div>;
}

function ActivityList({ items }: { items: ActivityItem[] }) {
  if (!items.length) return <EmptyState title="No recent activity" message="Your job searches and company research will appear here." />;
  return <ul className="divide-y divide-border" aria-label="Recent activity items">{items.map((item) => <li key={item.id} className="flex items-start gap-4 px-5 py-4 sm:px-6"><span className={`mt-1.5 size-3 shrink-0 rounded-full ring-4 ${item.kind === "research" ? "bg-info ring-info-light" : item.kind === "match" ? "bg-success-alt ring-success-light" : "bg-accent ring-accent-light"}`} aria-hidden="true" /><div className="min-w-0"><p className="text-sm font-medium text-text-primary">{item.description}</p><time className="mt-1 block text-xs text-text-muted">{item.relativeTime}</time></div></li>)}</ul>;
}

function ChartCard({ title, children, summary }: { title: string; children: React.ReactNode; summary: string }) {
  return <Card className="overflow-hidden"><div className="border-b border-border px-5 py-4 sm:px-6"><h2 className="text-base font-semibold text-text-primary">{title}</h2></div><div className="px-4 pb-5 pt-4 sm:px-6"><p className="sr-only">{summary}</p>{children}</div></Card>;
}

function BarChart({ points, color = "text-info" }: { points: ChartPoint[]; color?: "text-info" | "text-success" }) {
  if (!points.length) return <EmptyState title="No chart data yet" message="This chart will appear when activity is recorded." />;
  const max = Math.max(...points.map((point) => point.value), 1);
  const chartHeight = 150;
  const chartWidth = 560;
  const step = chartWidth / points.length;
  return <div className="overflow-x-auto"><svg className={`h-56 min-w-[34rem] w-full ${color}`} viewBox={`0 0 ${chartWidth} 210`} role="img" aria-label={points.map((point) => `${point.label}: ${point.value}`).join(", ")}><title>{points.map((point) => `${point.label} ${point.value}`).join(", ")}</title>{[0, 0.33, 0.66, 1].map((fraction) => <line key={fraction} x1="0" x2={chartWidth} y1={20 + chartHeight * fraction} y2={20 + chartHeight * fraction} className="stroke-border" strokeDasharray="3 4" />)}{points.map((point, index) => { const barHeight = (point.value / max) * chartHeight; const x = index * step + step * 0.25; return <g key={point.label}><rect x={x} y={20 + chartHeight - barHeight} width={step * 0.5} height={barHeight} rx="5" className="fill-current" /><text x={x + step * 0.25} y="196" textAnchor="middle" className="fill-text-muted text-xs">{point.label}</text></g>; })}</svg></div>;
}

function LineChart({ points }: { points: ChartPoint[] }) {
  if (!points.length) return <EmptyState title="No chart data yet" message="This chart will appear when jobs are found." />;
  const max = Math.max(...points.map((point) => point.value), 1);
  const chartWidth = 560;
  const chartHeight = 150;
  const step = chartWidth / (points.length - 1 || 1);
  const coordinates = points.map((point, index) => `${index * step},${20 + chartHeight - (point.value / max) * chartHeight}`);
  return <div className="overflow-x-auto"><svg className="h-56 min-w-[34rem] w-full text-accent" viewBox={`0 0 ${chartWidth} 210`} role="img" aria-label={points.map((point) => `${point.label}: ${point.value}`).join(", ")}><title>{points.map((point) => `${point.label} ${point.value}`).join(", ")}</title>{[0, 0.33, 0.66, 1].map((fraction) => <line key={fraction} x1="0" x2={chartWidth} y1={20 + chartHeight * fraction} y2={20 + chartHeight * fraction} className="stroke-border" strokeDasharray="3 4" />)}<polyline points={coordinates.join(" ")} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />{points.map((point, index) => <text key={point.label} x={index * step} y="196" textAnchor="middle" className="fill-text-muted text-xs">{point.label}</text>)}</svg></div>;
}

function DashboardHeader() {
  return <header className="border-b border-border bg-surface"><div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:gap-4 sm:px-8"><Link href="/dashboard" aria-label="JobPilot dashboard" className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"><Image src="/logo.png" alt="JobPilot" width={118} height={40} className="h-7 w-auto sm:h-8" priority /></Link><nav aria-label="Primary"><ul className="flex items-center gap-2 text-xs font-medium sm:gap-8 sm:text-sm"><li><Link href="/dashboard" aria-current="page" className="rounded-md px-1 py-3 text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Dashboard</Link></li><li><Link href="/find-jobs" className="rounded-md px-1 py-3 text-text-dark hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Find Jobs</Link></li><li><Link href="/profile" className="rounded-md px-1 py-3 text-text-dark hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">Profile</Link></li></ul></nav><form action={signOut} className="hidden sm:block"><SignOutButton /></form></div></header>;
}

export function DashboardPage({ displayName }: DashboardPageProps) {
  return <div className="min-h-screen bg-background"><DashboardHeader /><main id="main-content" className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-8 lg:py-10"><div><p className="text-sm font-semibold text-accent">Your job search at a glance</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">Welcome back, {displayName}</h1><p className="mt-2 max-w-2xl text-base leading-7 text-text-secondary">Keep your search moving with a clear view of the opportunities and companies that matter most.</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{dashboardStats.map((stat) => <StatCard key={stat.label} stat={stat} />)}</div><div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]"><Card><div className="border-b border-border px-5 py-4 sm:px-6"><h2 className="text-base font-semibold text-text-primary">Recent Activity</h2></div><ActivityList items={recentActivity} /></Card><ChartCard title="Company Research Activity" summary="Company research activity across the week."><BarChart points={companyResearchActivity} /></ChartCard></div><div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]"><ChartCard title="Jobs Found Over Time" summary="Jobs found across the current week."><LineChart points={jobsFoundOverTime} /></ChartCard><ChartCard title="Match Score Distribution" summary="Distribution of saved jobs by match score."><BarChart points={matchScoreDistribution} color="text-success" /></ChartCard></div></main></div>;
}
