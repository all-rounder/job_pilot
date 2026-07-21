import type { CompanyResearchDossier } from "@/types/company-research";

export type JobDetails = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  salary: string | null;
  job_type: string | null;
  external_apply_url: string | null;
  about_role: string | null;
  match_score: number | null;
  match_reason: string | null;
  matched_skills: string[] | null;
  missing_skills: string[] | null;
  company_research: CompanyResearchDossier | null;
  found_at: string;
};

type JobsDatabase = Awaited<ReturnType<typeof import("@/lib/insforge-server").createInsForgeServerClient>>["database"];

const jobDetailsSelect = "id, title, company, location, salary, job_type, external_apply_url, about_role, match_score, match_reason, matched_skills, missing_skills, company_research, found_at";

export async function getJobDetails(database: JobsDatabase, userId: string, jobId: string): Promise<JobDetails | null> {
  const { data, error } = await database
    .from("jobs")
    .select(jobDetailsSelect)
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as JobDetails | null;
}
