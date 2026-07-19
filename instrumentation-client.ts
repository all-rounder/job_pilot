import { initPostHog } from "@/lib/posthog-client";

try {
  initPostHog();
} catch (error: unknown) {
  console.error("[instrumentation-client] Failed to initialize PostHog", error);
}
