import type { CookieOptions, CookieStore } from "@insforge/sdk/ssr";
import { updateSession } from "@insforge/sdk/ssr/middleware";
import { type NextRequest, NextResponse } from "next/server";

function createResponseCookieStore(response: NextResponse): CookieStore {
  function setCookie(
    name: string,
    value: string,
    options?: CookieOptions,
  ): void;
  function setCookie(options: { name: string; value: string } & CookieOptions): void;
  function setCookie(
    nameOrOptions: string | ({ name: string; value: string } & CookieOptions),
    value?: string,
    options?: CookieOptions,
  ) {
    if (typeof nameOrOptions === "string") {
      response.cookies.set(nameOrOptions, value ?? "", options);
      return;
    }

    response.cookies.set(nameOrOptions);
  }

  function deleteCookie(name: string): void;
  function deleteCookie(options: { name: string } & CookieOptions): void;
  function deleteCookie(nameOrOptions: string | ({ name: string } & CookieOptions)) {
    if (typeof nameOrOptions === "string") {
      response.cookies.delete(nameOrOptions);
      return;
    }

    response.cookies.delete({
      name: nameOrOptions.name,
      domain: nameOrOptions.domain,
      path: nameOrOptions.path,
    });
  }

  return {
    get: (name) => response.cookies.get(name)?.value,
    set: setCookie,
    delete: deleteCookie,
  };
}

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  const requestCookies: CookieStore = {
    get: (name) => request.cookies.get(name)?.value,
  };
  const responseCookies = createResponseCookieStore(response);
  const { accessToken } = await updateSession({
    requestCookies,
    responseCookies,
  });

  if (!accessToken) {
    const redirectResponse = NextResponse.redirect(new URL("/login", request.url));

    for (const cookie of response.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }

    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/profile/:path*", "/find-jobs/:path*"],
};
