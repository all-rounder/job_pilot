import { createInsForgeServerClient } from "@/lib/insforge-server";
import { isOwnedResumeKey } from "@/lib/profile";

const RESUME_BUCKET = "resumes";

export async function GET(): Promise<Response> {
  try {
    const insforge = await createInsForgeServerClient();
    const { data: authData, error: authError } = await insforge.auth.getCurrentUser();
    const user = authData.user;
    if (authError || !user) return new Response(null, { status: 401 });

    const { data: profile, error: profileError } = await insforge.database
      .from("profiles")
      .select("resume_pdf_url")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) {
      console.error("[api/resume]", profileError);
      return Response.json({ success: false, error: "Could not load resume" }, { status: 500 });
    }

    const key = typeof profile?.resume_pdf_url === "string" ? profile.resume_pdf_url : null;
    if (!key || !isOwnedResumeKey(key, user.id)) return new Response(null, { status: 404 });

    const { data: blob, error: downloadError } = await insforge.storage.from(RESUME_BUCKET).download(key);
    if (downloadError || !blob) {
      console.error("[api/resume]", downloadError);
      return Response.json({ success: false, error: "Could not load resume" }, { status: 500 });
    }

    return new Response(blob, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": 'inline; filename="resume.pdf"',
        "Content-Type": "application/pdf",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[api/resume]", error);
    return Response.json({ success: false, error: "Could not load resume" }, { status: 500 });
  }
}
