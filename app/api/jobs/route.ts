import { NextRequest, NextResponse } from "next/server";

import { getJobsListing, parseJobsQuery } from "@/lib/jobs";
import { createInsForgeServerClient } from "@/lib/insforge-server";

function errorResponse(error: string, status: number): NextResponse {
  return NextResponse.json({ success: false, error }, { status });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const insforge = await createInsForgeServerClient();
    const { data: authData, error: authError } = await insforge.auth.getCurrentUser();
    const user = authData?.user;
    if (authError || !user) return errorResponse("Your session expired. Sign in again and retry.", 401);

    const query = parseJobsQuery(request.nextUrl.searchParams);
    const listing = await getJobsListing(insforge.database, user.id, query);

    return NextResponse.json({ success: true, data: listing });
  } catch (error) {
    console.error("[jobs/list]", error instanceof Error ? { name: error.name } : { name: "UnknownError" });
    return errorResponse("We could not load your jobs. Please try again.", 500);
  }
}
