"use client";

import { useState } from "react";

import type { CompanyResearchDossier } from "@/types/company-research";

type CompanyResearchProps = {
  jobId: string;
  company: string;
  initialDossier: CompanyResearchDossier | null;
};

type ResearchResponse = {
  success: boolean;
  data?: { dossier: CompanyResearchDossier };
  error?: string;
};

const sections: Array<{ key: keyof CompanyResearchDossier; title: string; list: boolean }> = [
  { key: "companyOverview", title: "Company overview", list: false },
  { key: "techStack", title: "Technology", list: true },
  { key: "culture", title: "Culture and working style", list: true },
  { key: "whyThisRole", title: "Why this role", list: false },
  { key: "yourEdge", title: "Your edge", list: true },
  { key: "gapsToAddress", title: "Gaps to address", list: true },
  { key: "smartQuestions", title: "Smart questions", list: true },
  { key: "interviewPrep", title: "Interview preparation", list: true },
];

export function CompanyResearch({ jobId, company, initialDossier }: CompanyResearchProps) {
  const [dossier, setDossier] = useState<CompanyResearchDossier | null>(initialDossier);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleResearch(force: boolean): Promise<void> {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/agent/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, force }),
      });
      const result: ResearchResponse = await response.json();
      if (!response.ok || !result.success || !result.data) {
        setError(result.error ?? "We could not complete company research. Please retry.");
        return;
      }
      setDossier(result.data.dossier);
      setNotice(force ? "Company research refreshed." : "Company research is ready.");
    } catch {
      setError("We could not reach company research. Please retry.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm" aria-labelledby="company-research-heading">
      <div className="flex flex-col gap-4 border-b border-border p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-full bg-accent-muted text-accent" aria-hidden="true">✦</span>
          <h2 id="company-research-heading" className="text-lg font-semibold text-text-primary">Company Research</h2>
        </div>
        <button type="button" disabled={loading} onClick={() => void handleResearch(Boolean(dossier))} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
          {loading ? "Researching company…" : dossier ? "Research again" : "Research Company"}
        </button>
      </div>
      <div aria-live="polite" className="sr-only">{loading ? `Researching ${company}.` : notice || error}</div>
      {error ? <div role="alert" className="border-b border-error bg-error/10 px-6 py-4 text-sm font-medium text-error sm:px-7">{error}</div> : null}
      {loading ? (
        <div role="status" className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
          <span className="size-8 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-hidden="true" />
          <p className="mt-5 text-base font-semibold text-text-primary">Researching {company}</p>
          <p className="mt-2 max-w-sm text-base leading-6 text-text-muted">The agent is reviewing public company pages and preparing your briefing.</p>
        </div>
      ) : dossier ? (
        <div className="space-y-6 p-6 sm:p-7">
          {sections.map((section) => {
            const value = dossier[section.key];
            return <section key={section.key}><h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">{section.title}</h3>{section.list && Array.isArray(value) ? <ul className="mt-3 space-y-2">{value.map((item) => <li key={item} className="flex gap-3 text-base leading-7 text-text-primary"><span className="mt-3 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />{item}</li>)}</ul> : <p className="mt-3 max-w-prose text-base leading-7 text-text-primary">{value}</p>}</section>;
          })}
          <section><h3 className="text-sm font-semibold uppercase tracking-wide text-text-secondary">Sources</h3><ul className="mt-3 space-y-2">{dossier.sources.map((source) => <li key={source} className="break-words text-sm leading-6 text-text-secondary">{source}</li>)}</ul></section>
          {notice ? <p className="text-sm font-medium text-success" role="status">{notice}</p> : null}
        </div>
      ) : (
        <div className="flex min-h-64 flex-col items-center justify-center px-6 py-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-surface-secondary text-text-muted" aria-hidden="true">⌕</span>
          <h3 className="mt-5 text-base font-semibold text-text-primary">No research yet</h3>
          <p className="mt-2 max-w-sm text-base leading-6 text-text-muted">Research {company}&apos;s public pages to build a focused company and interview briefing.</p>
        </div>
      )}
    </section>
  );
}
