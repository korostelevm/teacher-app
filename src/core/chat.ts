/**
 * Simple chat streaming implementation
 */

import { streamText } from "ai";
import { openaiClient } from "@/lib/openai";
import Ably from "ably";

/**
 * Stream chat response directly to Ably channel
 */
export async function streamChatResponse(
  userInput: string,
  channel: ReturnType<Ably.Rest["channels"]["get"]>,
  messageId: string
): Promise<string> {
  // Optimize for lower latency:
  // Use faster model (gpt-4o-mini is typically fastest, ~1-2s TTFT vs 4-5s for larger models)
  // Model can be overridden via OPENAI_MODEL env var
  const modelName = process.env.OPENAI_MODEL || "gpt-4o-mini";
  
  const result = streamText({
    model: openaiClient(modelName),
    prompt: userInput,
  });

  // Stream response chunks to Ably
  let fullText = "";
  let firstChunkTime: number | null = null;
  const streamStartTime = performance.now();
  
  for await (const chunk of result.textStream) {
    if (firstChunkTime === null) {
      firstChunkTime = performance.now() - streamStartTime;
      console.log(`[Chat] Time to first chunk: ${firstChunkTime.toFixed(0)}ms`);
    }
    
    fullText += chunk;
    await channel.publish("stream:text", {
      text: chunk,
      messageId,
    });
  }

  // Publish completion
  await channel.publish("stream:complete", {
    messageId,
    finalResponse: fullText,
  });

  return fullText;
}

