import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

import type { ProfileData } from "@/lib/profile";

const adzunaJobSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.object({ display_name: z.string() }).passthrough(),
  location: z.object({ display_name: z.string() }).passthrough(),
  description: z.string(),
  redirect_url: z.string().url(),
  salary_min: z.number().optional(),
  salary_max: z.number().optional(),
  salary_is_predicted: z.enum(["0", "1"]).optional(),
  contract_type: z.string().optional(),
  created: z.string(),
  category: z.object({ tag: z.string(), label: z.string() }).passthrough(),
}).passthrough();

const adzunaResponseSchema = z.object({
  results: z.array(adzunaJobSchema).default([]),
}).passthrough();

const jobMatchSchema = z.object({
  matchScore: z.number().int().min(0).max(100),
  matchReason: z.string().trim().min(1),
  matchedSkills: z.array(z.string().trim().min(1)),
  missingSkills: z.array(z.string().trim().min(1)),
}).strict();

export type AdzunaJob = z.infer<typeof adzunaJobSchema>;
export type JobMatch = z.infer<typeof jobMatchSchema>;

export type MappedJob = {
  external_id: string;
  source_url: string;
  external_apply_url: string;
  title: string;
  company: string;
  location: string;
  salary: string | null;
  job_type: "fulltime" | "parttime" | "contract";
  about_role: string;
  found_at: string;
};

export function detectCountry(location: string): "au" | "gb" | "ca" {
  const value = location.toLowerCase();
  if (/\b(uk|united kingdom|england|scotland|wales|london|manchester)\b/.test(value)) return "gb";
  if (/\b(canada|ontario|toronto|vancouver|montreal|calgary)\b/.test(value)) return "ca";
  return "au";
}

function formatSalary(job: AdzunaJob): string | null {
  if (typeof job.salary_min !== "number") return null;
  const minimum = Math.round(job.salary_min / 1000);
  if (typeof job.salary_max !== "number") return `$${minimum}k+`;
  return `$${minimum}k - $${Math.round(job.salary_max / 1000)}k`;
}

function normalizeJobType(value: string | undefined): MappedJob["job_type"] {
  if (value === "parttime" || value === "contract") return value;
  return "fulltime";
}

export function mapAdzunaJob(job: AdzunaJob): MappedJob {
  return {
    external_id: job.id,
    source_url: job.redirect_url,
    external_apply_url: job.redirect_url,
    title: job.title,
    company: job.company.display_name,
    location: job.location.display_name,
    salary: formatSalary(job),
    job_type: normalizeJobType(job.contract_type),
    about_role: job.description,
    found_at: new Date().toISOString(),
  };
}

export async function searchAdzunaJobs(
  jobTitle: string,
  location: string,
  country: "au" | "gb" | "ca",
): Promise<AdzunaJob[]> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) throw new Error("Adzuna is not configured");

  const params = new URLSearchParams({
    app_id: appId,
    app_key: appKey,
    what: jobTitle,
    category: "it-jobs",
    results_per_page: "10",
    "content-type": "application/json",
  });
  if (location) params.set("where", location);

  const response = await fetch(
    `https://api.adzuna.com/v1/api/jobs/${country}/search/1?${params.toString()}`,
    { signal: AbortSignal.timeout(15000) },
  );
  if (!response.ok) throw new Error(`Adzuna returned ${response.status}`);

  const data: unknown = await response.json();
  return adzunaResponseSchema.parse(data).results;
}

function profilePrompt(profile: ProfileData): string {
  return JSON.stringify({
    currentTitle: profile.currentTitle,
    experienceLevel: profile.experienceLevel,
    yearsExperience: profile.yearsExperience,
    skills: profile.skills,
    industries: profile.industries,
    jobTitles: profile.jobTitles,
    remotePreference: profile.remotePreference,
    preferredLocations: profile.preferredLocations,
    workExperience: profile.workExperience,
    education: profile.education,
  });
}

export async function scoreJobAgainstProfile(
  job: MappedJob,
  profile: ProfileData,
): Promise<JobMatch> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI is not configured");

  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.parse({
    model: "gpt-4o",
    response_format: zodResponseFormat(jobMatchSchema, "job_match"),
    temperature: 0.3,
    max_tokens: 300,
    messages: [
      {
        role: "system",
        content: [
          "You score a job against a candidate profile.",
          "Use only the supplied profile and job snippet.",
          "Return a score from 0 to 100, a single paragraph reason, skills the candidate has that the job requires, and skills the job requires that the candidate lacks.",
          "Do not invent candidate experience, skills, qualifications, or job requirements.",
          "Return the supplied response schema exactly.",
        ].join(" "),
      },
      {
        role: "user",
        content: `CANDIDATE PROFILE:\n${profilePrompt(profile)}\n\nJOB:\n${JSON.stringify({
          title: job.title,
          company: job.company,
          location: job.location,
          description: job.about_role,
          jobType: job.job_type,
        })}`,
      },
    ],
  });
  const parsed = response.choices[0]?.message.parsed;
  if (!parsed) throw new Error("OpenAI returned no job match");
  return jobMatchSchema.parse(parsed);
}
