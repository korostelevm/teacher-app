import { NextRequest, NextResponse } from "next/server";
import { User } from "@/models/user";
import { Session } from "@/models/session";

/**
 * GET /api/auth/redirect
 * Google OAuth callback handler
 * Exchanges authorization code for access token
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json(
      { error: "Missing authorization code" },
      { status: 400 }
    );
  }

  try {

    const clientId = process.env.GOOGLE_CLIENT_ID || "GOOGLE_CLIENT_ID_MISSING";
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "GOOGLE_CLIENT_SECRET_MISSING";
    const redirectUri = process.env.GOOGLE_CALLBACK_URL || "http://localhost:3000/api/auth/redirect";

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
      const errorData = await tokenResponse.text();
      console.error("Token exchange failed:", errorData);
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
        role: "user",
      });
    } else {
      // Update tokens and ensure role is set
      user.accessToken = accessToken;
      if (tokenData.refresh_token) {
        user.refreshToken = tokenData.refresh_token;
      }
      if (!user.role) {
        user.role = "user";
      }
      await user.save();
    }

    // Create or update session in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    await Session.findOneAndUpdate(
      { userId: user._id.toString() },
      {
        userId: user._id.toString(),
        token: user._id.toString(),
        expiresAt,
      },
      { upsert: true, new: true }
    );

    // Redirect to home with auth
    const response = NextResponse.redirect(
      new URL("/", request.nextUrl.origin)
    );

    // Set user session cookie
    response.cookies.set("userId", user._id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("OAuth callback error:", errorMessage);
    console.error("Full error:", error);
    return NextResponse.redirect(
      new URL(`/?error=auth_failed&details=${encodeURIComponent(errorMessage)}`, request.nextUrl.origin)
    );
  }
}

