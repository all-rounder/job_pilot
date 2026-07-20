import {
  Document,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { PDFParse } from "pdf-parse";
import { z } from "zod";

import type { ProfileData, WorkExperience } from "@/lib/profile";

const MAX_SUMMARY_WORDS = 80;
const MAX_BULLET_WORDS = 24;
const MAX_SKILLS = 12;

const generatedResumeSchema = z.object({
  summary: z.string().trim().min(1),
  roles: z.array(z.object({
    roleIndex: z.number().int().min(0).max(2),
    bullets: z.array(z.string().trim().min(1)).min(2).max(3),
  }).strict()).max(3),
}).strict();

export type GeneratedResumeContent = z.infer<typeof generatedResumeSchema>;

export class ResumeGenerationError extends Error {
  constructor(
    message: string,
    readonly stage: "openai" | "validation" | "render",
  ) {
    super(message);
    this.name = "ResumeGenerationError";
  }
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function validateGeneratedContent(
  content: GeneratedResumeContent,
  profile: ProfileData,
): GeneratedResumeContent {
  if (wordCount(content.summary) > MAX_SUMMARY_WORDS) {
    throw new ResumeGenerationError("Generated summary exceeded its limit", "validation");
  }

  const seen = new Set<number>();
  for (const role of content.roles) {
    if (role.roleIndex >= profile.workExperience.length || seen.has(role.roleIndex)) {
      throw new ResumeGenerationError("Generated roles did not match the profile", "validation");
    }
    seen.add(role.roleIndex);
    if (role.bullets.some((bullet) => wordCount(bullet) > MAX_BULLET_WORDS)) {
      throw new ResumeGenerationError("Generated bullet exceeded its limit", "validation");
    }
  }

  return content;
}

function profilePrompt(profile: ProfileData): string {
  return JSON.stringify({
    currentTitle: profile.currentTitle,
    experienceLevel: profile.experienceLevel,
    yearsExperience: profile.yearsExperience,
    skills: profile.skills,
    industries: profile.industries,
    workExperience: profile.workExperience.slice(0, 3).map((role, roleIndex) => ({
      roleIndex,
      company: role.company,
      title: role.title,
      startDate: role.startDate,
      endDate: role.currentRole ? null : role.endDate,
      currentRole: role.currentRole,
      responsibilities: role.responsibilities,
    })),
    education: profile.education,
  });
}

export async function generateResumeContent(profile: ProfileData): Promise<GeneratedResumeContent> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new ResumeGenerationError("OpenAI is not configured", "openai");

  try {
    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.parse({
      model: "gpt-4o",
      response_format: zodResponseFormat(generatedResumeSchema, "generated_resume_content"),
      temperature: 0.3,
      max_tokens: 900,
      messages: [
        {
          role: "system",
          content: [
            "Write concise professional resume prose using only the supplied profile facts.",
            `The summary must be one paragraph with at most ${MAX_SUMMARY_WORDS} words.`,
            `Return two or three bullets per supplied role, each at most ${MAX_BULLET_WORDS} words.`,
            "Keep each roleIndex exactly as supplied.",
            "Polish stated responsibilities, but never invent achievements, metrics, employers, dates, qualifications, skills, or tools.",
            "Follow the supplied response schema exactly.",
          ].join(" "),
        },
        { role: "user", content: profilePrompt(profile) },
      ],
    });
    const parsed = response.choices[0]?.message.parsed;
    if (!parsed) throw new ResumeGenerationError("OpenAI returned no structured resume", "openai");
    return validateGeneratedContent(parsed, profile);
  } catch (error) {
    if (error instanceof ResumeGenerationError) throw error;
    throw new ResumeGenerationError("Resume content generation failed", "openai");
  }
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: "white",
    color: "black",
    fontFamily: "Helvetica",
    fontSize: 9,
    lineHeight: 1.35,
    paddingHorizontal: 38,
    paddingVertical: 32,
  },
  header: { borderBottomColor: "steelblue", borderBottomWidth: 2, paddingBottom: 10 },
  name: { fontFamily: "Helvetica-Bold", fontSize: 22, letterSpacing: 0.4, lineHeight: 1.1 },
  title: { color: "steelblue", fontFamily: "Helvetica-Bold", fontSize: 11, marginTop: 7 },
  contact: { color: "dimgray", flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  section: { marginTop: 11 },
  sectionTitle: {
    color: "steelblue",
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    letterSpacing: 1.1,
    marginBottom: 5,
    textTransform: "uppercase",
  },
  summary: { color: "dimgray" },
  skills: { color: "dimgray" },
  role: { marginBottom: 7 },
  roleHeader: { flexDirection: "row", justifyContent: "space-between" },
  roleTitle: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  roleDates: { color: "dimgray", fontSize: 8 },
  company: { color: "steelblue", fontFamily: "Helvetica-Bold", marginTop: 1 },
  bulletRow: { flexDirection: "row", marginTop: 2, paddingLeft: 3 },
  bulletMark: { width: 9 },
  bulletText: { color: "dimgray", flex: 1 },
  educationRow: { flexDirection: "row", justifyContent: "space-between" },
  educationTitle: { fontFamily: "Helvetica-Bold" },
  link: { color: "steelblue", textDecoration: "none" },
});

