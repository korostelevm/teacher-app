import { NextResponse } from "next/server";
import Ably from "ably";

/**
 * Ably authentication route for frontend token requests
 * Generates capability tokens for client connections
 */
export async function GET(request: Request) {
  try {
    const apiKey = process.env.ABLY_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "ABLY_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // Create Ably REST client
    const ably = new Ably.Rest({ key: apiKey });

    // Generate a token request for the client
    // Using clientId from query params or generating a random one
    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId") || `client-${Date.now()}`;

    // Request token with publish/subscribe capabilities
    const tokenRequest = await ably.auth.createTokenRequest({
      clientId,
      capability: {
        // Allow publish/subscribe to chat channels
        "chat:*": ["publish", "subscribe", "presence"],
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

