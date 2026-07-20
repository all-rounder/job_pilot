export type WorkExperience = {
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  currentRole: boolean;
  responsibilities: string;
};

export type Education = {
  degree: string;
  fieldOfStudy: string;
  institution: string;
  graduationYear: string;
};

export type ProfileData = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  linkedIn: string;
  portfolio: string;
  authorization: string;
  currentTitle: string;
  experienceLevel: string;
  yearsExperience: string;
  skills: string[];
  industries: string[];
  workExperience: WorkExperience[];
  education: Education;
  jobTitles: string[];
  remotePreference: string;
  salary: string;
  preferredLocations: string[];
  coverLetterTone: string;
  resumeKey: string | null;
};

export type ExtractedEducation = Partial<Education>;

export type ExtractedWorkExperience = Partial<WorkExperience>;

export type ExtractedProfile = {
  fullName?: string;
  phone?: string;
  location?: string;
  linkedIn?: string;
  portfolio?: string;
  currentTitle?: string;
  experienceLevel?: "junior" | "mid" | "senior" | "lead";
  yearsExperience?: string;
  skills?: string[];
  industries?: string[];
  workExperience?: ExtractedWorkExperience[];
  education?: ExtractedEducation;
};

export type ProfileCompletion = {
  percentage: number;
  missingFields: string[];
  isComplete: boolean;
};

export type ProfileActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors: Record<string, string>;
  savedProfile?: ProfileData;
  completion?: ProfileCompletion;
};

export const initialProfileActionState: ProfileActionState = {
  status: "idle",
  message: "",
  fieldErrors: {},
};

const emptyEducation: Education = {
  degree: "",
  fieldOfStudy: "",
  institution: "",
  graduationYear: "",
};

