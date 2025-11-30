import { openai } from "@ai-sdk/openai";

/**
 * OpenAI client configured with API key from environment variables
 * 
 * Usage:
 * ```ts
 * import { getOpenAIClient } from "@/lib/openai";
 * const client = getOpenAIClient();
 * ```
 */
export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === "sk-placeholder-your-openai-api-key-here") {
    throw new Error(
      "OPENAI_API_KEY is not set. Please set it in your .env.local file."
    );
  }

  // openai() reads from process.env.OPENAI_API_KEY automatically
  // Return a function that can be called with model IDs
  return openai;
}

/**
 * Pre-configured OpenAI provider function
 * Use this for convenience when you know the API key is set
 * 
 * This is a function that validates and returns the openai client,
 * allowing validation to happen at runtime rather than build time.
 * 
 * Usage with Vercel AI SDK:
 * ```ts
 * import { openaiClient } from "@/lib/openai";
 * import { generateText } from "ai";
 * 
 * const result = await generateText({
 *   model: openaiClient()("gpt-4o-mini"),
 *   prompt: "Hello!",
 * });
 * ```
 */
export function openaiClient() {
  // Validate API key is set at runtime (not build time)
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "sk-placeholder-your-openai-api-key-here") {
    throw new Error(
      "OPENAI_API_KEY is not set. Please set it in your .env.local file."
    );
  }
  // Return the openai function which reads from process.env.OPENAI_API_KEY
  return openai;
}

