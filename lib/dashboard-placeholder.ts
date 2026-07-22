export type DashboardStat = {
  label: string;
  value: string;
  trend?: string;
  subtitle: string;
};

export type ActivityItem = {
  id: string;
  kind: "search" | "research" | "match";
  description: string;
  relativeTime: string;
};

export type ChartPoint = {
  label: string;
  value: number;
};

// PLACEHOLDER: Features 15 through 17 replace these typed values with live sources.
export const dashboardStats: DashboardStat[] = [
  { label: "Total Jobs Found", value: "284", trend: "+12%", subtitle: "vs last week" },
  { label: "Avg. Match Rate", value: "82%", trend: "+3%", subtitle: "vs last week" },
  { label: "Companies Researched", value: "35", subtitle: "Total researched" },
  { label: "Jobs This Week", value: "28", subtitle: "New this week" },
];

export const jobsFoundOverTime: ChartPoint[] = [
  { label: "Mon", value: 12 }, { label: "Tue", value: 45 }, { label: "Wed", value: 32 },
  { label: "Thu", value: 61 }, { label: "Fri", value: 85 }, { label: "Sat", value: 39 }, { label: "Sun", value: 10 },
];

export const companyResearchActivity: ChartPoint[] = [
  { label: "Mon", value: 2 }, { label: "Tue", value: 5 }, { label: "Wed", value: 3 },
  { label: "Thu", value: 8 }, { label: "Fri", value: 12 }, { label: "Sat", value: 4 }, { label: "Sun", value: 1 },
];

export const matchScoreDistribution: ChartPoint[] = [
  { label: "50–60%", value: 5 }, { label: "60–70%", value: 14 }, { label: "70–80%", value: 45 },
  { label: "80–90%", value: 85 }, { label: "90–100%", value: 35 },
];
