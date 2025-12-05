import { NextRequest, NextResponse } from "next/server";
import { ThreadManager } from "@/core/thread-manager";
import { connectDB } from "@/lib/mongodb";
import { getSessionUserId } from "@/lib/session";

/**
 * GET /api/threads - Get all threads for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const userId = await getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const threads = await ThreadManager.getAllByOwner(userId);
    return NextResponse.json({ threads });
  } catch (error) {
    console.error("[Threads API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch threads" },
      { status: 500 }
    );
  }
}

