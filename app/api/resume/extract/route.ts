import {
  extractPdfText,
  extractProfileFromText,
  ResumeExtractionError,
  ResumeTextError,
} from "@/agent/extractor";
import { createInsForgeServerClient } from "@/lib/insforge-server";
import { isOwnedResumeKey } from "@/lib/profile";

const RESUME_BUCKET = "resumes";

function errorResponse(error: string, status: number): Response {
  return Response.json({ success: false, error }, { status });
}

export async function POST(): Promise<Response> {
  try {
    const insforge = await createInsForgeServerClient();
    const { data: authData, error: authError } = await insforge.auth.getCurrentUser();
    const user = authData.user;
    if (authError || !user) return errorResponse("Your session expired. Sign in again and retry.", 401);

    const { data: profile, error: profileError } = await insforge.database
      .from("profiles")
      .select("resume_pdf_url")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) {
      console.error("[api/resume/extract:profile]", profileError);
      return errorResponse("We could not load your resume. Please retry.", 500);
    }

    const key = typeof profile?.resume_pdf_url === "string" ? profile.resume_pdf_url : null;
    if (!key || !isOwnedResumeKey(key, user.id)) {
      return errorResponse("Upload a resume before extracting profile details.", 404);
    }

    const { data: blob, error: downloadError } = await insforge.storage.from(RESUME_BUCKET).download(key);
    if (downloadError || !blob) {
      console.error("[api/resume/extract:download]", downloadError);
      return errorResponse("We could not load your resume. Please retry.", 500);
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    let text: string;
    try {
      text = await extractPdfText(buffer);
    } catch (error) {
      if (error instanceof ResumeTextError) {
        console.error("[api/resume/extract:pdf]", {
          reason: error.reason,
          parserErrorName: error.parserErrorName,
          parserErrorMessage: error.parserErrorMessage,
          bytes: buffer.byteLength,
        });
      }
      throw error;
    }
    const data = await extractProfileFromText(text);
    return Response.json({ success: true, data });
  } catch (error) {
    if (error instanceof ResumeTextError) return errorResponse(error.message, 422);
    if (error instanceof ResumeExtractionError) {
      console.error("[api/resume/extract:openai]", error.message);
      return errorResponse("We could not extract your profile. Please retry.", 502);
    }
    console.error("[api/resume/extract]", error);
    return errorResponse("We could not extract your profile. Please retry.", 500);
  }
}
