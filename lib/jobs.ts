import { MATCH_THRESHOLD } from "@/lib/utils";

export const JOBS_PAGE_SIZE = 8;

export type JobsMatchFilter = "all" | "high" | "low";
export type JobsSortOrder = "score" | "newest" | "oldest";

export type JobsQuery = {
  q: string;
  match: JobsMatchFilter;
  sort: JobsSortOrder;
  page: number;
};

export type JobListItem = {
  id: string;
  title: string;
  company: string;
  salary: string | null;
  match_score: number | null;
  found_at: string;
};

export type JobsListing = {
  jobs: JobListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  query: JobsQuery;
};

export const jobListSelect = "id, title, company, salary, match_score, found_at";

function firstParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function readPage(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function parseJobsQuery(params: URLSearchParams | Record<string, string | string[] | undefined>): JobsQuery {
  const get = (key: string): string => params instanceof URLSearchParams
    ? params.get(key) ?? ""
    : firstParam(params[key]);
  const match = get("match");
  const sort = get("sort");

  return {
    q: get("q").trim(),
    match: match === "high" || match === "low" ? match : "all",
    sort: sort === "newest" || sort === "oldest" ? sort : "score",
    page: readPage(get("page")),
  };
}

export function jobsQueryKey(query: JobsQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.match !== "all") params.set("match", query.match);
  if (query.sort !== "score") params.set("sort", query.sort);
  if (query.page > 1) params.set("page", String(query.page));
  const value = params.toString();
  return value ? `?${value}` : "";
}

export function buildJobsApiPath(query: JobsQuery): string {
  return `/api/jobs${jobsQueryKey(query)}`;
}

type JobsDatabase = Awaited<ReturnType<typeof import("@/lib/insforge-server").createInsForgeServerClient>>["database"];

function escapeSearch(value: string): string {
  return value.replace(/[\\%_,()]/g, " ");
}

function createJobsQuery(database: JobsDatabase, userId: string, query: JobsQuery) {
  let builder = database
    .from("jobs")
    .select(jobListSelect, { count: "exact" })
    .eq("user_id", userId);

  if (query.q) {
    const search = escapeSearch(query.q);
    builder = builder.or(`company.ilike.%${search}%,title.ilike.%${search}%`);
  }

  if (query.match === "high") builder = builder.gte("match_score", MATCH_THRESHOLD);
  if (query.match === "low") builder = builder.lt("match_score", MATCH_THRESHOLD);

  if (query.sort === "score") {
    builder = builder.order("match_score", { ascending: false });
  } else if (query.sort === "newest") {
    builder = builder.order("found_at", { ascending: false });
  } else {
    builder = builder.order("found_at", { ascending: true });
  }

  return builder.order("id", { ascending: false });
}

export async function getJobsListing(database: JobsDatabase, userId: string, query: JobsQuery): Promise<JobsListing> {
  const requestedStart = (query.page - 1) * JOBS_PAGE_SIZE;
  let result = await createJobsQuery(database, userId, query)
    .range(requestedStart, requestedStart + JOBS_PAGE_SIZE - 1);

  if (result.error) throw result.error;

  const total = result.count ?? 0;
  const pageCount = total === 0 ? 0 : Math.ceil(total / JOBS_PAGE_SIZE);
  const page = pageCount === 0 ? 1 : Math.min(query.page, pageCount);

  if (page !== query.page) {
    const start = (page - 1) * JOBS_PAGE_SIZE;
    result = await createJobsQuery(database, userId, { ...query, page })
      .range(start, start + JOBS_PAGE_SIZE - 1);
    if (result.error) throw result.error;
  }

  return {
    jobs: (result.data ?? []) as JobListItem[],
    total,
    page,
    pageSize: JOBS_PAGE_SIZE,
    pageCount,
    query: { ...query, page },
  };
}
