import { auth } from "@/auth";
import type { NextRequest } from "next/server";

// Next.js 16: "proxy" replaces "middleware"
// Wrapping next-auth's `auth` as a proper named function export
export async function proxy(request: NextRequest) {
  return (auth as any)(request);
}

export const config = {
  matcher: [
    // Protect everything except static files, _next, api/auth, and login
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)",
  ],
};
