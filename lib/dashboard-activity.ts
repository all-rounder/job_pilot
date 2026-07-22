import type { ActivityItem } from "@/lib/dashboard-placeholder";

type DashboardDatabase = Awaited<
  ReturnType<
    typeof import("@/lib/insforge-server").createInsForgeServerClient
  >
>["database"];

type AgentRunRow = {
  id: string;
  job_title_searched: string;
  jobs_found?: number | null;
  completed_at: string | null;
};

type AgentLogRow = {
  run_id: string;
  job_id: string | null;
  created_at?: string | null;
};

type JobRow = {
  id: string;
  title: string;
  company: string;
};

type ActivityCandidate = ActivityItem & {
  completedAt: number;
};

const MAX_ACTIVITY_ITEMS = 5;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAgentRunRow(value: unknown): value is AgentRunRow {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.job_title_searched === "string"
    && (typeof value.jobs_found === "number" || value.jobs_found === null || value.jobs_found === undefined)
    && (typeof value.completed_at === "string" || value.completed_at === null);
}

function isAgentLogRow(value: unknown): value is AgentLogRow {
  return isRecord(value)
    && typeof value.run_id === "string"
    && (typeof value.job_id === "string" || value.job_id === null || value.job_id === undefined)
    && (typeof value.created_at === "string" || value.created_at === null || value.created_at === undefined);
}

function isJobRow(value: unknown): value is JobRow {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.title === "string"
    && typeof value.company === "string";
}

function rowsOf<T>(value: unknown, guard: (row: unknown) => row is T): T[] {
  return Array.isArray(value) ? value.filter(guard) : [];
}

function relativeTime(timestamp: number, now: number): string {
  const elapsedSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (elapsedSeconds < 60) return "Just now";
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function parseTimestamp(value: string | null): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export async function getDashboardActivity(
  database: DashboardDatabase,
  userId: string,
): Promise<ActivityItem[]> {
  try {
    const [runsResult, logsResult] = await Promise.all([
      database
        .from("agent_runs")
        .select("id, job_title_searched, jobs_found, completed_at")
        .eq("user_id", userId)
        .eq("status", "completed"),
      database
        .from("agent_logs")
        .select("run_id, job_id, created_at")
        .eq("user_id", userId),
    ]);

    if (runsResult.error || logsResult.error) {
      console.error("[dashboard-activity:read]", runsResult.error ?? logsResult.error);
      return [];
    }

    const runs = rowsOf(runsResult.data, isAgentRunRow);
    const successfulResearchLogs = rowsOf(logsResult.data, isAgentLogRow)
      .filter((log) => log.job_id !== null);
    const researchRunIds = new Set(successfulResearchLogs.map((log) => log.run_id));
    const jobIds = [...new Set(successfulResearchLogs.map((log) => log.job_id).filter((id): id is string => id !== null))];
    const researchRuns = runs.filter((run) => run.job_title_searched.startsWith("Company research:"));

    let jobs: JobRow[] = [];
    if (jobIds.length > 0 || researchRuns.length > 0) {
      const jobsResult = await database
        .from("jobs")
        .select("id, title, company")
        .eq("user_id", userId);
      if (jobsResult.error) {
        console.error("[dashboard-activity:jobs]", jobsResult.error);
        return [];
      }
      jobs = rowsOf(jobsResult.data, isJobRow);
    }

    const jobsById = new Map(jobs.map((job) => [job.id, job]));
    const jobsByTitle = new Map(jobs.map((job) => [job.title, job]));
    const now = Date.now();
    const candidates: ActivityCandidate[] = [];

    for (const run of runs) {
      const timestamp = parseTimestamp(run.completed_at);
      if (
        timestamp === null
        || researchRunIds.has(run.id)
        || run.job_title_searched.startsWith("Company research:")
      ) continue;

      candidates.push({
        id: `search-${run.id}`,
        kind: "match",
        description: `Found ${run.jobs_found ?? 0} job${run.jobs_found === 1 ? "" : "s"} for ${run.job_title_searched}`,
        relativeTime: relativeTime(timestamp, now),
        completedAt: timestamp,
      });
    }

    const logsByRunId = new Map(successfulResearchLogs.map((log) => [log.run_id, log]));
    for (const run of researchRuns) {
      const log = logsByRunId.get(run.id);
      const title = run.job_title_searched.replace("Company research:", "").trim();
      const job = (log?.job_id ? jobsById.get(log.job_id) : undefined) ?? jobsByTitle.get(title);
      const timestamp = parseTimestamp(run.completed_at ?? log?.created_at ?? null);
      if (!run || !job || timestamp === null) continue;

      candidates.push({
        id: `research-${run.id}-${job.id}`,
        kind: "research",
        description: `Researched ${job.company}`,
        relativeTime: relativeTime(timestamp, now),
        completedAt: timestamp,
      });
    }

    return candidates
      .sort((left, right) => right.completedAt - left.completedAt)
      .slice(0, MAX_ACTIVITY_ITEMS)
      .map((item) => ({
        id: item.id,
        kind: item.kind,
        description: item.description,
        relativeTime: item.relativeTime,
      }));
  } catch (error) {
    console.error("[dashboard-activity]", error);
    return [];
  }
}