function roleDates(role: WorkExperience): string {
  return `${role.startDate} to ${role.currentRole ? "Present" : role.endDate}`;
}

function ResumeDocument({ profile, content }: { profile: ProfileData; content: GeneratedResumeContent }) {
  const contact = [profile.email, profile.phone, profile.location].filter(Boolean);
  const links = [
    profile.linkedIn ? { label: "LinkedIn", href: profile.linkedIn } : null,
    profile.portfolio ? { label: "Portfolio", href: profile.portfolio } : null,
  ].filter((value): value is { label: string; href: string } => value !== null);

  return (
    <Document title={`${profile.fullName} Resume`} author={profile.fullName}>
      <Page size="A4" style={styles.page} wrap={false}>
        <View style={styles.header}>
          <Text style={styles.name}>{profile.fullName}</Text>
          <Text style={styles.title}>{profile.currentTitle}</Text>
          <View style={styles.contact}>
            {contact.map((item) => <Text key={item}>{item}</Text>)}
            {links.map((item) => <Link key={item.href} src={item.href} style={styles.link}>{item.label}</Link>)}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Professional Summary</Text>
          <Text style={styles.summary}>{content.summary}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Skills</Text>
          <Text style={styles.skills}>{profile.skills.slice(0, MAX_SKILLS).join("  •  ")}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Experience</Text>
          {content.roles.map((generatedRole) => {
            const role = profile.workExperience[generatedRole.roleIndex];
            return (
              <View key={generatedRole.roleIndex} style={styles.role} wrap={false}>
                <View style={styles.roleHeader}>
                  <Text style={styles.roleTitle}>{role.title}</Text>
                  <Text style={styles.roleDates}>{roleDates(role)}</Text>
                </View>
                <Text style={styles.company}>{role.company}</Text>
                {generatedRole.bullets.map((bullet) => (
                  <View key={bullet} style={styles.bulletRow}>
                    <Text style={styles.bulletMark}>•</Text>
                    <Text style={styles.bulletText}>{bullet}</Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Education</Text>
          <View style={styles.educationRow}>
            <View>
              <Text style={styles.educationTitle}>{profile.education.degree} in {profile.education.fieldOfStudy}</Text>
              <Text style={styles.summary}>{profile.education.institution}</Text>
            </View>
            <Text style={styles.roleDates}>{profile.education.graduationYear}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

export async function renderResumePdf(
  profile: ProfileData,
  content: GeneratedResumeContent,
): Promise<Buffer> {
  try {
    const buffer = await renderToBuffer(<ResumeDocument profile={profile} content={content} />);
    if (buffer.length < 5 || buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new ResumeGenerationError("Rendered document was not a PDF", "render");
    }

    const parser = new PDFParse({ data: buffer });
    try {
      const info = await parser.getInfo();
      if (info.total !== 1) {
        throw new ResumeGenerationError("Rendered resume was not one page", "render");
      }
    } finally {
      await parser.destroy();
    }
    return buffer;
  } catch (error) {
    if (error instanceof ResumeGenerationError) throw error;
    throw new ResumeGenerationError("Resume PDF rendering failed", "render");
  }
}
