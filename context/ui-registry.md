# UI Registry

Living document. Updated after every component is built. Read this before building any new component — match existing patterns exactly before inventing new ones.

---

## How to Use

Before building any component:

1. Check if a similar component already exists here
2. If yes — match its exact classes
3. If no — build it following ui-rules.md and ui-tokens.md, then add it here

After building any component — update this file with the component name, file path, and exact classes used.

---

## Components

### Homepage shell

- `components/layout/Navbar.tsx`: 64px token based header, responsive primary navigation and CTA
- `components/layout/Footer.tsx`: bordered surface with responsive brand and footer links
- `components/homepage/Hero.tsx`: gradient hero, paired CTAs, framed dashboard preview
- `components/homepage/Features.tsx`: alternating two column feature panels and supplied product imagery
- `components/homepage/Testimonial.tsx`: success story and gradient closing CTA
