import { NextRequest, NextResponse } from "next/server";
import { Memory, softDeleteMemories } from "@/models/memory";
import { connectDB } from "@/lib/mongodb";
import { getSessionUserId } from "@/lib/session";

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const userId = await getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memories = await Memory.find({ userId, deletedAt: null }).sort({ createdAt: -1 });

    return NextResponse.json({ memories });
  } catch (error) {
    console.error("[Memories API] Error:", error);
    return NextResponse.json({ error: "Failed to fetch memories" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await connectDB();
    const userId = await getSessionUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { memoryId } = await request.json();
    if (!memoryId) {
      return NextResponse.json({ error: "Memory ID required" }, { status: 400 });
    }

    console.log(`[Memories API] Deleting memory ${memoryId} for user ${userId}`);

    // Verify the memory belongs to this user before deleting
    const memory = await Memory.findOne({ _id: memoryId, userId, deletedAt: null });
    if (!memory) {
      console.log(`[Memories API] Memory not found: ${memoryId}`);
      return NextResponse.json({ error: "Memory not found" }, { status: 404 });
    }

    await softDeleteMemories([memoryId]);
    console.log(`[Memories API] Successfully deleted memory ${memoryId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Memories API] Delete error:", error);
    return NextResponse.json({ error: "Failed to delete memory" }, { status: 500 });
  }
}

