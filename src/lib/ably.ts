import Ably from "ably";

let ablyClient: Ably.Rest | null = null;

/**
 * Get the shared Ably client instance
 */
function getAblyClient() {
  if (!ablyClient) {
    const apiKey = process.env.ABLY_API_KEY;
    if (!apiKey) {
      throw new Error("ABLY_API_KEY is not configured");
    }
    ablyClient = new Ably.Rest({ key: apiKey });
  }
  return ablyClient;
}

/**
 * Get an Ably channel for a chat message
 * @param messageId - The message ID to create a channel for
 */
export function getChatChannel(messageId: string) {
  return getAblyClient().channels.get(`chat:${messageId}`);
}

/**
 * Publish a stream text chunk
 */
export async function publishStreamText(messageId: string, text: string) {
  const channel = getChatChannel(messageId);
  await channel.publish("stream:text", { text, messageId });
}

/**
 * Publish stream completion
 */
export async function publishStreamComplete(messageId: string, finalResponse: string) {
  const channel = getChatChannel(messageId);
  await channel.publish("stream:complete", { messageId, finalResponse });
}

/**
 * Publish stream error
 */
export async function publishStreamError(messageId: string, error: string) {
  const channel = getChatChannel(messageId);
  await channel.publish("stream:error", { messageId, error });
}

/**
 * Publish tool start event (minimal - frontend fetches details from DB)
 */
export async function publishToolStart(messageId: string, toolName: string) {
  console.log(`[Ably] Publishing tool:start for ${toolName} on channel chat:${messageId}`);
  const channel = getChatChannel(messageId);
  await channel.publish("tool:start", { messageId, toolName });
  console.log(`[Ably] Published tool:start`);
}

/**
 * Publish tool complete event (minimal - frontend fetches details from DB)
 */
export async function publishToolComplete(messageId: string, toolName: string) {
  console.log(`[Ably] Publishing tool:complete for ${toolName} on channel chat:${messageId}`);
  const channel = getChatChannel(messageId);
  await channel.publish("tool:complete", { messageId, toolName });
  console.log(`[Ably] Published tool:complete`);
}

