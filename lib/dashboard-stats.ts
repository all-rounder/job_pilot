import type { DashboardStat } from "@/lib/dashboard-placeholder";

type DashboardJobRow = {
  match_score: number | null;
  company_research: unknown;
  found_at: string;
};

type DashboardDatabase = Awaited<
  ReturnType<
    typeof import("@/lib/insforge-server").createInsForgeServerClient
  >
>["database"];

function emptyStats(): DashboardStat[] {
  return [
    { label: "Total Jobs Found", value: "0", subtitle: "All saved jobs" },
    { label: "Avg. Match Rate", value: "0%", subtitle: "Across scored jobs" },
    { label: "Companies Researched", value: "0", subtitle: "Total researched" },
    { label: "Jobs This Week", value: "0", subtitle: "Last 7 days" },
  ];
}

export async function getDashboardStats(
  database: DashboardDatabase,
  userId: string,
): Promise<DashboardStat[]> {
  try {
    const result = await database
      .from("jobs")
      .select("match_score, company_research, found_at")
      .eq("user_id", userId);

    if (result.error) throw result.error;

    const rows = (result.data ?? []) as DashboardJobRow[];
    const scoredRows = rows.filter((row) => row.match_score !== null);
    const averageMatchRate = scoredRows.length
      ? Math.round(
          scoredRows.reduce((total, row) => total + (row.match_score ?? 0), 0) /
            scoredRows.length,
        )
      : 0;
    const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const jobsThisWeek = rows.filter((row) => {
      const foundAt = Date.parse(row.found_at);
      return Number.isFinite(foundAt) && foundAt >= weekStart;
    }).length;
    const companiesResearched = rows.filter(
      (row) => row.company_research !== null,
    ).length;

    return [
      {
        label: "Total Jobs Found",
        value: String(rows.length),
        subtitle: "All saved jobs",
      },
      {
        label: "Avg. Match Rate",
        value: `${averageMatchRate}%`,
        subtitle: "Across scored jobs",
      },
      {
        label: "Companies Researched",
        value: String(companiesResearched),
        subtitle: "Total researched",
      },
      {
        label: "Jobs This Week",
        value: String(jobsThisWeek),
        subtitle: "Last 7 days",
      },
    ];
  } catch (error) {
    console.error("[dashboard-stats]", error);
    return emptyStats();
  }
}
