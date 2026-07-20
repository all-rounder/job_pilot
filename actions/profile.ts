"use server";

import { revalidatePath } from "next/cache";

import {
  getProfileCompletion,
  initialProfileActionState,
  isOwnedResumeKey,
  profileFromFormData,
  profileToDatabase,
  validateProfile,
  type ProfileActionState,
} from "@/lib/profile";
import { createInsForgeServerClient } from "@/lib/insforge-server";
import { createPostHogServer } from "@/lib/posthog-server";

const RESUME_BUCKET = "resumes";
const MAX_RESUME_BYTES = 10_485_760;
const PDF_PREFIX = "%PDF-";

export type ResumeActionState = {
  status: "idle" | "success" | "error";
  message: string;
  resumeKey: string | null;
  updatedAt: number;
};

function resumeResult(status: ResumeActionState["status"], message: string, resumeKey: string | null): ResumeActionState {
  return { status, message, resumeKey, updatedAt: Date.now() };
}

function actionError(message: string, fieldErrors: Record<string, string> = {}): ProfileActionState {
  return { status: "error", message, fieldErrors };
}

async function captureFirstCompletion(userId: string): Promise<void> {
  const posthog = createPostHogServer();
  if (!posthog) return;

  try {
    posthog.capture({
      distinctId: userId,
      event: "profile_completed",
      properties: { userId },
    });
  } catch (error) {
    console.error("[actions/profile:capture-completion]", error);
  } finally {
    try {
      await posthog.shutdown();
    } catch (error) {
      console.error("[actions/profile:shutdown-posthog]", error);
    }
  }
}

export async function saveProfile(
  _previousState: ProfileActionState = initialProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  void _previousState;
  try {
    const insforge = await createInsForgeServerClient();
    const { data: authData, error: authError } = await insforge.auth.getCurrentUser();
    const user = authData.user;

    if (authError || !user || !user.email) {
      return actionError("Your session expired. Sign in again and retry.");
    }

    const parsed = profileFromFormData(formData, user.email);
    const validated = validateProfile(parsed);
    if (!validated.data) {
      return actionError("Review the highlighted fields and try again.", validated.errors);
    }

    const { data, error } = await insforge.database.rpc("jobpilot_save_profile", {
      p_profile: profileToDatabase(validated.data),
    });

    if (error || !Array.isArray(data) || data.length !== 1) {
      console.error("[actions/profile:save]", error);
      return actionError("We could not save your profile. Your entries are still here, so please retry.");
    }

    const result = data[0] as Record<string, unknown>;
    if (result.first_completed === true) {
      await captureFirstCompletion(user.id);
    }

    const completion = getProfileCompletion(validated.data);
    return {
      status: "success",
      message: completion.isComplete
        ? "Profile saved. You are ready for tailored matches."
        : `Profile saved. ${completion.missingFields.length} completion items remain.`,
      fieldErrors: {},
      savedProfile: validated.data,
      completion,
    };
  } catch (error) {
    console.error("[actions/profile:save]", error);
    return actionError("We could not save your profile. Your entries are still here, so please retry.");
  }
}

async function getAuthenticatedProfileContext() {
  const insforge = await createInsForgeServerClient();
  const { data: authData, error: authError } = await insforge.auth.getCurrentUser();
  const user = authData.user;
  if (authError || !user || !user.email) return null;

  const { data: profile, error: profileError } = await insforge.database
    .from("profiles")
    .select("resume_pdf_url")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[actions/profile:load-resume]", profileError);
    return null;
  }

  return { insforge, user, profile: profile as Record<string, unknown> | null };
}

async function validatePdf(file: File): Promise<string | null> {
  if (file.type !== "application/pdf") return "Select a PDF file.";
  if (file.size > MAX_RESUME_BYTES) return "Your PDF must be 10 MiB or smaller.";
  if (file.size < PDF_PREFIX.length) return "This file is not a valid PDF.";
  const prefix = new TextDecoder().decode(await file.slice(0, PDF_PREFIX.length).arrayBuffer());
  return prefix === PDF_PREFIX ? null : "This file is not a valid PDF.";
}

