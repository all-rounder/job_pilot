import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { PDFParse } from "pdf-parse";
import { z } from "zod";

import type { ExtractedProfile, ExtractedWorkExperience } from "@/lib/profile";
import { extractedProfileResponseSchema } from "@/lib/profile-extraction";

const MIN_RESUME_CHARACTERS = 100;

const nullableText = z.string().trim().min(1).nullable();
const workExperienceSchema = z.object({
  company: nullableText,
  title: nullableText,
  startDate: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable(),
  endDate: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).nullable(),
  currentRole: z.boolean().nullable(),
  responsibilities: nullableText,
}).strict();

const extractedProfileSchema = z.object({
  fullName: nullableText,
  phone: nullableText,
  location: nullableText,
  linkedIn: nullableText,
  portfolio: nullableText,
  currentTitle: nullableText,
  experienceLevel: z.enum(["junior", "mid", "senior", "lead"]).nullable(),
  yearsExperience: z.number().int().min(0).max(80).nullable(),
  skills: z.array(z.string().trim().min(1)).nullable(),
  industries: z.array(z.string().trim().min(1)).nullable(),
  workExperience: z.array(workExperienceSchema).nullable(),
  education: z.object({
    degree: nullableText,
    fieldOfStudy: nullableText,
    institution: nullableText,
    graduationYear: z.string().regex(/^\d{4}$/).nullable(),
  }).strict().nullable(),
}).strict();

type ResumeTextErrorReason = "insufficient_text" | "parse_failed";

export class ResumeTextError extends Error {
  constructor(
    message: string,
    readonly reason: ResumeTextErrorReason,
    readonly parserErrorName?: string,
    readonly parserErrorMessage?: string,
  ) {
    super(message);
    this.name = "ResumeTextError";
  }
}
export class ResumeExtractionError extends Error {}

function uniqueValues(values: string[] | null | undefined): string[] | undefined {
  if (!values) return undefined;
  const unique = Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
  return unique.length > 0 ? unique : undefined;
}

function roleTimestamp(role: ExtractedWorkExperience): number {
  if (!role.startDate) return 0;
  const timestamp = Date.parse(`${role.startDate}-01T00:00:00Z`);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function normalizeRoles(
  roles: z.infer<typeof workExperienceSchema>[] | null | undefined,
): ExtractedWorkExperience[] | undefined {
  if (!roles) return undefined;
  const normalized = roles
    .map((role, index) => ({
      role: {
        ...(role.company ? { company: role.company } : {}),
        ...(role.title ? { title: role.title } : {}),
        ...(role.startDate ? { startDate: role.startDate } : {}),
        ...(role.currentRole === null ? {} : { currentRole: role.currentRole }),
        ...(role.responsibilities ? { responsibilities: role.responsibilities } : {}),
        ...(!role.currentRole && role.endDate ? { endDate: role.endDate } : {}),
      },
      index,
    }))
    .sort((left, right) => {
      if (left.role.currentRole !== right.role.currentRole) return left.role.currentRole ? -1 : 1;
      return roleTimestamp(right.role) - roleTimestamp(left.role) || left.index - right.index;
    })
    .slice(0, 3)
    .map(({ role }) => role);
  return normalized.length > 0 ? normalized : undefined;
}

export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    const text = result.text.trim();
    if (text.replace(/\s/g, "").length < MIN_RESUME_CHARACTERS) {
      throw new ResumeTextError(
        "Could not extract text from this PDF. Please try a different file.",
        "insufficient_text",
      );
    }
    return text;
  } catch (error) {
    if (error instanceof ResumeTextError) throw error;
    throw new ResumeTextError(
      "Could not extract text from this PDF. Please try a different file.",
      "parse_failed",
      error instanceof Error ? error.name : "UnknownError",
      error instanceof Error ? error.message.slice(0, 300) : undefined,
    );
  } finally {
    await parser.destroy();
  }
}

export async function extractProfileFromText(text: string): Promise<ExtractedProfile> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new ResumeExtractionError("OpenAI is not configured");

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.parse({
      model: "gpt-4o",
      response_format: zodResponseFormat(extractedProfileSchema, "resume_profile"),
      temperature: 0.3,
      max_tokens: 1200,
      messages: [
        {
          role: "system",
          content: [
            "Extract only facts stated in this resume into JSON.",
            "Use null for every missing, uncertain, inferred, or empty value.",
            "Use only these top-level keys: fullName, phone, location, linkedIn, portfolio, currentTitle, experienceLevel, yearsExperience, skills, industries, workExperience, education.",
            "experienceLevel must be junior, mid, senior, or lead. yearsExperience must be an integer from 0 to 80.",
            "Work dates use YYYY-MM. Graduation year uses YYYY. Do not return email, work authorization, or job preferences.",
            "Follow the supplied response schema exactly.",
          ].join(" "),
        },
        { role: "user", content: text },
      ],
    });
    const parsed = response.choices[0]?.message.parsed;
    if (!parsed) throw new ResumeExtractionError("OpenAI returned no structured extraction");

    const {
      yearsExperience,
      skills,
      industries,
      workExperience,
      education,
      ...values
    } = parsed;
    const normalizedSkills = uniqueValues(skills);
    const normalizedIndustries = uniqueValues(industries);
    const normalizedWorkExperience = normalizeRoles(workExperience);
    const normalized = {
      ...Object.fromEntries(Object.entries(values).filter(([, value]) => value !== null)),
      ...(yearsExperience === null ? {} : { yearsExperience: String(yearsExperience) }),
      ...(normalizedSkills ? { skills: normalizedSkills } : {}),
      ...(normalizedIndustries ? { industries: normalizedIndustries } : {}),
      ...(normalizedWorkExperience ? { workExperience: normalizedWorkExperience } : {}),
      ...(education
        ? { education: Object.fromEntries(Object.entries(education).filter(([, value]) => value !== null)) }
        : {}),
    };
    return extractedProfileResponseSchema.parse(normalized);
  } catch (error) {
    if (error instanceof ResumeExtractionError) throw error;
    throw new ResumeExtractionError("Resume extraction failed");
  }
}
