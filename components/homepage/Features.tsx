import Image from "next/image";

const searchFeatures = [
  { title: "Find jobs that actually fit", body: "Search by title and location or paste a job link. Get matched roles you can quickly scan." },
  { title: "Know the Company Before You Apply", body: "Stop guessing what a company is about. JobPilot browses their site and gives you everything you need to apply with confidence." },
  { title: "Keep track of every application", body: "Keep a clear view of every job you’ve found, tailored. Your activity and progress all stay in one simple place." },
];

const matchFeatures = [
  { title: "Understand your match score", body: "See how your profile lines up with each role before you apply. Get a clear breakdown of what fits and what’s missing." },
  { title: "AI-Powered Job Matching", body: "Stop guessing which jobs are worth applying to. JobPilot scores every role against your actual skills so you focus on the ones that matter." },
  { title: "Focus on the right roles", body: "Filter out low fit jobs and stay on the ones that actually matter. Spend less time sorting and more time applying." },
];

type FeatureListProps = { items: typeof searchFeatures; accentIndex: number };

function FeatureList({ items, accentIndex }: FeatureListProps) {
  return (
    <ul className="divide-y divide-border border-y border-border">
      {items.map((item, index) => (
        <li key={item.title} className={`px-7 py-7 ${index === accentIndex ? "border-s-2 border-accent" : "border-s-2 border-transparent"}`}>
          <h3 className="text-base font-semibold text-text-darker">{item.title}</h3>
          <p className="mt-2 text-base leading-7 text-text-secondary">{item.body}</p>
        </li>
      ))}
    </ul>
  );
}

export function Features() {
  return (
    <section aria-label="JobPilot features" className="border-t border-border">
      <div className="grid lg:grid-cols-2">
        <div className="flex flex-col justify-center bg-surface">
          <h2 className="px-7 py-12 text-4xl font-semibold tracking-tight text-text-slate sm:px-12 lg:px-16 lg:text-5xl">Manage Your Job<br />Search With Ease</h2>
          <FeatureList items={searchFeatures} accentIndex={0} />
        </div>
        <div className="flex items-center bg-surface-muted p-7 sm:p-12 lg:p-16"><Image src="/images/jobs-lists.png" alt="JobPilot job list with company, match score, salary, and source columns" width={591} height={445} className="h-auto w-full rounded-xl" /></div>
      </div>
      <div className="section-divider h-16 border-y border-border" aria-hidden="true" />
      <div className="grid lg:grid-cols-2">
        <div className="order-2 flex items-center bg-surface-muted p-7 sm:p-12 lg:order-1 lg:p-16"><Image src="/images/agnet-log.png" alt="JobPilot agent log showing job discovery, filtering, and application preparation steps" width={536} height={414} className="h-auto w-full rounded-xl" /></div>
        <div className="order-1 flex flex-col justify-center bg-surface lg:order-2">
          <h2 className="px-7 py-12 text-4xl font-semibold tracking-tight text-text-slate sm:px-12 lg:px-16 lg:text-5xl">Apply With More<br />Confidence, Every Time</h2>
          <FeatureList items={matchFeatures} accentIndex={1} />
        </div>
      </div>
    </section>
  );
}
