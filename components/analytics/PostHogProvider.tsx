"use client";

import { PostHogProvider as Provider } from "posthog-js/react";

import { posthog } from "@/lib/posthog-client";

type PostHogProviderProps = Readonly<{
  children: React.ReactNode;
}>;

export function PostHogProvider({ children }: PostHogProviderProps) {
  return <Provider client={posthog}>{children}</Provider>;
}
