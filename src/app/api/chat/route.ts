import { NextRequest, NextResponse } from "next/server";
import { chatAgent } from "@/core/agent";
import { ThreadManager } from "@/core/thread-manager";
import { createMessage } from "@/models/message";
import { queueMemoryExtraction } from "@/workers/thread-update-worker";

/**
 * Chat API route handler for processing messages
 * Streams response via Ably Realtime
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const userId = request.cookies.get("userId")?.value;
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { content, messageId, threadId } = await request.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Invalid message content" },
        { status: 400 }
      );
    }

    // Generate a unique message ID if not provided
    const msgId = messageId || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create or use existing thread
    let currentThreadId = threadId;
    if (!currentThreadId) {
      try {
        const newThread = await ThreadManager.create(
          `Chat - ${new Date().toLocaleString()}`,
          userId
        );
        currentThreadId = newThread._id.toString();
      } catch (error) {
        console.error("[Chat API] Failed to create thread:", error);
        return NextResponse.json(
          { error: "Failed to create chat thread" },
          { status: 500 }
        );
      }
    }

    // Save user message to database
    try {
      await createMessage({
        threadId: currentThreadId,
        role: "user",
        content,
        authorId: userId,
      });
      
      // Queue memory extraction (runs in background)
      queueMemoryExtraction(currentThreadId, userId);
    } catch (error) {
      console.error("[Chat API] Failed to save user message:", error);
      return NextResponse.json(
        { error: "Failed to save message" },
        { status: 500 }
      );
    }
    
    // Start streaming in the background - don't await it
    // This allows us to return the HTTP response immediately
    // Message is guaranteed persisted at this point (await above)
    chatAgent.createResponse({
      threadId: currentThreadId,
      responseMessageId: msgId,
      userId,
    }).catch((error) => {
      console.error("[Chat API] Agent error:", error);
    });

    // Return immediately - streaming happens in background
    return NextResponse.json({
      messageId: msgId,
      channel: `chat:${msgId}`,
      threadId: currentThreadId,
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
