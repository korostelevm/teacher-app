import { NextRequest, NextResponse } from "next/server";
import { verifySessionTokenEdge } from "@/lib/session-edge";

export async function middleware(request: NextRequest) {
  const userId = await verifySessionTokenEdge(
    request.cookies.get("session")?.value
  );
  const pathname = request.nextUrl.pathname;

  // Allow auth routes without checking userId
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // If no userId and trying to access root, redirect to Google login
  if (!userId && pathname === "/") {
    return NextResponse.redirect(new URL("/api/auth/google", request.url));
  }

  // Protect other API routes if not authenticated
  if (pathname.startsWith("/api/") && !userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/api/:path*"],
};

