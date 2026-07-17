import { Features } from "@/components/homepage/Features";
import { Hero } from "@/components/homepage/Hero";
import { Testimonial } from "@/components/homepage/Testimonial";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-surface text-text-primary">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-surface px-4 py-3 text-sm font-semibold text-text-primary focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:ring-2 focus:ring-accent focus:ring-offset-2"
      >
        Skip to main content
      </a>
      <Navbar />
      <main id="main-content" className="mx-auto w-full max-w-[1440px] px-4 sm:px-8 lg:px-16">
        <div className="border-x border-border">
          <Hero />
          <Features />
          <Testimonial />
        </div>
      </main>
      <Footer />
    </div>
  );
}
