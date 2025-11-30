import { NextResponse } from "next/server";
import Ably from "ably";
import { streamChatResponse } from "@/core/chat";

/**
 * Chat API route handler for processing messages
 * Streams response via Ably Realtime
 */
export async function POST(request: Request) {
  try {
    const { content, messageId } = await request.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Invalid message content" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ABLY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ABLY_API_KEY is not configured" },
        { status: 500 }
      );
    }

    // Generate a unique message ID if not provided
    const msgId = messageId || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create Ably REST client for publishing
    const ably = new Ably.Rest({ key: apiKey });
    const channel = ably.channels.get(`chat:${msgId}`);
    
    // Start streaming in the background - don't await it
    // This allows us to return the HTTP response immediately
    streamChatResponse(content, channel, msgId).catch((error) => {
      console.error("[Chat API] Stream error:", error);
      // Publish error to channel so client can handle it
      channel.publish("stream:error", {
        messageId: msgId,
        error: error.message || "Streaming error occurred",
      });
    });

    // Return immediately - streaming happens in background via Ably
    return NextResponse.json({
      messageId: msgId,
      channel: `chat:${msgId}`,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Chat API error:", error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      // Check if it's an API key error
      if (error.message.includes("OPENAI_API_KEY")) {
        return NextResponse.json(
          { error: "OpenAI API key is not configured. Please set OPENAI_API_KEY in your .env.local file." },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: error.message || "Failed to process message" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}

/**
 * GET handler to verify API endpoint is working
 */
export async function GET() {
  return NextResponse.json(
    { status: "Chat API endpoint operational" },
    { status: 200 }
  );
}
