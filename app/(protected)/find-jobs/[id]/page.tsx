import { notFound } from "next/navigation";

import { JobDetailsPage } from "@/components/job-details/JobDetailsPage";
import { getJobDetails } from "@/lib/job-details";
import { createInsForgeServerClient } from "@/lib/insforge-server";

export const metadata = {
  title: "Job Details | JobPilot",
};

type JobDetailsRouteProps = {
  params: Promise<{ id: string }>;
};

export default async function JobDetailsRoute({ params }: JobDetailsRouteProps) {
  const { id } = await params;
  const insforge = await createInsForgeServerClient();
  const { data: authData } = await insforge.auth.getCurrentUser();

  if (!authData?.user) notFound();

  let job;
  try {
    job = await getJobDetails(insforge.database, authData.user.id, id);
  } catch (error) {
    console.error("[find-jobs/id]", error instanceof Error ? { name: error.name } : { name: "UnknownError" });
    notFound();
  }

  if (!job) notFound();
  return <JobDetailsPage job={job} />;
}
