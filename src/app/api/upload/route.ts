import { NextResponse } from "next/server";

/**
 * POST handler for chat messages and file uploads
 * Handles both text messages and file attachments from the chat interface
 */
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    // For now, just echo back the message
    // TODO: Implement actual chat processing logic
    return NextResponse.json({
      message: `Received: ${file}`,
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
