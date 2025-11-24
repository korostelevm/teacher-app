import { NextResponse } from "next/server";

/**
 * Chat API route handler for processing messages through an LLM
 * Handles incoming chat messages and returns AI responses
 */
export async function POST(request: Request) {
  try {
    const { content } = await request.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Invalid message content" },
        { status: 400 }
      );
    }

    // TODO: Add LLM integration here
    // For now return an echo response
    const aiResponse = `I received your message: "${content}". LLM integration coming soon.`;

    return NextResponse.json({
      message: aiResponse,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error("Chat API error:", error);
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
