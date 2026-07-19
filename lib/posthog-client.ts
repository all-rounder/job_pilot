import posthog from "posthog-js";

let isInitialized = false;

export function initPostHog(): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (isInitialized || typeof window === "undefined" || !key || !host) {
    return;
  }

  posthog.init(key, {
    api_host: host,
    capture_pageview: false,
  });
  isInitialized = true;
}

export { posthog };