export async function uploadResume(
  previousState: ResumeActionState,
  formData: FormData,
): Promise<ResumeActionState> {
  try {
    const file = formData.get("resume");
    if (!(file instanceof File) || file.size === 0) {
      return resumeResult("error", "Select a PDF to upload.", previousState.resumeKey);
    }

    const validationError = await validatePdf(file);
    if (validationError) return resumeResult("error", validationError, previousState.resumeKey);

    const context = await getAuthenticatedProfileContext();
    if (!context) {
      return resumeResult("error", "Your session expired. Sign in again and retry.", previousState.resumeKey);
    }

    const oldKey = typeof context.profile?.resume_pdf_url === "string"
      ? context.profile.resume_pdf_url
      : null;
    const requestedKey = `${context.user.id}/resume-${crypto.randomUUID()}.pdf`;
    const { data: uploaded, error: uploadError } = await context.insforge.storage
      .from(RESUME_BUCKET)
      .upload(requestedKey, file);

    if (uploadError || !uploaded || !isOwnedResumeKey(uploaded.key, context.user.id)) {
      console.error("[actions/profile:upload]", uploadError);
      return resumeResult("error", "We could not upload your resume. Your previous resume is unchanged.", oldKey);
    }

    const { error: pointerError } = await context.insforge.database
      .from("profiles")
      .upsert({
        id: context.user.id,
        email: context.user.email,
        resume_pdf_url: uploaded.key,
      }, { onConflict: "id" });

    if (pointerError) {
      console.error("[actions/profile:save-resume-key]", pointerError);
      await context.insforge.storage.from(RESUME_BUCKET).remove(uploaded.key);
      return resumeResult("error", "We could not activate your resume. Your previous resume is unchanged.", oldKey);
    }

    if (oldKey && oldKey !== uploaded.key && isOwnedResumeKey(oldKey, context.user.id)) {
      const { error: cleanupError } = await context.insforge.storage.from(RESUME_BUCKET).remove(oldKey);
      if (cleanupError) console.error("[actions/profile:cleanup-resume]", cleanupError);
    }

    revalidatePath("/profile");
    return resumeResult("success", "Resume uploaded securely.", uploaded.key);
  } catch (error) {
    console.error("[actions/profile:upload]", error);
    return resumeResult("error", "We could not upload your resume. Please retry.", previousState.resumeKey);
  }
}

export async function deleteResume(
  _previousState: ResumeActionState,
  _formData: FormData,
): Promise<ResumeActionState> {
  void _previousState;
  void _formData;
  try {
    const context = await getAuthenticatedProfileContext();
    if (!context) {
      return resumeResult("error", "Your session expired. Sign in again and retry.", null);
    }

    const key = typeof context.profile?.resume_pdf_url === "string"
      ? context.profile.resume_pdf_url
      : null;
    if (!key) return resumeResult("success", "No resume is stored.", null);
    if (!isOwnedResumeKey(key, context.user.id)) {
      console.error("[actions/profile:delete-resume]", "Stored resume key failed ownership validation");
      return resumeResult("error", "We could not remove your resume. Please retry.", key);
    }

    const { error: removeError } = await context.insforge.storage.from(RESUME_BUCKET).remove(key);
    if (removeError) {
      console.error("[actions/profile:delete-resume]", removeError);
      return resumeResult("error", "We could not remove your resume. Please retry.", key);
    }

    const { error: pointerError } = await context.insforge.database
      .from("profiles")
      .update({ resume_pdf_url: null })
      .eq("id", context.user.id)
      .eq("resume_pdf_url", key);

    if (pointerError) {
      console.error("[actions/profile:clear-resume-key]", pointerError);
      return resumeResult("error", "The file was removed, but the profile could not refresh. Retry once.", null);
    }

    revalidatePath("/profile");
    return resumeResult("success", "Resume removed.", null);
  } catch (error) {
    console.error("[actions/profile:delete-resume]", error);
    return resumeResult("error", "We could not remove your resume. Please retry.", null);
  }
}

export async function manageResume(
  previousState: ResumeActionState,
  formData: FormData,
): Promise<ResumeActionState> {
  return formData.get("deleteResume") === "true"
    ? deleteResume(previousState, formData)
    : uploadResume(previousState, formData);
}
