import { z } from "zod";

const optionalText = z.string().trim().min(1).optional();

export const extractedProfileResponseSchema = z.object({
  fullName: optionalText,
  phone: optionalText,
  location: optionalText,
  linkedIn: z.string().url().optional(),
  portfolio: z.string().url().optional(),
  currentTitle: optionalText,
  experienceLevel: z.enum(["junior", "mid", "senior", "lead"]).optional(),
  yearsExperience: z.string().regex(/^\d+$/).optional(),
  skills: z.array(z.string().trim().min(1)).optional(),
  industries: z.array(z.string().trim().min(1)).optional(),
  workExperience: z.array(z.object({
    company: optionalText,
    title: optionalText,
    startDate: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
    endDate: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
    currentRole: z.boolean().optional(),
    responsibilities: optionalText,
  }).strict()).max(3).optional(),
  education: z.object({
    degree: optionalText,
    fieldOfStudy: optionalText,
    institution: optionalText,
    graduationYear: z.string().regex(/^\d{4}$/).optional(),
  }).strict().optional(),
}).strict();
