"use server";

import { createAuthActions } from "@insforge/sdk/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const PKCE_COOKIE = "insforge_code_verifier";

type OAuthProvider = "google" | "github";

function getCallbackUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  if (!appUrl) {
    return null;
  }

  return new URL("/api/auth/callback", appUrl).toString();
}

async function beginOAuth(provider: OAuthProvider) {
  const callbackUrl = getCallbackUrl();

  if (!callbackUrl) {
    redirect("/login?error=configuration");
  }

  const cookieStore = await cookies();
  const auth = createAuthActions({ cookies: cookieStore });
  const { data, error } = await auth.signInWithOAuth(provider, {
    redirectTo: callbackUrl,
    skipBrowserRedirect: true,
  });

  if (error || !data.url || !data.codeVerifier) {
    redirect("/login?error=oauth_start");
  }

  cookieStore.set(PKCE_COOKIE, data.codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  redirect(data.url);
}

export async function signInWithGoogle() {
  await beginOAuth("google");
}

export async function signInWithGitHub() {
  await beginOAuth("github");
}

export async function signOut() {
  const cookieStore = await cookies();
  const auth = createAuthActions({ cookies: cookieStore });
  await auth.signOut();
  redirect("/login");
}
