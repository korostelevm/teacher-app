import { NextResponse, NextRequest } from "next/server";
import Ably from "ably";
import { getSessionUserId } from "@/lib/session";

/**
 * Ably authentication route for frontend token requests
 * Generates capability tokens for client connections
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getSessionUserId(request);
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const apiKey = process.env.ABLY_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "ABLY_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // Create Ably REST client
    const ably = new Ably.Rest({ key: apiKey });

    // Generate a token request for the client scoped to this user
    const clientId = userId;

    // Request token with publish/subscribe capabilities limited to this user
    const tokenRequest = await ably.auth.createTokenRequest({
      clientId,
      capability: {
        // Client only needs to subscribe; server publishes via API key
        [`chat:${userId}:*`]: ["subscribe"],
        [`user:${userId}`]: ["subscribe"],
      },
    });

    return NextResponse.json(tokenRequest);
  } catch (error) {
    console.error("Ably auth error:", error);
    return NextResponse.json(
      { error: "Failed to generate Ably token" },
      { status: 500 }
    );
  }
}

