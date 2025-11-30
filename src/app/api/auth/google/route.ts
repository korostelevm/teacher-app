import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/google
 * Initiates Google OAuth flow
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID || "GOOGLE_CLIENT_ID_MISSING";
    const redirectUri = process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/api/auth/redirect";

    const googleAuthUrl = new URL("https://accounts.google.com/o/oauth2/auth");

    const params = {
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "profile email",
      access_type: "offline",
      prompt: "consent",
    };

    Object.entries(params).forEach(([key, value]) => {
      googleAuthUrl.searchParams.append(key, value);
    });

    return NextResponse.redirect(googleAuthUrl.toString());
  } catch (error) {
    console.error("Error initiating Google auth:", error);
    return NextResponse.json(
      { error: "Failed to initiate Google authentication" },
      { status: 500 }
    );
  }
}

