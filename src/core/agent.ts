import { streamText } from "ai";
import { openaiClient } from "@/lib/openai";
import Ably from "ably";
import { Message, createMessage, IMessage } from "@/models/message";
import { User, IUser } from "@/models/user";
import { Types } from "mongoose";
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
      // Fetch user, messages, and Ably channel in parallel
      const [user, threadMessages, channel] = await Promise.all([
        User.findById(userId),
        Message.find({ threadId }).sort({ createdAt: 1 }),
        this.getAblyChannel(responseMessageId),
      ]);

      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      if (threadMessages.length === 0) {
        throw new Error(`No messages found in thread: ${threadId}`);
      }

      // Build prompt from thread history
      const prompt = this.buildPrompt(threadMessages);

      // Create tools with user context
      const tools = createTools(
        {
          user: user as IUser,
          threadId,
          messageId: responseMessageId,
        },
        toolNames
      );

      // Stream response from OpenAI
      const modelName = process.env.OPENAI_MODEL || "gpt-4o-mini";
      const result = streamText({
        model: openaiClient()(modelName),
        prompt,
        tools,
      });

      // Stream response chunks to Ably and collect full text
      let fullText = "";
      let firstChunkTime: number | null = null;
      const streamStartTime = performance.now();

      for await (const chunk of result.textStream) {
        if (firstChunkTime === null) {
          firstChunkTime = performance.now() - streamStartTime;
          console.log(`[Agent] Time to first chunk: ${firstChunkTime.toFixed(0)}ms`);
        }

        fullText += chunk;
        await channel.publish("stream:text", {
          text: chunk,
          messageId: responseMessageId,
        });
      }

      // Save response to database (system message)
      await createMessage({
        threadId,
        role: "assistant",
        content: fullText,
        authorId: Agent.SYSTEM_ID,
      });

      // Publish completion
      await channel.publish("stream:complete", {
        messageId: responseMessageId,
        finalResponse: fullText,
      });

      return fullText;
    } catch (error) {
      console.error("[Agent] Error creating response:", error);
      // Attempt to publish error to channel
      try {
        const channel = await this.getAblyChannel(responseMessageId);
        await channel.publish("stream:error", {
          messageId: responseMessageId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      } catch (publishError) {
        console.error("[Agent] Failed to publish error to channel:", publishError);
      }
      throw error;
    }
}

  /**
   * Get or create Ably channel (internal implementation detail)
   */
  private static async getAblyChannel(messageId: string) {
    const apiKey = process.env.ABLY_API_KEY;
    if (!apiKey) {
      throw new Error("ABLY_API_KEY is not configured");
    }
    const ably = new Ably.Rest({ key: apiKey });
    return ably.channels.get(`chat:${messageId}`);
  }

  /**
   * Build a prompt from thread message history
   */
  private static buildPrompt(messages: IMessage[]): string {
    return messages
      .map((msg) => {
        const role = msg.role === "user" ? "User" : "Assistant";
        return `${role}: ${msg.content}`;
      })
      .join("\n\n");
}
}
