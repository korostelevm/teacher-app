import { NextRequest, NextResponse } from "next/server";
import { getThreadMessages } from "@/models/message";
import { getThreadToolCalls } from "@/models/tool-call";

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
    
    // Fetch messages and tool calls in parallel
    const [messages, toolCalls] = await Promise.all([
      getThreadMessages(threadId),
      getThreadToolCalls(threadId),
    ]);
    
    // Group tool calls by messageId
    const toolCallsByMessageId = new Map<string, typeof toolCalls>();
    for (const tc of toolCalls) {
      const existing = toolCallsByMessageId.get(tc.messageId) || [];
      existing.push(tc);
      toolCallsByMessageId.set(tc.messageId, existing);
    }
    
    // Transform messages to include author information, tool calls, and memories
    const transformedMessages = messages.map((msg: any) => {
      const msgToolCalls = msg.messageId 
        ? toolCallsByMessageId.get(msg.messageId) 
        : undefined;
      
      return {
        id: msg._id.toString(),
        content: msg.content,
        role: msg.role,
        author: msg.authorId ? {
          displayName: msg.authorId.displayName,
          email: msg.authorId.email,
          photo: msg.authorId.photo,
        } : undefined,
        toolCalls: msgToolCalls?.map((tc: any) => ({
          toolName: tc.toolName,
          status: tc.status,
          input: tc.input,
          output: tc.output,
          durationMs: tc.durationMs,
        })),
        memoriesUsed: msg.referencedMemories?.map((m: any) => ({
          id: m._id.toString(),
          content: m.content,
          deleted: m.deletedAt !== null,
        })),
      };
    });
    
    return NextResponse.json({ messages: transformedMessages });
  } catch (error) {
    console.error("[Thread Messages API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

