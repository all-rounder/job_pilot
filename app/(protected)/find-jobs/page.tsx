import { FindJobsPage } from "@/components/find-jobs/FindJobsPage";
import { getJobsListing, parseJobsQuery } from "@/lib/jobs";
import { createInsForgeServerClient } from "@/lib/insforge-server";

export const metadata = {
  title: "Find Jobs | JobPilot",
};

type FindJobsRouteProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FindJobsRoute({ searchParams }: FindJobsRouteProps) {
  const rawSearchParams = await searchParams;
  const query = parseJobsQuery(rawSearchParams);
  const insforge = await createInsForgeServerClient();
  const { data: authData } = await insforge.auth.getCurrentUser();

  if (!authData?.user) return <FindJobsPage initialListing={null} initialQuery={query} initialError="Your session expired. Sign in again and retry." />;

  let listing;
  try {
    listing = await getJobsListing(insforge.database, authData.user.id, query);
  } catch (error) {
    console.error("[find-jobs/page]", error instanceof Error ? { name: error.name } : { name: "UnknownError" });
    listing = null;
  }

  return listing
    ? <FindJobsPage initialListing={listing} initialQuery={query} />
    : <FindJobsPage initialListing={null} initialQuery={query} initialError="We could not load your jobs. Please try again." />;
}
