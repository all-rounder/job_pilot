import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  detectCountry,
  mapAdzunaJob,
  scoreJobAgainstProfile,
  searchAdzunaJobs,
} from "@/agent/adzuna";
import { createInsForgeServerClient } from "@/lib/insforge-server";
import { profileFromRow } from "@/lib/profile";
import { createPostHogServer } from "@/lib/posthog-server";
import { MATCH_THRESHOLD } from "@/lib/utils";

const searchRequestSchema = z.object({
  jobTitle: z.string().trim().min(1).max(160),
  location: z.string().trim().max(160).default(""),
}).strict();

type SavedJob = {
  id: string;
  external_id: string | null;
  source_url: string;
  external_apply_url: string;
  title: string;
  company: string;
  location: string | null;
  salary: string | null;
  job_type: string | null;
  about_role: string;
  match_score: number | null;
  match_reason: string | null;
  matched_skills: string[];
  missing_skills: string[];
  found_at: string;
};

const savedJobSelect = "id, external_id, source_url, external_apply_url, title, company, location, salary, job_type, about_role, match_score, match_reason, matched_skills, missing_skills, found_at";

function errorResponse(error: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error }, { status });
}

function errorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  const code = error.code;
  return typeof code === "string" ? code : null;
}

function isUniqueViolation(error: unknown): boolean {
  return errorCode(error) === "23505";
}

function safeErrorDetails(error: unknown): { name: string } {
  return { name: error instanceof Error ? error.name : "UnknownError" };
}

async function writeAgentLog(
  insforge: Awaited<ReturnType<typeof createInsForgeServerClient>>,
  runId: string,
  userId: string,
  level: "warning" | "error",
  message: string,
  jobId?: string,
): Promise<void> {
  const { error } = await insforge.database.from("agent_logs").insert({
    run_id: runId,
    user_id: userId,
    job_id: jobId ?? null,
    level,
    message,
  });
  if (error) console.error("[agent/find:log]", error);
}

