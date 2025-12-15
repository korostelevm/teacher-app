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
 * Publish a stream text chunk (direct, unbatched)
 */
export async function publishStreamText(channelName: string, messageId: string, text: string) {
  const channel = getChatChannel(channelName);
  await channel.publish("stream:text", { text, messageId });
}

/**
 * Throttled stream publisher - batches text chunks to avoid Ably rate limits
 * Creates a publisher instance for a specific channel/message that buffers
 * text and publishes at a controlled rate (max ~20/sec = 50ms intervals)
 */
export function createThrottledStreamPublisher(channelName: string, messageId: string) {
  const PUBLISH_INTERVAL_MS = 50; // Max 20 publishes/second
  let buffer = "";
  let lastPublishTime = 0;
  let pendingTimeout: NodeJS.Timeout | null = null;
  let isFlushing = false;

  const doPublish = async () => {
    if (buffer.length === 0 || isFlushing) return;
    
    const textToPublish = buffer;
    buffer = "";
    lastPublishTime = Date.now();
    
    try {
      const channel = getChatChannel(channelName);
      await channel.publish("stream:text", { text: textToPublish, messageId });
    } catch (error) {
      console.error("[Ably] Throttled publish error:", error);
    }
  };

  return {
    /**
     * Queue text to be published (will be batched and throttled)
     */
    push(text: string) {
      buffer += text;
      
      const now = Date.now();
      const timeSinceLastPublish = now - lastPublishTime;
      
      // If enough time has passed, publish immediately
      if (timeSinceLastPublish >= PUBLISH_INTERVAL_MS) {
        if (pendingTimeout) {
          clearTimeout(pendingTimeout);
          pendingTimeout = null;
        }
        doPublish();
      } else if (!pendingTimeout) {
        // Schedule a publish for later
        const delay = PUBLISH_INTERVAL_MS - timeSinceLastPublish;
        pendingTimeout = setTimeout(() => {
          pendingTimeout = null;
          doPublish();
        }, delay);
      }
    },

    /**
     * Flush any remaining buffered text immediately
     * Call this before stream completion
     */
    async flush() {
      isFlushing = true;
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        pendingTimeout = null;
      }
      if (buffer.length > 0) {
        const textToPublish = buffer;
        buffer = "";
        try {
          const channel = getChatChannel(channelName);
          await channel.publish("stream:text", { text: textToPublish, messageId });
        } catch (error) {
          console.error("[Ably] Flush publish error:", error);
        }
      }
      isFlushing = false;
    },
  };
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

/**
 * Publish memory update event (e.g., new or consolidated memories)
 */
export async function publishMemoryUpdate(userId: string) {
  console.log(`[Ably] Publishing memory:update for user ${userId}`);
  const channel = getUserChannel(userId);
  await channel.publish("memory:update", { userId });
  console.log(`[Ably] Published memory:update`);
}

