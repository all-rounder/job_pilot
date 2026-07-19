"use client";

import { useEffect } from "react";

import { posthog } from "@/lib/posthog-client";

type PostHogIdentifyProps = Readonly<{
  userId: string;
}>;

export function PostHogIdentify({ userId }: PostHogIdentifyProps) {
  useEffect(() => {
    posthog.identify(userId);
  }, [userId]);

  return null;
}
