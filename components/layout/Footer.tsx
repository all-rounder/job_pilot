import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-surface">
      <div className="section-divider mx-auto h-16 max-w-[1312px] border-x border-border" aria-hidden="true" />
      <div className="mx-auto flex min-h-32 max-w-[1440px] flex-col items-center justify-between gap-6 border-t border-border px-4 py-8 sm:px-8 md:flex-row lg:px-16">
        <Link href="/" aria-label="JobPilot home" className="rounded-md focus-visible:ring-2 focus-visible:ring-accent"><Image src="/logo.png" alt="JobPilot" width={118} height={40} className="h-8 w-auto" /></Link>
        <nav aria-label="Footer"><ul className="flex flex-wrap justify-center gap-7 text-sm text-text-dark">
          <li><Link className="hover:text-accent focus-visible:ring-2 focus-visible:ring-accent" href="/dashboard">Dashboard</Link></li>
          <li><Link className="hover:text-accent focus-visible:ring-2 focus-visible:ring-accent" href="/privacy">Privacy Policy</Link></li>
          <li><Link className="hover:text-accent focus-visible:ring-2 focus-visible:ring-accent" href="/terms">Terms &amp; Condition</Link></li>
        </ul></nav>
      </div>
    </footer>
  );
}