export function createEmptyProfile(email: string): ProfileData {
  return {
    fullName: "",
    email,
    phone: "",
    location: "",
    linkedIn: "",
    portfolio: "",
    authorization: "",
    currentTitle: "",
    experienceLevel: "",
    yearsExperience: "",
    skills: [],
    industries: [],
    workExperience: [],
    education: emptyEducation,
    jobTitles: [],
    remotePreference: "",
    salary: "",
    preferredLocations: [],
    coverLetterTone: "",
    resumeKey: null,
  };
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function recordValue(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function profileFromRow(row: Record<string, unknown> | null, email: string): ProfileData {
  if (!row) return createEmptyProfile(email);

  const education = recordValue(row.education);
  const roles = Array.isArray(row.work_experience) ? row.work_experience : [];

  return {
    fullName: stringValue(row.full_name),
    email,
    phone: stringValue(row.phone),
    location: stringValue(row.location),
    linkedIn: stringValue(row.linkedin_url),
    portfolio: stringValue(row.portfolio_url),
    authorization: stringValue(row.work_authorization),
    currentTitle: stringValue(row.current_title),
    experienceLevel: stringValue(row.experience_level),
    yearsExperience: row.years_experience === null || row.years_experience === undefined
      ? ""
      : String(row.years_experience),
    skills: stringArray(row.skills),
    industries: stringArray(row.industries),
    workExperience: roles.slice(0, 3).map((value) => {
      const role = recordValue(value);
      return {
        company: stringValue(role.company),
        title: stringValue(role.title),
        startDate: stringValue(role.start_date),
        endDate: stringValue(role.end_date),
        currentRole: role.current_role === true,
        responsibilities: stringValue(role.responsibilities),
      };
    }),
    education: {
      degree: stringValue(education.degree),
      fieldOfStudy: stringValue(education.field_of_study),
      institution: stringValue(education.institution),
      graduationYear: stringValue(education.graduation_year),
    },
    jobTitles: stringArray(row.job_titles_seeking),
    remotePreference: stringValue(row.remote_preference),
    salary: stringValue(row.salary_expectation),
    preferredLocations: stringArray(row.preferred_locations),
    coverLetterTone: stringValue(row.cover_letter_tone),
    resumeKey: stringValue(row.resume_pdf_url) || null,
  };
}

function hasText(value: string): boolean {
  return value.trim().length > 0;
}

function validRole(role: WorkExperience): boolean {
  return hasText(role.company)
    && hasText(role.title)
    && hasText(role.startDate)
    && (role.currentRole || hasText(role.endDate))
    && hasText(role.responsibilities);
}

export function getProfileCompletion(profile: ProfileData): ProfileCompletion {
  const requirements = [
    ["Full name", hasText(profile.fullName)],
    ["Email", hasText(profile.email)],
    ["Phone", hasText(profile.phone)],
    ["Location", hasText(profile.location)],
    ["Current title", hasText(profile.currentTitle)],
    ["Experience level", hasText(profile.experienceLevel)],
    ["Years of experience", /^\d+$/.test(profile.yearsExperience)],
    ["Skills", profile.skills.some(hasText)],
    ["Work experience", profile.workExperience.some(validRole)],
    ["Education", Object.values(profile.education).every(hasText)],
    ["Job titles seeking", profile.jobTitles.some(hasText)],
    ["Remote preference", hasText(profile.remotePreference)],
    ["Work authorization", hasText(profile.authorization)],
  ] as const;
  const missingFields = requirements.filter(([, complete]) => !complete).map(([label]) => label);
  const completed = requirements.length - missingFields.length;

  return {
    percentage: Math.round((completed / requirements.length) * 100),
    missingFields,
    isComplete: missingFields.length === 0,
  };
}

function parseJsonArray<T>(formData: FormData, name: string): T[] {
  const raw = formData.get(name);
  if (typeof raw !== "string") return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value as T[] : [];
  } catch {
    return [];
  }
}

export function profileFromFormData(formData: FormData, email: string): ProfileData {
  const education: Education = {
    degree: stringValue(formData.get("degree")),
    fieldOfStudy: stringValue(formData.get("fieldOfStudy")),
    institution: stringValue(formData.get("institution")),
    graduationYear: stringValue(formData.get("graduationYear")),
  };

  return {
    fullName: stringValue(formData.get("fullName")),
    email,
    phone: stringValue(formData.get("phone")),
    location: stringValue(formData.get("location")),
    linkedIn: stringValue(formData.get("linkedIn")),
    portfolio: stringValue(formData.get("portfolio")),
    authorization: stringValue(formData.get("authorization")),
    currentTitle: stringValue(formData.get("currentTitle")),
    experienceLevel: stringValue(formData.get("experienceLevel")),
    yearsExperience: stringValue(formData.get("yearsExperience")),
    skills: parseJsonArray<string>(formData, "skillsJson"),
    industries: parseJsonArray<string>(formData, "industriesJson"),
    workExperience: parseJsonArray<WorkExperience>(formData, "workExperienceJson").slice(0, 3),
    education,
    jobTitles: parseJsonArray<string>(formData, "jobTitlesJson"),
    remotePreference: stringValue(formData.get("remotePreference")),
    salary: stringValue(formData.get("salary")),
    preferredLocations: parseJsonArray<string>(formData, "preferredLocationsJson"),
    coverLetterTone: stringValue(formData.get("coverLetterTone")),
    resumeKey: null,
  };
}

function cleanList(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function optionalUrlError(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol !== "http:" && url.protocol !== "https:";
  } catch {
    return true;
  }
}

export function validateProfile(profile: ProfileData): { data?: ProfileData; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const years = Number(profile.yearsExperience);

  if (profile.yearsExperience && (!Number.isInteger(years) || years < 0 || years > 80)) {
    errors.yearsExperience = "Enter a whole number from 0 to 80.";
  }
  if (optionalUrlError(profile.linkedIn)) errors.linkedIn = "Enter a valid web address.";
  if (optionalUrlError(profile.portfolio)) errors.portfolio = "Enter a valid web address.";
  if (profile.workExperience.length > 3) errors.workExperience = "Add no more than three roles.";

  const data: ProfileData = {
    ...profile,
    fullName: profile.fullName.trim(),
    phone: profile.phone.trim(),
    location: profile.location.trim(),
    linkedIn: profile.linkedIn.trim(),
    portfolio: profile.portfolio.trim(),
    currentTitle: profile.currentTitle.trim(),
    yearsExperience: profile.yearsExperience.trim(),
    skills: cleanList(profile.skills),
    industries: cleanList(profile.industries),
    jobTitles: cleanList(profile.jobTitles),
    preferredLocations: cleanList(profile.preferredLocations),
    salary: profile.salary.trim(),
    workExperience: profile.workExperience.map((role) => ({
      ...role,
      company: role.company.trim(),
      title: role.title.trim(),
      startDate: role.startDate.trim(),
      endDate: role.currentRole ? "" : role.endDate.trim(),
      responsibilities: role.responsibilities.trim(),
    })),
  };

  return Object.keys(errors).length > 0 ? { errors } : { data, errors };
}

export function profileToDatabase(profile: ProfileData): Record<string, unknown> {
  const completion = getProfileCompletion(profile);
  return {
    email: profile.email,
    full_name: profile.fullName,
    phone: profile.phone,
    location: profile.location,
    current_title: profile.currentTitle,
    experience_level: profile.experienceLevel || null,
    years_experience: profile.yearsExperience === "" ? null : Number(profile.yearsExperience),
    skills: profile.skills,
    industries: profile.industries,
    work_experience: profile.workExperience.map((role) => ({
      company: role.company,
      title: role.title,
      start_date: role.startDate,
      end_date: role.endDate || null,
      current_role: role.currentRole,
      responsibilities: role.responsibilities,
    })),
    education: Object.values(profile.education).some(hasText) ? {
      degree: profile.education.degree,
      field_of_study: profile.education.fieldOfStudy,
      institution: profile.education.institution,
      graduation_year: profile.education.graduationYear,
    } : null,
    job_titles_seeking: profile.jobTitles,
    remote_preference: profile.remotePreference || null,
    preferred_locations: profile.preferredLocations,
    salary_expectation: profile.salary,
    cover_letter_tone: profile.coverLetterTone || null,
    linkedin_url: profile.linkedIn,
    portfolio_url: profile.portfolio,
    work_authorization: profile.authorization || null,
    is_complete: completion.isComplete,
  };
}

export function isOwnedResumeKey(key: string, userId: string): boolean {
  const fixedKey = `${userId}/resume.pdf`;
  const legacyPrefix = `${userId}/resume-`;

  return key === fixedKey
    || (key.startsWith(legacyPrefix) && key.endsWith(".pdf") && !key.slice(userId.length + 1).includes("/"));
}
