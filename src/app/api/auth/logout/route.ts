import { NextRequest, NextResponse } from "next/server";
import { Session } from "@/models/session";

/**
 * POST /api/auth/logout
 * Logs out the current user by clearing cookies and invalidating session
 */
export async function POST(request: NextRequest) {
  try {
    const userId = request.cookies.get("userId")?.value;

    // Invalidate session in database if userId exists
    if (userId) {
      await Session.deleteMany({ userId });
    }

    const response = NextResponse.json(
      { success: true, message: "Logged out successfully" }
    );

    // Clear user session cookie
    response.cookies.delete("userId");

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Failed to logout" },
      { status: 500 }
    );
  }
}

