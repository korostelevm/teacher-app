import { NextRequest, NextResponse } from "next/server";
import { getThreadMessages } from "@/models/message";

/**
 * GET /api/threads/[threadId]/messages - Get all messages in a thread
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const userId = request.cookies.get("userId")?.value;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { threadId } = await params;
    const messages = await getThreadMessages(threadId);
    return NextResponse.json({ messages });
  } catch (error) {
    console.error("[Thread Messages API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

