import Browserbase from "@browserbasehq/sdk";
import { Stagehand } from "@browserbasehq/stagehand";
import OpenAI from "openai";
import { z } from "zod";

import type { ProfileData } from "@/lib/profile";
import type { CompanyResearchDossier } from "@/types/company-research";

const dossierSchema = z.object({
  companyOverview: z.string().trim().min(1),
  techStack: z.array(z.string().trim().min(1)).min(1),
  culture: z.array(z.string().trim().min(1)).min(1),
  whyThisRole: z.string().trim().min(1),
  yourEdge: z.array(z.string().trim().min(1)).min(1),
  gapsToAddress: z.array(z.string().trim().min(1)).min(1),
  smartQuestions: z.array(z.string().trim().min(1)).min(1),
  interviewPrep: z.array(z.string().trim().min(1)).min(1),
  sources: z.array(z.string().trim().min(1)).min(1),
}).strict();

const dossierDraftSchema = z.object({
  companyOverview: z.string().optional(),
  techStack: z.array(z.string()).optional(),
  culture: z.array(z.string()).optional(),
  whyThisRole: z.string().optional(),
  yourEdge: z.array(z.string()).optional(),
  gapsToAddress: z.array(z.string()).optional(),
  smartQuestions: z.array(z.string()).optional(),
  interviewPrep: z.array(z.string()).optional(),
  sources: z.array(z.string()).optional(),
}).passthrough();

const homepageSchema = z.object({
  oneLiner: z.string().optional(),
  productSummary: z.string().optional(),
  signals: z.array(z.string()).optional(),
  pageLinks: z.array(z.object({
    url: z.string(),
    kind: z.enum(["about", "careers", "blog", "engineering", "product", "team", "other"]),
  })).optional(),
});

const subPageSchema = z.object({
  keyPoints: z.array(z.string()).optional(),
  technologies: z.array(z.string()).optional(),
  valuesOrCulture: z.array(z.string()).optional(),
  notable: z.array(z.string()).optional(),
});

type ResearchJob = {
  title: string;
  company: string;
  aboutRole: string;
  matchedSkills: string[];
  missingSkills: string[];
  sourceUrl: string;
};

type CompanyResearchResult =
  | { success: true; dossier: CompanyResearchDossier }
  | { success: false; error: string };

type ResearchMaterial = {
  homepage: z.infer<typeof homepageSchema>;
  subPages: Array<z.infer<typeof subPageSchema>>;
  sources: string[];
};

function safeErrorDetails(error: unknown): { name: string } {
  return { name: error instanceof Error ? error.name : "UnknownError" };
}

function validationDetails(error: unknown): { name: string; fields?: string[] } {
  if (!(error instanceof z.ZodError)) return safeErrorDetails(error);
  return { name: error.name, fields: error.issues.map((issue) => issue.path.join(".")).filter(Boolean) };
}

function companySlug(company: string): string {
  return company.toLowerCase().replace(/[^a-z0-9]+/g, "").trim();
}

function rootDomain(value: string): string | null {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol) || url.hostname.endsWith("adzuna.com")) return null;
    const parts = url.hostname.split(".").filter(Boolean);
    if (parts.length < 2) return null;
    return `https://${parts.slice(-2).join(".")}`;
  } catch {
    return null;
  }
}

async function resolveHomepage(job: ResearchJob): Promise<string> {
  try {
    const response = await fetch(job.sourceUrl, { redirect: "follow" });
    const followed = rootDomain(response.url);
    if (followed) return followed;
  } catch (error) {
    console.error("[agent/research:resolve-homepage]", safeErrorDetails(error));
  }

  return `https://www.${companySlug(job.company)}.com`;
}

function prioritizedLinks(links: Array<{ url: string; kind: string }>): string[] {
  const priority = ["about", "blog", "engineering", "product", "team", "careers", "other"];
  return links
    .filter((link) => {
      try {
        return /^https?:$/.test(new URL(link.url).protocol);
      } catch {
        return false;
      }
    })
    .sort((left, right) => priority.indexOf(left.kind) - priority.indexOf(right.kind))
    .map((link) => link.url)
    .slice(0, 3);
}

async function browseCompany(homepageUrl: string): Promise<ResearchMaterial> {
  const browserbase = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY });
  const session = await browserbase.sessions.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID,
    timeout: 120,
  });
  const stagehand = new Stagehand({
    env: "BROWSERBASE",
    apiKey: process.env.BROWSERBASE_API_KEY,
    projectId: process.env.BROWSERBASE_PROJECT_ID,
    browserbaseSessionID: session.id,
    model: { modelName: "openai/gpt-4o", apiKey: process.env.OPENAI_API_KEY },
    disablePino: true,
  });

  try {
    await stagehand.init();
    const page = stagehand.context.activePage();
    if (!page) throw new Error("Browser session did not provide an active page.");
    await page.goto(homepageUrl, { waitUntil: "domcontentloaded" });

    const homepage = await stagehand.extract(
      "This is a company's homepage. Capture what the company actually does, who it is for, and concrete signals such as funding, customers, scale, mission, or recent launches. Then find the internal links most worth visiting to research them as an employer.",
      homepageSchema,
    );

    const pageLinks = homepage.pageLinks ?? [];
    const subPages: Array<z.infer<typeof subPageSchema>> = [];
    for (const url of prioritizedLinks(pageLinks)) {
      try {
        await page.goto(url, { waitUntil: "domcontentloaded" });
        subPages.push(await stagehand.extract(
          "Extract substance that helps a candidate understand this company before applying: what they do, their values and how they work, specific technologies and tools, notable projects or customers, and how the team operates. Ignore navigation, footers, cookie banners, and generic marketing copy.",
          subPageSchema,
        ));
      } catch (error) {
        console.error("[agent/research:sub-page]", safeErrorDetails(error));
      }
    }

    return {
      homepage,
      subPages,
      sources: [homepageUrl, ...pageLinks.map((link) => link.url)],
    };
  } finally {
    await stagehand.close();
  }
}

