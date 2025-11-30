import { NextRequest, NextResponse } from "next/server";
import { User } from "@/models/user";
import { connectToDatabase } from "@/lib/mongodb";

/**
 * GET /api/auth/google/callback
 * Google OAuth callback handler
 * Exchanges authorization code for access token
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  if (!code) {
    return NextResponse.json(
      { error: "Missing authorization code" },
      { status: 400 }
    );
  }

  try {
    await connectToDatabase();

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/api/auth/redirect";

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "Google OAuth credentials not configured" },
        { status: 500 }
      );
    }

    // Exchange code for token with Google
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error("Failed to exchange authorization code");
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get user info from Google
    const userInfoResponse = await fetch(
      "https://www.googleapis.com/oauth2/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!userInfoResponse.ok) {
      throw new Error("Failed to fetch user info from Google");
    }

    const googleUser = await userInfoResponse.json();

    // Find or create user in database
    let user = await User.findOne({ googleId: googleUser.id });

    if (!user) {
      user = await User.create({
        googleId: googleUser.id,
        displayName: googleUser.name,
        email: googleUser.email,
        photo: googleUser.picture,
        accessToken: accessToken,
        refreshToken: tokenData.refresh_token,
      });
    } else {
      // Update tokens
      user.accessToken = accessToken;
      if (tokenData.refresh_token) {
        user.refreshToken = tokenData.refresh_token;
      }
      await user.save();
    }

    // Create session - you can set session data in cookie or use NextAuth
    // For now, we'll create a simple response with user data
    const response = NextResponse.redirect(
      new URL("/", request.nextUrl.origin)
    );

    // Set user data in cookie (you might want to use httpOnly cookie with session)
    response.cookies.set("userId", user._id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60, // 24 hours
    });

    response.cookies.set("userName", user.displayName, {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.json(
      { error: "Failed to complete authentication" },
      { status: 500 }
    );
  }
}

