"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";

import {
  manageResume,
  saveProfile,
  type ResumeActionState,
} from "@/actions/profile";
import {
  initialProfileActionState,
  type ExtractedProfile,
  type ProfileCompletion,
  type ProfileData,
  type WorkExperience,
} from "@/lib/profile";
import { extractedProfileResponseSchema } from "@/lib/profile-extraction";

interface ProfilePageProps {
  profile: ProfileData;
  completion: ProfileCompletion;
  loadError?: string;
}

interface FieldProps {
  label: string;
  id: string;
  children: ReactNode;
  className?: string;
  error?: string;
}

interface TextInputProps {
  id: string;
  value?: string | number;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  error?: string;
}

const inputClass = "min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-text-primary shadow-sm outline-none placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:bg-surface-secondary disabled:text-text-secondary";
const labelClass = "mb-2 block text-xs font-semibold uppercase tracking-wide text-text-dark";
const initialResumeActionState: ResumeActionState = {
  status: "idle",
  message: "",
  resumeKey: null,
  updatedAt: 0,
};

function Icon({ children, className = "size-4" }: { children: ReactNode; className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>{children}</svg>;
}

function Field({ label, id, children, className = "", error }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>{label}</label>
      {children}
      {error ? <p id={`${id}-error`} className="mt-2 text-sm text-error">{error}</p> : null}
    </div>
  );
}

