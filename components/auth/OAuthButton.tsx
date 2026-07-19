"use client";

import { useFormStatus } from "react-dom";

interface OAuthButtonProps {
  provider: "Google" | "GitHub";
}

export function OAuthButton({ provider }: OAuthButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-12 w-full items-center justify-center gap-3 rounded-lg border border-border bg-surface px-5 text-sm font-semibold text-text-primary shadow-sm transition-colors hover:border-accent hover:bg-accent-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span
        aria-hidden="true"
        className="flex size-7 items-center justify-center rounded-full bg-surface-tertiary text-xs font-bold text-text-dark"
      >
        {provider === "Google" ? "G" : "GH"}
      </span>
      <span>{pending ? `Connecting to ${provider}...` : `Continue with ${provider}`}</span>
    </button>
  );
}
