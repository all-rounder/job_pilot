import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { researchCompany } from "@/agent/research";
import { createInsForgeServerClient } from "@/lib/insforge-server";
import { profileFromRow } from "@/lib/profile";
import { createPostHogServer } from "@/lib/posthog-server";

const requestSchema = z.object({
  jobId: z.string().uuid(),
  force: z.boolean().default(false),
}).strict();

const activeJobs = new Set<string>();

function errorResponse(error: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error }, { status });
}

function safeErrorDetails(error: unknown): { name: string } {
  return { name: error instanceof Error ? error.name : "UnknownError" };
}

async function writeAgentLog(
  database: Awaited<ReturnType<typeof createInsForgeServerClient>>["database"],
  runId: string,
  userId: string,
  level: "info" | "success" | "warning" | "error",
  message: string,
  jobId?: string,
): Promise<void> {
  const { error } = await database.from("agent_logs").insert({ run_id: runId, user_id: userId, job_id: jobId ?? null, level, message });
  if (error) console.error("[agent/research:log]", error);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let runId: string | null = null;
  let userId: string | null = null;
  let database: Awaited<ReturnType<typeof createInsForgeServerClient>>["database"] | null = null;
  let lockKey: string | null = null;
  const posthog = createPostHogServer();

  try {
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) return errorResponse("Enter a valid job to research.", 400);

    const insforge = await createInsForgeServerClient();
    database = insforge.database;
    const { data: authData, error: authError } = await insforge.auth.getCurrentUser();
    const user = authData?.user;
    if (authError || !user) return errorResponse("Your session expired. Sign in again and retry.", 401);
    userId = user.id;
    lockKey = `${user.id}:${parsed.data.jobId}`;
    if (activeJobs.has(lockKey)) return errorResponse("Research is already running for this job.", 409);
    activeJobs.add(lockKey);

    const { data: job, error: jobError } = await database
      .from("jobs")
      .select("id, title, company, about_role, matched_skills, missing_skills, source_url, company_research")
      .eq("id", parsed.data.jobId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (jobError) {
      console.error("[agent/research:job]", safeErrorDetails(jobError));
      return errorResponse("We could not load this job. Please retry.", 500);
    }
    if (!job) return errorResponse("This job is not available.", 404);
    if (job.company_research && !parsed.data.force) {
      return NextResponse.json({ success: true, data: { jobId: parsed.data.jobId, dossier: job.company_research, refreshed: false } });
    }

    const { data: profileRow, error: profileError } = await database
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) {
      console.error("[agent/research:profile]", safeErrorDetails(profileError));
      return errorResponse("We could not load your profile. Please retry.", 500);
    }
    if (!profileRow) return errorResponse("Complete and save your profile before researching a company.", 422);

    const { data: run, error: runError } = await database
      .from("agent_runs")
      .insert({ user_id: user.id, job_title_searched: `Company research: ${job.title}`, location_searched: null, completed_at: new Date().toISOString() })
      .select("id")
      .single();
    if (runError || !run) {
      console.error("[agent/research:run-create]", safeErrorDetails(runError));
      return errorResponse("We could not start company research. Please retry.", 500);
    }
    runId = String(run.id);
    await writeAgentLog(database, runId, user.id, "info", "Company research started.");

    const result = await researchCompany({
      title: String(job.title),
      company: String(job.company),
      aboutRole: String(job.about_role ?? ""),
      matchedSkills: Array.isArray(job.matched_skills) ? job.matched_skills : [],
      missingSkills: Array.isArray(job.missing_skills) ? job.missing_skills : [],
      sourceUrl: String(job.source_url),
    }, profileFromRow(profileRow as Record<string, unknown>, user.email ?? ""));

    if (!result.success) {
      await writeAgentLog(database, runId, user.id, "error", "Company research failed.");
      await database.from("agent_runs").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", runId).eq("user_id", user.id);
      return errorResponse("We could not complete company research. Please retry.", 502);
    }

    const { error: updateError } = await database
      .from("jobs")
      .update({ company_research: result.dossier })
      .eq("id", parsed.data.jobId)
      .eq("user_id", user.id);
    if (updateError) {
      await writeAgentLog(database, runId, user.id, "error", "Company research could not be saved.");
      await database.from("agent_runs").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", runId).eq("user_id", user.id);
      console.error("[agent/research:save]", safeErrorDetails(updateError));
      return errorResponse("We could not save company research. Please retry.", 500);
    }

    await writeAgentLog(database, runId, user.id, "success", "Company research saved.", parsed.data.jobId);
    await database.from("agent_runs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", runId).eq("user_id", user.id);
    posthog?.capture({ distinctId: user.id, event: "company_researched", properties: { userId: user.id, jobId: parsed.data.jobId, company: job.company } });
    return NextResponse.json({ success: true, data: { jobId: parsed.data.jobId, dossier: result.dossier, refreshed: Boolean(parsed.data.force) } });
  } catch (error) {
    if (database && runId && userId) {
      await writeAgentLog(database, runId, userId, "error", "Company research failed unexpectedly.");
      await database.from("agent_runs").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", runId).eq("user_id", userId);
    }
    console.error("[agent/research]", safeErrorDetails(error));
    return errorResponse("We could not complete company research. Please retry.", 500);
  } finally {
    if (lockKey) activeJobs.delete(lockKey);
    try {
      await posthog?.shutdown();
    } catch (error) {
      console.error("[agent/research:posthog]", safeErrorDetails(error));
    }
  }
}
