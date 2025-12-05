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
 * @param channelName - The full channel name (e.g., chat:userId:messageId)
 */
export function getChatChannel(channelName: string) {
  return getAblyClient().channels.get(channelName);
}

/**
 * Publish a stream text chunk
 */
export async function publishStreamText(channelName: string, messageId: string, text: string) {
  const channel = getChatChannel(channelName);
  await channel.publish("stream:text", { text, messageId });
}

/**
 * Publish stream completion
 */
export async function publishStreamComplete(
  channelName: string,
  messageId: string, 
  finalResponse: string,
  memoriesUsed?: { id: string; content: string; deleted?: boolean }[]
) {
  const channel = getChatChannel(channelName);
  await channel.publish("stream:complete", { messageId, finalResponse, memoriesUsed });
}

/**
 * Publish stream error
 */
export async function publishStreamError(channelName: string, messageId: string, error: string) {
  const channel = getChatChannel(channelName);
  await channel.publish("stream:error", { messageId, error });
}

/**
 * Publish tool start event (minimal - frontend fetches details from DB)
 */
export async function publishToolStart(channelName: string, messageId: string, toolName: string) {
  console.log(`[Ably] Publishing tool:start for ${toolName} on channel chat:${messageId}`);
  const channel = getChatChannel(channelName);
  await channel.publish("tool:start", { messageId, toolName });
  console.log(`[Ably] Published tool:start`);
}

/**
 * Publish tool complete event (minimal - frontend fetches details from DB)
 */
export async function publishToolComplete(channelName: string, messageId: string, toolName: string) {
  console.log(`[Ably] Publishing tool:complete for ${toolName} on channel chat:${messageId}`);
  const channel = getChatChannel(channelName);
  await channel.publish("tool:complete", { messageId, toolName });
  console.log(`[Ably] Published tool:complete`);
}

/**
 * Get an Ably channel for user-specific events
 */
export function getUserChannel(userId: string) {
  return getAblyClient().channels.get(`user:${userId}`);
}

/**
 * Publish thread update event (e.g., title changed)
 */
export async function publishThreadUpdate(userId: string, threadId: string, updates: { title?: string }) {
  console.log(`[Ably] Publishing thread:update for thread ${threadId}`);
  const channel = getUserChannel(userId);
  await channel.publish("thread:update", { threadId, ...updates });
  console.log(`[Ably] Published thread:update`);
}

/**
 * Publish thread created event
 */
export async function publishThreadCreated(userId: string, thread: { _id: string; title: string; createdAt: string; updatedAt: string }) {
  console.log(`[Ably] Publishing thread:create for thread ${thread._id}`);
  const channel = getUserChannel(userId);
  await channel.publish("thread:create", thread);
  console.log(`[Ably] Published thread:create`);
}

