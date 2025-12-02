import { NextRequest, NextResponse } from "next/server";
import { getMessageToolCalls } from "@/models/tool-call";

/**
 * GET /api/tool-calls/[messageId] - Get tool calls for a message
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const userId = request.cookies.get("userId")?.value;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { messageId } = await params;
    const toolCalls = await getMessageToolCalls(messageId);

    const transformedToolCalls = toolCalls.map((tc) => ({
      toolName: tc.toolName,
      status: tc.status,
      input: tc.input,
      output: tc.output,
      durationMs: tc.durationMs,
    }));

    return NextResponse.json({ toolCalls: transformedToolCalls });
  } catch (error) {
    console.error("[Tool Calls API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tool calls" },
      { status: 500 }
    );
  }
}