function TextInput({ id, value, onChange, placeholder, type = "text", disabled = false, error }: TextInputProps) {
  return (
    <input
      id={id}
      name={id}
      type={type}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${id}-error` : undefined}
      className={`${inputClass} ${error ? "border-error" : ""}`}
    />
  );
}

function SelectField({ id, value, onChange, children }: { id: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return <select id={id} name={id} value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>{children}</select>;
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="border-t border-border pt-10 first:border-0 first:pt-0">
      <div className="mb-7 flex items-center justify-between gap-4">
        <legend className="text-base font-semibold text-text-primary">{title}</legend>
        {action}
      </div>
      {children}
    </fieldset>
  );
}

function TagEditor({ id, label, values, onChange, placeholder }: { id: string; label: string; values: string[]; onChange: (values: string[]) => void; placeholder: string }) {
  const [draft, setDraft] = useState("");

  function addValue() {
    const value = draft.trim();
    if (!value || values.some((item) => item.toLowerCase() === value.toLowerCase())) return;
    onChange([...values, value]);
    setDraft("");
  }

  return (
    <Field label={label} id={id} className="sm:col-span-2">
      <div className="flex gap-2">
        <input
          id={id}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addValue();
            }
          }}
          placeholder={placeholder}
          className={inputClass}
        />
        <button type="button" onClick={addValue} className="min-h-11 rounded-md bg-surface-tertiary px-4 text-sm font-semibold text-text-dark hover:bg-border focus-visible:ring-2 focus-visible:ring-accent">Add</button>
      </div>
      {values.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {values.map((value) => (
            <li key={value} className="inline-flex items-center gap-2 rounded-md bg-surface-tertiary px-3 py-1.5 text-xs font-semibold text-text-dark">
              {value}
              <button type="button" onClick={() => onChange(values.filter((item) => item !== value))} aria-label={`Remove ${value}`} className="rounded-sm text-text-muted hover:text-error focus-visible:ring-2 focus-visible:ring-accent">×</button>
            </li>
          ))}
        </ul>
      ) : null}
    </Field>
  );
}

function AppHeader() {
  const nav = [
    { href: "/dashboard", label: "Dashboard", icon: <><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></> },
    { href: "/find-jobs", label: "Find Jobs", icon: <><circle cx="11" cy="11" r="6"/><path d="m16 16 4 4"/></> },
    { href: "/profile", label: "Profile", icon: <><circle cx="12" cy="8" r="3"/><path d="M6.5 20a5.5 5.5 0 0 1 11 0"/></> },
  ];
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 sm:px-6">
        <Link href="/dashboard" aria-label="JobPilot dashboard" className="rounded-md focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">
          <Image src="/logo.png" alt="JobPilot" width={118} height={40} className="h-9 w-auto" priority />
        </Link>
        <nav aria-label="Primary">
          <ul className="flex h-16 items-stretch gap-2 sm:gap-7">
            {nav.map((item) => <li key={item.href}><Link href={item.href} aria-current={item.href === "/profile" ? "page" : undefined} className={`flex h-full min-w-11 items-center gap-2 border-b-2 px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent ${item.href === "/profile" ? "border-accent text-accent" : "border-transparent text-text-dark hover:text-accent"}`}><Icon>{item.icon}</Icon><span className="hidden sm:!inline">{item.label}</span></Link></li>)}
          </ul>
        </nav>
      </div>
    </header>
  );
}

function emptyRole(): WorkExperience {
  return { company: "", title: "", startDate: "", endDate: "", currentRole: false, responsibilities: "" };
}

export function ProfilePage({ profile, completion, loadError }: ProfilePageProps) {
  const [draft, setDraft] = useState({
    ...profile,
    workExperience: profile.workExperience.length > 0 ? profile.workExperience : [emptyRole()],
  });
  const [jobTitles, setJobTitles] = useState(profile.jobTitles);
  const [preferredLocations, setPreferredLocations] = useState(profile.preferredLocations);
  const [extractionState, setExtractionState] = useState<{ status: "idle" | "loading" | "success" | "error"; message: string }>({ status: "idle", message: "" });
  const [generationState, setGenerationState] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message: string;
    resumeKey: string | null;
    updatedAt: number;
  }>({ status: "idle", message: "", resumeKey: profile.resumeKey, updatedAt: 0 });
  const [profileState, profileAction, profilePending] = useActionState(saveProfile, initialProfileActionState);
  const [resumeState, resumeAction, resumePending] = useActionState(manageResume, { ...initialResumeActionState, resumeKey: profile.resumeKey });
  const activeResumeKey = generationState.status === "success" && generationState.updatedAt > resumeState.updatedAt
    ? generationState.resumeKey
    : resumeState.status !== "idle"
    ? resumeState.resumeKey
    : profile.resumeKey;
  const activeCompletion = profileState.completion ?? completion;

  function updateRole(index: number, field: keyof WorkExperience, value: string | boolean) {
    setDraft((current) => ({
      ...current,
      workExperience: current.workExperience.map((role, roleIndex) => roleIndex === index ? { ...role, [field]: value } : role),
    }));
  }

  function updateDraft(field: keyof ProfileData, value: string | string[]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function applyExtraction(extracted: ExtractedProfile) {
    setDraft((current) => ({
      ...current,
      ...(extracted.fullName === undefined ? {} : { fullName: extracted.fullName }),
      ...(extracted.phone === undefined ? {} : { phone: extracted.phone }),
      ...(extracted.location === undefined ? {} : { location: extracted.location }),
      ...(extracted.linkedIn === undefined ? {} : { linkedIn: extracted.linkedIn }),
      ...(extracted.portfolio === undefined ? {} : { portfolio: extracted.portfolio }),
      ...(extracted.currentTitle === undefined ? {} : { currentTitle: extracted.currentTitle }),
      ...(extracted.experienceLevel === undefined ? {} : { experienceLevel: extracted.experienceLevel }),
      ...(extracted.yearsExperience === undefined ? {} : { yearsExperience: extracted.yearsExperience }),
      ...(extracted.skills === undefined ? {} : { skills: extracted.skills }),
      ...(extracted.industries === undefined ? {} : { industries: extracted.industries }),
      ...(extracted.workExperience === undefined ? {} : {
        workExperience: extracted.workExperience.map((role) => ({ ...emptyRole(), ...role })),
      }),
      ...(extracted.education === undefined ? {} : {
        education: { ...current.education, ...extracted.education },
      }),
    }));
  }

  async function extractResume() {
    const confirmed = window.confirm("Extracted resume details will overwrite all supported profile fields that contain resume data. Email, work authorization, and Job Preferences will not change. Continue?");
    if (!confirmed) return;

    setExtractionState({ status: "loading", message: "Extracting profile details from your resume…" });
    try {
      const response = await fetch("/api/resume/extract", { method: "POST" });
      const result: unknown = await response.json();
      if (typeof result !== "object" || result === null || !("success" in result)) throw new Error("Invalid response");
      if (result.success !== true || !("data" in result)) {
        const message = "error" in result && typeof result.error === "string"
          ? result.error
          : "We could not extract your profile. Please retry.";
        setExtractionState({ status: "error", message });
        return;
      }
      const parsed = extractedProfileResponseSchema.safeParse(result.data);
      if (!parsed.success) throw new Error("Invalid extraction response");
      applyExtraction(parsed.data);
      setExtractionState({ status: "success", message: "Profile details extracted. Review the form, then save your profile." });
    } catch (error) {
      console.error("[profile:extract-resume]", error);
      setExtractionState({ status: "error", message: "We could not extract your profile. Please retry." });
    }
  }

  async function generateResume() {
    if (!activeCompletion.isComplete) {
      setGenerationState((current) => ({
        ...current,
        status: "error",
        message: "Complete and save your profile before generating a resume.",
        updatedAt: Date.now(),
      }));
      return;
    }
    if (activeResumeKey) {
      const confirmed = window.confirm("Your generated resume will replace your current resume. Continue?");
      if (!confirmed) return;
    }

    setGenerationState((current) => ({ ...current, status: "loading", message: "Generating your resume…", updatedAt: Date.now() }));
    try {
      const response = await fetch("/api/resume/generate", { method: "POST" });
      const result: unknown = await response.json();
      if (typeof result !== "object" || result === null || !("success" in result)) throw new Error("Invalid response");
      if (result.success !== true || !("data" in result) || typeof result.data !== "object" || result.data === null || !("resumeKey" in result.data) || typeof result.data.resumeKey !== "string") {
        const message = "error" in result && typeof result.error === "string"
          ? result.error
          : "We could not generate your resume. Please retry.";
        setGenerationState((current) => ({ ...current, status: "error", message, updatedAt: Date.now() }));
        return;
      }
      setGenerationState({
        status: "success",
        message: "Resume generated securely. You can view or extract it now.",
        resumeKey: result.data.resumeKey,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error("[profile:generate-resume]", error);
      setGenerationState((current) => ({
        ...current,
        status: "error",
        message: "We could not generate your resume. Please retry.",
        updatedAt: Date.now(),
      }));
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <a href="#main-content" className="sr-only focus:not-sr-only">Skip to profile</a>
      <AppHeader />
      <main id="main-content" className="mx-auto w-full !max-w-5xl space-y-6 px-4 py-8 sm:!px-6 sm:!py-10">
        {loadError ? <div role="alert" className="rounded-xl border border-error/20 bg-surface p-5 text-sm text-error shadow-sm">{loadError}</div> : null}

        <section aria-labelledby="attention-heading" className={`flex flex-col gap-6 rounded-xl border bg-surface p-6 shadow-sm sm:!flex-row sm:!items-center sm:!justify-between sm:!px-9 sm:!py-8 ${activeCompletion.isComplete ? "border-success/20" : "border-error/20"}`}>
          <div>
            <h1 id="attention-heading" className="flex items-center gap-2 text-lg font-semibold text-text-primary">
              <Icon className={`size-5 ${activeCompletion.isComplete ? "text-success" : "text-error"}`}><circle cx="12" cy="12" r="9"/><path d="M12 8v5m0 3h.01"/></Icon>
              {activeCompletion.isComplete ? "Profile complete" : "Profile needs attention"}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-text-dark">{activeCompletion.isComplete ? "Your profile is ready for tailored job matches." : "Complete the missing fields to improve your matches and generated resumes."}</p>
            {!activeCompletion.isComplete ? <ul aria-label="Missing fields" className="mt-4 flex flex-wrap gap-2">{activeCompletion.missingFields.map((item) => <li key={item} className="rounded-sm bg-error/10 px-2 py-1 text-xs font-semibold uppercase text-error">{item}</li>)}</ul> : null}
          </div>
          <div aria-label={`Profile ${activeCompletion.percentage} percent complete`} role="img" className="grid size-28 shrink-0 place-items-center rounded-full bg-surface-tertiary p-3">
            <div className="grid size-full place-items-center rounded-full border-8 border-accent bg-surface text-3xl font-semibold text-text-primary">{activeCompletion.percentage}%</div>
          </div>
        </section>

        <section aria-labelledby="resume-heading" className="rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-9">
          <h2 id="resume-heading" className="text-lg font-semibold text-text-primary">Resume</h2>
          <p className="mt-1 text-sm text-text-secondary">Upload one private PDF, then extract profile details for review.</p>
          <form action={resumeAction} className="mt-7 flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-border-muted bg-surface-secondary p-6 text-center">
            <div className="grid size-14 place-items-center rounded-full border border-border bg-surface text-accent shadow-sm"><Icon className="size-7"><path d="M12 16V8m-3 3 3-3 3 3"/><path d="M20 16.5a4.5 4.5 0 0 0-3.8-4.45A6 6 0 0 0 4 13a3.5 3.5 0 0 0 1 6.85"/></Icon></div>
            <p className="mt-4 text-base font-semibold text-text-primary">{activeResumeKey ? "Replace your current resume" : "Select a resume to upload"}</p>
            <p className="mt-1 text-sm text-text-secondary">PDF only. Maximum file size 10 MiB.</p>
            <label htmlFor="resume" className="mt-5 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-border bg-surface px-5 text-sm font-semibold text-text-primary shadow-sm hover:bg-surface-secondary focus-within:ring-2 focus-within:ring-accent">
              <span>{resumePending ? "Working…" : "Select Resume"}</span>
              <input id="resume" name="resume" type="file" accept="application/pdf" disabled={resumePending} onChange={(event) => event.currentTarget.form?.requestSubmit()} className="sr-only" />
            </label>
            {activeResumeKey ? <div className="mt-4 flex flex-wrap justify-center gap-3"><a href="/api/resume" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-md px-4 text-sm font-semibold text-accent hover:text-accent-dark focus-visible:ring-2 focus-visible:ring-accent">View current PDF</a><button type="submit" name="deleteResume" value="true" disabled={resumePending} className="min-h-11 rounded-md px-4 text-sm font-semibold text-error hover:bg-error/10 focus-visible:ring-2 focus-visible:ring-error">{resumePending ? "Working…" : "Remove resume"}</button></div> : null}
            {resumeState.status !== "idle" ? <p role={resumeState.status === "error" ? "alert" : "status"} className={`mt-4 text-sm ${resumeState.status === "error" ? "text-error" : "text-success-dark"}`}>{resumeState.message}</p> : null}
          </form>
          {activeResumeKey ? <div className="mt-6 flex flex-col items-start justify-between gap-4 border-t border-border pt-5 sm:!flex-row sm:!items-center"><div><p className="text-sm font-semibold text-text-primary">Fill your profile from this resume</p><p className="mt-1 text-sm text-text-secondary">You will review every extracted value before saving.</p></div><button type="button" onClick={extractResume} disabled={extractionState.status === "loading" || resumePending} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-accent-foreground hover:bg-accent-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"><Icon><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1"/><circle cx="12" cy="12" r="3"/></Icon>{extractionState.status === "loading" ? "Extracting…" : "Extract from Resume"}</button></div> : null}
          <div aria-live="polite" aria-atomic="true">{extractionState.status !== "idle" ? <p role={extractionState.status === "error" ? "alert" : "status"} className={`mt-4 text-sm ${extractionState.status === "error" ? "text-error" : "text-success-dark"}`}>{extractionState.message}</p> : null}</div>
          <div className="mt-6 flex flex-col items-start justify-between gap-4 border-t border-border pt-5 sm:!flex-row sm:!items-center">
            <div><p className="text-sm font-semibold text-text-primary">Generate from your saved profile</p><p className="mt-1 text-sm text-text-secondary">Complete and save the profile first. Generation uses saved values, not unsaved edits.</p></div>
            <button type="button" onClick={generateResume} disabled={!activeCompletion.isComplete || generationState.status === "loading" || resumePending} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-5 text-sm font-semibold text-accent-foreground hover:bg-accent-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-surface-tertiary disabled:text-text-muted"><Icon><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8m-8 4h8"/></Icon>{generationState.status === "loading" ? "Generating…" : "Generate Resume"}</button>
          </div>
          <div aria-live="polite" aria-atomic="true">{generationState.status !== "idle" ? <p role={generationState.status === "error" ? "alert" : "status"} className={`mt-4 text-sm ${generationState.status === "error" ? "text-error" : "text-success-dark"}`}>{generationState.message}</p> : null}</div>
        </section>

        <section aria-labelledby="profile-heading" className="rounded-xl border border-border bg-surface p-6 shadow-sm sm:p-9">
          <div className="border-b border-border pb-5"><h2 id="profile-heading" className="text-xl font-semibold text-text-primary">Profile Information</h2><p className="mt-1 text-sm text-text-secondary">This context is used to accurately represent you in agent interactions.</p></div>
          <form action={profileAction} className="mt-9 space-y-10">
            <input type="hidden" name="skillsJson" value={JSON.stringify(draft.skills)} />
            <input type="hidden" name="industriesJson" value={JSON.stringify(draft.industries)} />
            <input type="hidden" name="workExperienceJson" value={JSON.stringify(draft.workExperience)} />
            <input type="hidden" name="jobTitlesJson" value={JSON.stringify(jobTitles)} />
            <input type="hidden" name="preferredLocationsJson" value={JSON.stringify(preferredLocations)} />

            <Section title="Personal Info"><div className="grid gap-5 sm:!grid-cols-2">
              <Field label="Full Name" id="fullName"><TextInput id="fullName" value={draft.fullName} onChange={(value) => updateDraft("fullName", value)}/></Field><Field label="Email" id="email"><TextInput id="email" type="email" value={draft.email} disabled/></Field>
              <Field label="Phone Number" id="phone"><TextInput id="phone" type="tel" value={draft.phone} onChange={(value) => updateDraft("phone", value)} placeholder="+1 (555) 000-0000"/></Field><Field label="Location" id="location"><TextInput id="location" value={draft.location} onChange={(value) => updateDraft("location", value)} placeholder="City, Country"/></Field>
              <Field label="LinkedIn URL" id="linkedIn" error={profileState.fieldErrors.linkedIn}><TextInput id="linkedIn" type="url" value={draft.linkedIn} onChange={(value) => updateDraft("linkedIn", value)} error={profileState.fieldErrors.linkedIn}/></Field><Field label="Portfolio / GitHub" id="portfolio" error={profileState.fieldErrors.portfolio}><TextInput id="portfolio" type="url" value={draft.portfolio} onChange={(value) => updateDraft("portfolio", value)} error={profileState.fieldErrors.portfolio}/></Field>
              <Field label="Work Authorization" id="authorization"><SelectField id="authorization" value={draft.authorization} onChange={(value) => updateDraft("authorization", value)}><option value="">Select status</option><option value="citizen">Citizen</option><option value="permanent_resident">Permanent resident</option><option value="visa_required">Visa required</option></SelectField></Field>
            </div></Section>

            <Section title="Professional Info"><div className="grid gap-5 sm:!grid-cols-2">
              <Field label="Current/Recent Job Title" id="currentTitle" className="sm:col-span-2"><TextInput id="currentTitle" value={draft.currentTitle} onChange={(value) => updateDraft("currentTitle", value)}/></Field>
              <Field label="Experience Level" id="experienceLevel"><SelectField id="experienceLevel" value={draft.experienceLevel} onChange={(value) => updateDraft("experienceLevel", value)}><option value="">Select level</option><option value="junior">Junior</option><option value="mid">Mid</option><option value="senior">Senior</option><option value="lead">Lead</option></SelectField></Field><Field label="Years of Experience" id="yearsExperience" error={profileState.fieldErrors.yearsExperience}><TextInput id="yearsExperience" type="number" value={draft.yearsExperience} onChange={(value) => updateDraft("yearsExperience", value)} error={profileState.fieldErrors.yearsExperience}/></Field>
              <TagEditor id="skills" label="Skills" values={draft.skills} onChange={(values) => updateDraft("skills", values)} placeholder="Add a skill" />
              <TagEditor id="industries" label="Industries Worked In (Optional)" values={draft.industries} onChange={(values) => updateDraft("industries", values)} placeholder="E.g. FinTech, Healthcare" />
            </div></Section>

            <Section title="Work Experience" action={<button type="button" disabled={draft.workExperience.length >= 3} onClick={() => setDraft((current) => ({ ...current, workExperience: [...current.workExperience, emptyRole()] }))} className="min-h-11 px-2 text-sm font-semibold text-accent hover:text-accent-dark focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:text-text-muted">+ Add role</button>}>
              <div className="space-y-5">{draft.workExperience.map((role, index) => <div key={index} className="rounded-xl border border-border bg-surface-secondary p-5"><div className="mb-4 flex items-center justify-between"><h3 className="text-sm font-semibold text-text-primary">Role {index + 1}</h3>{draft.workExperience.length > 1 ? <button type="button" onClick={() => setDraft((current) => ({ ...current, workExperience: current.workExperience.filter((_, roleIndex) => roleIndex !== index) }))} className="min-h-11 px-2 text-sm font-semibold text-error focus-visible:ring-2 focus-visible:ring-error">Remove</button> : null}</div><div className="grid gap-5 sm:!grid-cols-2">
                <Field label="Company Name" id={`company-${index}`}><input id={`company-${index}`} value={role.company} onChange={(event) => updateRole(index, "company", event.target.value)} className={inputClass}/></Field><Field label="Job Title" id={`jobTitle-${index}`}><input id={`jobTitle-${index}`} value={role.title} onChange={(event) => updateRole(index, "title", event.target.value)} className={inputClass}/></Field>
                <Field label="Start Date" id={`startDate-${index}`}><input id={`startDate-${index}`} type="text" inputMode="numeric" placeholder="YYYY-MM" pattern="[0-9]{4}-(0[1-9]|1[0-2])" value={role.startDate} onChange={(event) => updateRole(index, "startDate", event.target.value)} className={inputClass}/></Field><Field label="End Date" id={`endDate-${index}`}><div className="mb-2 flex justify-end gap-2 text-xs text-text-dark"><input id={`currentRole-${index}`} type="checkbox" checked={role.currentRole} onChange={(event) => updateRole(index, "currentRole", event.target.checked)} className="accent-accent"/><label htmlFor={`currentRole-${index}`}>Currently working here</label></div><input id={`endDate-${index}`} type="text" inputMode="numeric" placeholder="YYYY-MM" pattern="[0-9]{4}-(0[1-9]|1[0-2])" value={role.endDate} disabled={role.currentRole} onChange={(event) => updateRole(index, "endDate", event.target.value)} className={inputClass}/></Field>
                <Field label="Key Responsibilities" id={`responsibilities-${index}`} className="sm:col-span-2"><textarea id={`responsibilities-${index}`} value={role.responsibilities} onChange={(event) => updateRole(index, "responsibilities", event.target.value)} rows={4} className={`${inputClass} py-3`}/></Field>
              </div></div>)}</div>
            </Section>

            <Section title="Education"><div className="grid gap-5 sm:!grid-cols-2">
              <Field label="Highest Degree" id="degree"><SelectField id="degree" value={draft.education.degree} onChange={(value) => setDraft((current) => ({ ...current, education: { ...current.education, degree: value } }))}><option value="">Select degree</option><option>High School</option><option>Bachelor&apos;s</option><option>Master&apos;s</option><option>Doctorate</option></SelectField></Field><Field label="Field of Study" id="fieldOfStudy"><TextInput id="fieldOfStudy" value={draft.education.fieldOfStudy} onChange={(value) => setDraft((current) => ({ ...current, education: { ...current.education, fieldOfStudy: value } }))}/></Field>
              <Field label="Institution Name" id="institution"><TextInput id="institution" value={draft.education.institution} onChange={(value) => setDraft((current) => ({ ...current, education: { ...current.education, institution: value } }))} placeholder="E.g. State University"/></Field><Field label="Graduation Year" id="graduationYear"><TextInput id="graduationYear" value={draft.education.graduationYear} onChange={(value) => setDraft((current) => ({ ...current, education: { ...current.education, graduationYear: value } }))} placeholder="YYYY"/></Field>
            </div></Section>

            <Section title="Job Preferences"><div className="grid gap-5 sm:!grid-cols-2">
              <TagEditor id="jobTitles" label="Job Titles Seeking" values={jobTitles} onChange={setJobTitles} placeholder="E.g. Frontend Engineer" />
              <Field label="Remote Preference" id="remotePreference"><SelectField id="remotePreference" value={draft.remotePreference} onChange={(value) => updateDraft("remotePreference", value)}><option value="">Select preference</option><option value="any">Any</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">Onsite</option></SelectField></Field><Field label="Salary Expectation (Optional)" id="salary"><TextInput id="salary" value={draft.salary} onChange={(value) => updateDraft("salary", value)} placeholder="E.g. $120k+"/></Field>
              <TagEditor id="preferredLocations" label="Preferred Locations (Optional)" values={preferredLocations} onChange={setPreferredLocations} placeholder="E.g. New York, London" />
              <Field label="Cover Letter Tone (Optional)" id="coverLetterTone"><SelectField id="coverLetterTone" value={draft.coverLetterTone} onChange={(value) => updateDraft("coverLetterTone", value)}><option value="">No preference</option><option value="formal">Formal</option><option value="casual">Casual</option><option value="enthusiastic">Enthusiastic</option></SelectField></Field>
            </div></Section>
            <div className="border-t border-border pt-8">
              {profileState.status !== "idle" ? <p role={profileState.status === "error" ? "alert" : "status"} className={`mb-4 text-sm ${profileState.status === "error" ? "text-error" : "text-success-dark"}`}>{profileState.message}</p> : null}
              <button type="submit" disabled={profilePending} className="min-h-12 w-full rounded-md bg-accent px-6 text-sm font-semibold text-accent-foreground hover:bg-accent-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">{profilePending ? "Saving profile…" : "Save Profile"}</button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
