import {
  generateResumeContent,
  renderResumePdf,
  ResumeGenerationError,
} from "@/agent/resume-generator";
import { createInsForgeServerClient } from "@/lib/insforge-server";
import {
  getProfileCompletion,
  isOwnedResumeKey,
  profileFromRow,
} from "@/lib/profile";

const RESUME_BUCKET = "resumes";

export const runtime = "nodejs";

function errorResponse(error: string, status: number): Response {
  return Response.json({ success: false, error }, { status });
}

export async function POST(): Promise<Response> {
  try {
    const insforge = await createInsForgeServerClient();
    const { data: authData, error: authError } = await insforge.auth.getCurrentUser();
    const user = authData.user;
    if (authError || !user?.email) {
      return errorResponse("Your session expired. Sign in again and retry.", 401);
    }

    const { data: row, error: profileError } = await insforge.database
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError || !row) {
      console.error("[api/resume/generate:profile]", profileError);
      return errorResponse("We could not load your saved profile. Please retry.", 500);
    }

    const profile = profileFromRow(row as Record<string, unknown>, user.email);
    const completion = getProfileCompletion(profile);
    if (!completion.isComplete) {
      return errorResponse("Complete and save your profile before generating a resume.", 422);
    }

    const content = await generateResumeContent(profile);
    const buffer = await renderResumePdf(profile, content);
    const requestedKey = `${user.id}/resume-${crypto.randomUUID()}.pdf`;
    const oldKey = profile.resumeKey;
    const pdfBlob = new Blob([new Uint8Array(buffer)], { type: "application/pdf" });
    const resumeBucket = insforge.storage.from(RESUME_BUCKET);
    const { data: uploaded, error: uploadError } = await resumeBucket.upload(requestedKey, pdfBlob);
    if (uploadError || !uploaded || !isOwnedResumeKey(uploaded.key, user.id)) {
      console.error("[api/resume/generate:upload]", {
        hasError: Boolean(uploadError),
        hasUpload: Boolean(uploaded),
        keyOwned: uploaded ? isOwnedResumeKey(uploaded.key, user.id) : false,
      });
      return errorResponse("We could not store your generated resume. Your previous resume is unchanged.", 500);
    }

    if (oldKey !== uploaded.key) {
      const { error: pointerError } = await insforge.database
        .from("profiles")
        .update({ resume_pdf_url: uploaded.key })
        .eq("id", user.id);
      if (pointerError) {
        console.error("[api/resume/generate:activate]", pointerError);
        await resumeBucket.remove(uploaded.key);
        return errorResponse("We could not activate your generated resume. Your previous resume is unchanged.", 500);
      }

      if (oldKey && isOwnedResumeKey(oldKey, user.id)) {
        const { error: cleanupError } = await resumeBucket.remove(oldKey);
        if (cleanupError) console.error("[api/resume/generate:cleanup]", cleanupError);
      }
    }

    return Response.json({ success: true, data: { resumeKey: uploaded.key } });
  } catch (error) {
    if (error instanceof ResumeGenerationError) {
      console.error("[api/resume/generate]", { stage: error.stage, message: error.message });
      const status = error.stage === "openai" || error.stage === "validation" ? 502 : 500;
      return errorResponse("We could not generate your resume. Please retry.", status);
    }
    console.error("[api/resume/generate]", error);
    return errorResponse("We could not generate your resume. Please retry.", 500);
  }
}