function fallbackMaterial(): ResearchMaterial {
  return { homepage: {}, subPages: [], sources: [] };
}

function cleanList(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)));
}

function completeDossier(draft: z.infer<typeof dossierDraftSchema>, job: ResearchJob, profile: ProfileData, material: ResearchMaterial): CompanyResearchDossier {
  const skills = profile.skills.slice(0, 3).join(", ");
  const missingSkills = job.missingSkills.slice(0, 3).join(", ");
  const sources = cleanList(draft.sources).length > 0 ? cleanList(draft.sources) : cleanList(material.sources).concat(["Saved job posting"]);
  return dossierSchema.parse({
    companyOverview: draft.companyOverview?.trim() || `The available sources identify ${job.company} as the employer for this ${job.title} role, but provide limited company detail.`,
    techStack: cleanList(draft.techStack).length > 0 ? cleanList(draft.techStack) : ["Not identified from available sources."],
    culture: cleanList(draft.culture).length > 0 ? cleanList(draft.culture) : ["Not identified from available sources."],
    whyThisRole: draft.whyThisRole?.trim() || `This role is a ${job.title} opportunity at ${job.company}; use the saved posting to confirm the team's immediate needs.`,
    yourEdge: cleanList(draft.yourEdge).length > 0 ? cleanList(draft.yourEdge) : [skills ? `Your profile lists ${skills}; connect those skills to the responsibilities in the saved posting.` : "Use concrete examples from your work history that match the saved posting."],
    gapsToAddress: cleanList(draft.gapsToAddress).length > 0 ? cleanList(draft.gapsToAddress) : [missingSkills ? `Address the listed gap skills directly: ${missingSkills}.` : "No specific gap was identified from the available sources."],
    smartQuestions: cleanList(draft.smartQuestions).length > 0 ? cleanList(draft.smartQuestions) : ["What would success look like in the first 90 days for this role?"],
    interviewPrep: cleanList(draft.interviewPrep).length > 0 ? cleanList(draft.interviewPrep) : ["Prepare concise examples from your work history that match the responsibilities in the saved posting."],
    sources,
  });
}

async function synthesize(job: ResearchJob, profile: ProfileData, material: ResearchMaterial): Promise<CompanyResearchResult> {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 800,
      messages: [
        {
          role: "system",
          content: "You are a sharp career strategist preparing a candidate to apply for a specific role. Ground every company claim in the supplied research or job posting. Never invent funding, customers, headcount, or facts. If research is thin, say what is inferred. Connect the candidate's actual skills and work to this role. Turn missing skills into an honest strategy. Keep every item to one or two sentences. Return only valid JSON with exactly these fields: companyOverview string, techStack string array, culture string array, whyThisRole string, yourEdge string array, gapsToAddress string array, smartQuestions string array, interviewPrep string array, sources string array.",
        },
        {
          role: "user",
          content: JSON.stringify({
            companyResearch: material,
            job: job,
            profile: {
              currentTitle: profile.currentTitle,
              experienceLevel: profile.experienceLevel,
              yearsExperience: profile.yearsExperience,
              skills: profile.skills,
              workExperience: profile.workExperience,
            },
          }),
        },
      ],
    });

    const raw = response.choices[0]?.message.content;
    if (!raw) return { success: false, error: "Synthesis returned no content." };
    const parsed: unknown = JSON.parse(raw);
    const draft = dossierDraftSchema.parse(parsed);
    return { success: true, dossier: completeDossier(draft, job, profile, material) };
  } catch (error) {
    console.error("[agent/research:synthesis]", validationDetails(error));
    return { success: false, error: "Research synthesis failed." };
  }
}

export async function researchCompany(job: ResearchJob, profile: ProfileData): Promise<CompanyResearchResult> {
  try {
    const homepageUrl = await resolveHomepage(job);
    let material = fallbackMaterial();
    try {
      material = await browseCompany(homepageUrl);
      const productSummary = material.homepage.productSummary?.trim().toLowerCase() ?? "";
      const hasMeaningfulHomepage = Boolean(material.homepage.oneLiner?.trim() || (productSummary && !productSummary.startsWith("unable to access")));
      if (!hasMeaningfulHomepage) material = fallbackMaterial();
    } catch (error) {
      console.error("[agent/research:browse]", safeErrorDetails(error));
    }
    return await synthesize(job, profile, material);
  } catch (error) {
    console.error("[agent/research]", safeErrorDetails(error));
    return { success: false, error: "Company research failed." };
  }
}

export type { ResearchJob, CompanyResearchResult };
