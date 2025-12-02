import { streamText, type CoreMessage } from "ai";
import { openaiClient } from "@/lib/openai";
import {
  publishStreamText,
  publishStreamComplete,
  publishStreamError,
} from "@/lib/ably";
import { Message, createMessage, IMessage } from "@/models/message";
import { getMessageToolCalls } from "@/models/tool-call";
import { User, IUser } from "@/models/user";
import { createTools } from "@/tools";

/**
 * Agent class for generating AI responses
 * Handles LLM streaming and persistence
 */
export class Agent {
  // System ID for agent-authored messages
  static readonly SYSTEM_ID = "000000000000000000000000";

  /**
   * Create a response to a thread
   * @param params - Configuration object
   * @param params.threadId - ID of the thread to respond to
   * @param params.responseMessageId - Unique identifier for the response message (used for client-side tracking)
   * @param params.userId - ID of the user making the request
   * @param params.toolNames - Optional list of tool names to enable. If not provided, all tools are enabled.
   * @returns The full response text
   */
  static async createResponse(params: {
    threadId: string;
    responseMessageId: string;
    userId: string;
    toolNames?: string[];
  }): Promise<string> {
    const { threadId, responseMessageId, userId, toolNames } = params;

    try {
      // Fetch user and messages in parallel
      const [user, threadMessages] = await Promise.all([
        User.findById(userId),
        Message.find({ threadId }).sort({ createdAt: 1 }),
      ]);

      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      if (threadMessages.length === 0) {
        throw new Error(`No messages found in thread: ${threadId}`);
      }

      // Build messages array from thread history
      const messages = this.buildMessages(threadMessages);

      // Create tools with user context
      const tools = createTools(
        {
          user: user as IUser,
          threadId,
          messageId: responseMessageId,
        },
        toolNames
      );

      // Stream response from OpenAI with tools
      const modelName = process.env.OPENAI_MODEL || "gpt-4o-mini";
      let fullText = await this.streamResponse({
        modelName,
        messages,
        tools,
        responseMessageId,
      });

      // Check if this was a tool-only response (no text generated)
      // If so, run another cycle with tool results in context but no tools
      if (!fullText.trim() && toolNames && toolNames.length > 0) {
        console.log("[Agent] Tool-only response detected, running follow-up cycle");

        // Build messages with tool results appended
        const messagesWithToolResults = await this.buildMessagesWithToolResults(
          threadMessages,
          responseMessageId
        );

        // Run follow-up without tools to get a text response
        fullText = await this.streamResponse({
          modelName,
          messages: messagesWithToolResults,
          tools: {}, // No tools for follow-up
          responseMessageId,
        });
      }

      // Save response to database only if there's text content
      if (fullText.trim()) {
        await createMessage({
          threadId,
          role: "assistant",
          content: fullText,
          authorId: Agent.SYSTEM_ID,
          messageId: responseMessageId,
        });
      }

      // Publish completion
      await publishStreamComplete(responseMessageId, fullText);

      return fullText;
    } catch (error) {
      console.error("[Agent] Error creating response:", error);
      // Attempt to publish error to channel
      try {
        await publishStreamError(
          responseMessageId,
          error instanceof Error ? error.message : "Unknown error"
        );
      } catch (publishError) {
        console.error("[Agent] Failed to publish error to channel:", publishError);
      }
      throw error;
    }
  }

  /**
   * Stream a response from the LLM
   */
  private static async streamResponse(params: {
    modelName: string;
    messages: CoreMessage[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: Record<string, any>;
    responseMessageId: string;
  }): Promise<string> {
    const { modelName, messages, tools, responseMessageId } = params;

    const result = streamText({
      model: openaiClient()(modelName),
      messages,
      tools: Object.keys(tools).length > 0 ? tools : undefined,
    });

    let fullText = "";
    let firstChunkTime: number | null = null;
    const streamStartTime = performance.now();

    for await (const chunk of result.textStream) {
      if (firstChunkTime === null) {
        firstChunkTime = performance.now() - streamStartTime;
        console.log(`[Agent] Time to first chunk: ${firstChunkTime.toFixed(0)}ms`);
      }

      fullText += chunk;
      await publishStreamText(responseMessageId, chunk);
    }

    return fullText;
  }

  /**
   * Build messages array from thread history
   */
  private static buildMessages(messages: IMessage[]): CoreMessage[] {
    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  /**
   * Build messages array with tool results appended
   */
  private static async buildMessagesWithToolResults(
    messages: IMessage[],
    messageId: string
  ): Promise<CoreMessage[]> {
    const baseMessages = this.buildMessages(messages);

    // Fetch tool calls for this message
    const toolCalls = await getMessageToolCalls(messageId);

    if (toolCalls.length === 0) {
      return baseMessages;
    }

    // Format tool results as an assistant message
    const toolResultsText = toolCalls
      .map((tc) => `Tool "${tc.toolName}" returned: ${JSON.stringify(tc.output)}`)
      .join("\n");

    return [
      ...baseMessages,
      {
        role: "assistant" as const,
        content: `I used the following tools:\n${toolResultsText}\n\nNow I'll provide my response based on these results.`,
      },
    ];
  }
}