async function closePostHog(posthog: ReturnType<typeof createPostHogServer>): Promise<void> {
  if (posthog) await posthog.shutdown();
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  let posthog: ReturnType<typeof createPostHogServer> = null;
  let insforge: Awaited<ReturnType<typeof createInsForgeServerClient>> | null = null;
  let runId: string | null = null;
  let userId: string | null = null;

  try {
    const parsedBody = searchRequestSchema.safeParse(await request.json());
    if (!parsedBody.success) return errorResponse("Enter a job title before searching.", 400);
    const { jobTitle, location } = parsedBody.data;

    insforge = await createInsForgeServerClient();
    const { data: authData, error: authError } = await insforge.auth.getCurrentUser();
    const user = authData?.user;
    if (authError || !user) return errorResponse("Your session expired. Sign in again and retry.", 401);
    userId = user.id;

    const { data: profileRow, error: profileError } = await insforge.database
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) {
      console.error("[agent/find:profile]", profileError);
      return errorResponse("We could not load your profile. Please retry.", 500);
    }
    if (!profileRow) return errorResponse("Complete and save your profile before searching.", 422);

    const profile = profileFromRow(profileRow as Record<string, unknown>, user.email ?? "");
    const sparseProfile = profile.skills.length === 0
      && profile.workExperience.length === 0
      && !profile.currentTitle
      && profile.jobTitles.length === 0;
    const country = detectCountry(location);

    const { data: run, error: runError } = await insforge.database
      .from("agent_runs")
      .insert({
        user_id: user.id,
        job_title_searched: jobTitle,
        location_searched: location || null,
      })
      .select("id")
      .single();
    if (runError || !run) {
      console.error("[agent/find:run-create]", runError);
      return errorResponse("We could not start the job search. Please retry.", 500);
    }
    runId = String(run.id);

    posthog = createPostHogServer();
    posthog?.capture({
      distinctId: user.id,
      event: "job_search_started",
      properties: { userId: user.id, jobTitle, location },
    });

    let adzunaJobs;
    try {
      adzunaJobs = await searchAdzunaJobs(jobTitle, location, country);
    } catch (error) {
      await writeAgentLog(insforge, runId, user.id, "error", "Job provider search failed.");
      await insforge.database.from("agent_runs").update({ status: "failed" }).eq("id", runId).eq("user_id", user.id);
      console.error("[agent/find:adzuna]", safeErrorDetails(error));
      return errorResponse("We could not reach the job provider. Please retry.", 502);
    }

    const savedJobs: SavedJob[] = [];
    let skippedCount = 0;
    let failedCount = 0;

    for (const adzunaJob of adzunaJobs) {
      const mappedJob = mapAdzunaJob(adzunaJob);
      let match;
      try {
        match = await scoreJobAgainstProfile(mappedJob, profile);
      } catch (error) {
        failedCount += 1;
        await writeAgentLog(insforge, runId, user.id, "warning", `Could not score job ${mappedJob.external_id}.`);
        console.error("[agent/find:score]", safeErrorDetails(error));
        continue;
      }

      const { data: savedJob, error: insertError } = await insforge.database
        .from("jobs")
        .insert({
          ...mappedJob,
          user_id: user.id,
          run_id: runId,
          source: "search",
          match_score: match.matchScore,
          match_reason: match.matchReason,
          matched_skills: match.matchedSkills,
          missing_skills: match.missingSkills,
        })
        .select(savedJobSelect)
        .single();

      if (isUniqueViolation(insertError)) {
        skippedCount += 1;
        const { data: existingJob, error: existingJobError } = await insforge.database
          .from("jobs")
          .select(savedJobSelect)
          .eq("user_id", user.id)
          .eq("source", "search")
          .eq("external_id", mappedJob.external_id)
          .maybeSingle();
        if (existingJobError || !existingJob) {
          await writeAgentLog(insforge, runId, user.id, "warning", `Could not return duplicate job ${mappedJob.external_id}.`);
          console.error("[agent/find:duplicate-read]", existingJobError);
          failedCount += 1;
          continue;
        }
        savedJobs.push(existingJob as SavedJob);
        continue;
      }
      if (insertError || !savedJob) {
        failedCount += 1;
        await writeAgentLog(insforge, runId, user.id, "warning", `Could not save job ${mappedJob.external_id}.`);
        console.error("[agent/find:job-insert]", insertError);
        continue;
      }

      const typedJob = savedJob as SavedJob;
      savedJobs.push(typedJob);
      posthog?.capture({
        distinctId: user.id,
        event: "job_found",
        properties: { userId: user.id, source: "search", matchScore: match.matchScore },
      });
    }

    const completedCount = savedJobs.length + skippedCount;
    const partial = failedCount > 0;
    const terminalStatus = completedCount > 0 || adzunaJobs.length === 0 ? "completed" : "failed";
    await insforge.database.from("agent_runs").update({
      status: terminalStatus,
      jobs_found: savedJobs.length,
    }).eq("id", runId).eq("user_id", user.id);

    if (terminalStatus === "failed") {
      return errorResponse("We could not score any jobs from this search. Please retry.", 502);
    }

    const warning = sparseProfile
      ? "Your profile has limited matching details, so these scores may be less precise."
      : partial
        ? `${failedCount} job${failedCount === 1 ? "" : "s"} could not be processed.`
        : null;
    const strongMatchCount = savedJobs.filter((job) => (job.match_score ?? 0) >= MATCH_THRESHOLD).length;
    const message = `Found ${adzunaJobs.length} jobs and saved ${strongMatchCount} strong matches.`;

    return NextResponse.json({
      success: true,
      data: {
        runId,
        country,
        jobs: savedJobs,
        totalCount: adzunaJobs.length,
        savedCount: savedJobs.length,
        skippedCount,
        failedCount,
        strongMatchCount,
        partial,
        warning,
        message,
      },
    });
  } catch (error) {
    if (insforge && runId && userId) {
      await writeAgentLog(insforge, runId, userId, "error", "Job search failed unexpectedly.");
      await insforge.database.from("agent_runs").update({ status: "failed" }).eq("id", runId).eq("user_id", userId);
    }
    console.error("[agent/find]", safeErrorDetails(error));
    return errorResponse("We could not complete the job search. Please retry.", 500);
  } finally {
    try {
      await closePostHog(posthog);
    } catch (error) {
      console.error("[agent/find:posthog]", safeErrorDetails(error));
    }
  }
}
