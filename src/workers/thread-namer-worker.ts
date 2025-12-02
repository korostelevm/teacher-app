import { z } from "zod";
import { Message } from "@/models/message";
import { Thread } from "@/models/thread";

/**
 * Thread Namer Worker
 *
 * Automatically generates descriptive titles for threads after the second message
 * is saved, based on the conversation content.
 */

const ThreadTitleSchema = z.object({
  title: z
    .string()
    .max(50)
    .describe(
      "A short, descriptive title for this conversation (max 50 chars)"
    ),
});

// Lazy-loaded agent to avoid circular dependency with agent.ts
let threadNamerAgent: InstanceType<typeof import("@/core/agent").Agent> | null = null;

async function getThreadNamerAgent() {
  if (!threadNamerAgent) {
    const { Agent } = await import("@/core/agent");
    threadNamerAgent = new Agent({
      systemId: "000000000000000000000003",
      model: "gpt-4o-mini", // Use faster/cheaper model for naming
      systemPrompt: `You are a thread naming assistant. Given a conversation, generate a short, descriptive title.

Rules:
- Keep titles under 50 characters
- Focus on the main topic or goal
- Be specific but concise
- Use title case
- Don't use quotes or special characters
- For lesson planning conversations, mention the subject/topic

Examples of good titles:
- "7th Grade Fractions Lesson"
- "Algebra Activity Ideas"
- "Assessment Strategies for Math"
- "Differentiation for ELL Students"`,
    });
  }
  return threadNamerAgent;
}

type Job = { threadId: string };
const queue: Job[] = [];
let processing = false;

async function generateThreadTitle(threadId: string) {
  console.log(`[ThreadNamer] Starting title generation for thread ${threadId}`);

  try {
    // Get thread and message count
    const [thread, messageCount] = await Promise.all([
      Thread.findById(threadId),
      Message.countDocuments({ threadId }),
    ]);

    if (!thread) {
      console.log(`[ThreadNamer] Thread not found, skipping`);
      return;
    }

    // Only name threads on 2nd or 4th message (gives two chances to capture the topic)
    if (messageCount !== 2 && messageCount !== 4) {
      console.log(
        `[ThreadNamer] Thread has ${messageCount} messages, skipping (need 2 or 4)`
      );
      return;
    }

    // Check if thread already has a custom title (not the default)
    if (!thread.title.startsWith("Chat - ")) {
      console.log(`[ThreadNamer] Thread already has custom title, skipping`);
      return;
    }

    // Get the messages (up to 4 for better context)
    const messages = await Message.find({ threadId })
      .sort({ createdAt: 1 })
      .limit(4);

    if (messages.length < 2) {
      console.log(`[ThreadNamer] Not enough messages, skipping`);
      return;
    }

    // Build conversation context
    const conversation = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n\n");

    const prompt = `Generate a title for this conversation:\n\n${conversation}`;

    console.log(`[ThreadNamer] Calling LLM...`);
    const agent = await getThreadNamerAgent();
    const { title } = await agent.generateFromPrompt(
      prompt,
      ThreadTitleSchema
    );

    console.log(`[ThreadNamer] Generated title: "${title}"`);

    // Update thread title
    await Thread.findByIdAndUpdate(threadId, { title });
    console.log(`[ThreadNamer] Thread title updated successfully`);
  } catch (error) {
    console.error(`[ThreadNamer] Error generating title:`, error);
  }
}

async function processQueue() {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const job = queue.shift()!;
    try {
      await generateThreadTitle(job.threadId);
    } catch (error) {
      console.error("[ThreadNamer] Error:", error);
    }
  }

  processing = false;
}

/**
 * Queue a thread for title generation
 * Call this after a message is saved
 */
export function queueThreadNaming(threadId: string) {
  // Check if this thread is already in the queue
  if (queue.some((job) => job.threadId === threadId)) {
    console.log(`[ThreadNamer] Thread ${threadId} already queued, skipping`);
    return;
  }

  console.log(`[ThreadNamer] Queued thread ${threadId}`);
  queue.push({ threadId });
  processQueue();
}

