import { createAuthActions } from "@insforge/sdk/ssr";
import { type NextRequest, NextResponse } from "next/server";

const PKCE_COOKIE = "insforge_code_verifier";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("insforge_code");
  const verifier = request.cookies.get(PKCE_COOKIE)?.value;
  const response = NextResponse.redirect(new URL("/dashboard", request.url));

  if (!code || !verifier) {
    const errorResponse = NextResponse.redirect(
      new URL("/login?error=oauth_callback", request.url),
    );
    errorResponse.cookies.delete(PKCE_COOKIE);
    return errorResponse;
  }

  const auth = createAuthActions({
    requestCookies: request.cookies,
    responseCookies: response.cookies,
  });
  const { error } = await auth.exchangeOAuthCode(code, verifier);

  response.cookies.delete(PKCE_COOKIE);

  if (error) {
    response.headers.set(
      "location",
      new URL("/login?error=oauth_callback", request.url).toString(),
    );
  }

  return response;
}
