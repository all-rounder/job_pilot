import Image from "next/image";
import Link from "next/link";

export function Navbar() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center justify-between px-4 sm:px-8 lg:px-16">
        <Link
          href="/"
          aria-label="JobPilot home"
          className="rounded-md focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          <Image src="/logo.png" alt="JobPilot" width={118} height={40} className="h-8 w-auto" priority />
        </Link>
        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-10 text-sm font-medium text-text-dark">
            <li><Link className="rounded-md px-1 py-3 hover:text-accent focus-visible:ring-2 focus-visible:ring-accent" href="/dashboard">Dashboard</Link></li>
            <li><Link className="rounded-md px-1 py-3 hover:text-accent focus-visible:ring-2 focus-visible:ring-accent" href="/find-jobs">Find Jobs</Link></li>
            <li><Link className="rounded-md px-1 py-3 hover:text-accent focus-visible:ring-2 focus-visible:ring-accent" href="/profile">Profile</Link></li>
          </ul>
        </nav>
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center justify-center rounded-md bg-overlay px-4 text-sm font-medium text-surface transition-colors hover:bg-overlay-dark focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          Start for free
        </Link>
      </div>
    </header>
  );
}
