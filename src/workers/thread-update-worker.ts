import { z } from "zod";
import { Agent } from "@/core/agent";
import { Message, type IMessage } from "@/models/message";
import { Memory, type IMemory, findActiveMemories, softDeleteMemories, expireMemories } from "@/models/memory";
import { getMessageToolCalls } from "@/models/tool-call";

const MemoryOutputSchema = z.object({
  memories: z.array(
    z.object({
      content: z.string().describe("The memory content"),
      sourceIds: z.array(z.string()).describe("IDs of existing memories incorporated into this. Empty array for brand new memories."),
    })
  ).describe("Complete list of memories about the user - both new and consolidated existing ones."),
});

const memoryAgent = new Agent({
  systemId: "000000000000000000000002",
  systemPrompt: `You are a memory management agent. Given a conversation and existing memories, output a COMPLETE updated list of memories about the user.

Your task:
1. Extract any NEW facts, preferences, or important information from the conversation
2. Consolidate redundant/overlapping memories into single entries
3. Keep distinct memories separate
4. Output the full updated memory list

For each memory:
- If it's from existing memories (possibly merged), include their IDs in sourceIds
- If it's brand new from the conversation, sourceIds should be empty []

Examples of good memories:
- User prefers Python over JavaScript
- User is working on a math tutoring app
- User's name is Mike

Consolidation examples:
- "User likes Python" + "User prefers Python over JS" → single memory: "User prefers Python over JavaScript"

Do not include:
- Trivial conversation details
- Temporary context that won't matter later`,
});

type Job = { threadId: string; userId: string };
const queue: Job[] = [];
let processing = false;

async function extractMemories(threadId: string, userId: string) {
  console.log(`[MemoryAgent] Starting extraction for thread ${threadId}`);

  // Get last 4 messages and existing active memories
  const [recentMessages, existingMemories] = await Promise.all([
    Message.find({ threadId }).sort({ createdAt: -1 }).limit(4),
    findActiveMemories({ userId }).sort({ createdAt: -1 }),
  ]);

  if (recentMessages.length === 0) {
    console.log(`[MemoryAgent] No messages found, skipping`);
    return;
  }

  console.log(`[MemoryAgent] Processing ${recentMessages.length} messages, ${existingMemories.length} existing memories`);

  // Reverse to chronological order
  const messages = recentMessages.reverse();

  // Build conversation with tool calls
  const conversationParts: string[] = [];
  for (const msg of messages) {
    let line = `${msg.role}: ${msg.content}`;
    
    if (msg.role === "assistant" && msg.messageId) {
      const toolCalls = await getMessageToolCalls(msg.messageId);
      if (toolCalls.length > 0) {
        console.log(`[MemoryAgent] Found ${toolCalls.length} tool calls for message`);
        const toolResults = toolCalls
          .map((tc) => `[Tool: ${tc.toolName}] ${JSON.stringify(tc.output)}`)
          .join("\n");
        line = `${msg.role}: ${toolResults}\n${msg.content}`;
      }
    }
    
    conversationParts.push(line);
  }

  const conversation = conversationParts.join("\n");

  // Build existing memories with IDs for consolidation
  const existingMemoriesText = existingMemories.length > 0
    ? `\n\nExisting memories (with IDs):\n${existingMemories.map((m) => `[id: ${m._id}] ${m.content}`).join("\n")}`
    : "";

  const prompt = `Recent conversation:\n${conversation}${existingMemoriesText}`;

  console.log(`[MemoryAgent] Context:\n${prompt}\n`);
  console.log(`[MemoryAgent] Calling LLM...`);
  
  const { memories: outputMemories } = await memoryAgent.generateFromPrompt(prompt, MemoryOutputSchema);

  console.log(`[MemoryAgent] Output:`, JSON.stringify(outputMemories, null, 2));

  if (outputMemories.length === 0) {
    console.log(`[MemoryAgent] No memories to save`);
    return;
  }

  // Build a map of existing memory IDs to their data
  const existingMap = new Map(existingMemories.map((m) => [m._id.toString(), m]));
  const processedIds = new Set<string>();

  for (const output of outputMemories) {
    const sourceIds = output.sourceIds.filter((id) => existingMap.has(id));
    
    if (sourceIds.length === 0) {
      // Brand new memory
      await Memory.create({ threadId, userId, content: output.content });
      console.log(`[MemoryAgent] Created new: ${output.content}`);
    } else if (sourceIds.length === 1) {
      // Single source - update if content changed
      const sourceId = sourceIds[0];
      const existing = existingMap.get(sourceId)!;
      processedIds.add(sourceId);
      
      if (existing.content !== output.content) {
        await Memory.findByIdAndUpdate(sourceId, { content: output.content });
        console.log(`[MemoryAgent] Updated: ${output.content}`);
      }
    } else {
      // Multiple sources - consolidate (sum access counts, keep oldest, soft delete rest)
      const sourceMemories = sourceIds.map((id) => existingMap.get(id)!);
      sourceIds.forEach((id) => processedIds.add(id));
      
      // Sum access counts
      const totalAccessCount = sourceMemories.reduce((sum, m) => sum + (m.accessCount || 0), 0);
      
      // Find most recent lastAccessedAt
      const lastAccessedAt = sourceMemories
        .map((m) => m.lastAccessedAt)
        .filter((d): d is Date => d !== null)
        .sort((a, b) => b.getTime() - a.getTime())[0] || null;

      // Collect all original memory IDs (including any previously consolidated ones)
      const allOriginalIds = new Set<string>();
      for (const m of sourceMemories) {
        allOriginalIds.add(m._id.toString());
        // Include any IDs this memory was already consolidated from
        if (m.consolidatedFromIds?.length > 0) {
          for (const id of m.consolidatedFromIds) {
            allOriginalIds.add(id.toString());
          }
        }
      }

      // Keep oldest, soft delete rest
      const sorted = sourceMemories.sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      const keepId = sorted[0]._id;
      const deleteIds = sorted.slice(1).map((m) => m._id);

      // Remove the kept ID from consolidatedFromIds (it's the current memory, not a source)
      allOriginalIds.delete(keepId.toString());

      console.log(`[MemoryAgent] Consolidating ${sourceMemories.length} memories → "${output.content}" (accessCount: ${totalAccessCount}, sources: ${Array.from(allOriginalIds).join(', ')})`);

      await Memory.findByIdAndUpdate(keepId, {
        content: output.content,
        accessCount: totalAccessCount,
        lastAccessedAt,
        consolidatedFromIds: Array.from(allOriginalIds),
      });

      if (deleteIds.length > 0) {
        await softDeleteMemories(deleteIds);
      }
    }
  }

  // Soft delete any existing memories not included in output (LLM decided to remove them)
  const removedIds = existingMemories
    .filter((m) => !processedIds.has(m._id.toString()))
    .map((m) => m._id);

  if (removedIds.length > 0) {
    console.log(`[MemoryAgent] Soft-deleting ${removedIds.length} obsolete memories`);
    await softDeleteMemories(removedIds);
  }

  // Expire old, rarely-used memories (deterministic, data-based)
  await expireMemories(userId);

  console.log(`[MemoryAgent] Memory update complete`);
}

async function processQueue() {
  if (processing) return;
  processing = true;

  while (queue.length > 0) {
    const job = queue.shift()!;
    try {
      await extractMemories(job.threadId, job.userId);
    } catch (error) {
      console.error("[MemoryAgent] Error:", error);
    }
  }

  processing = false;
}

/**
 * Queue a thread for memory extraction
 * Call this after a user message is saved
 */
export function queueMemoryExtraction(threadId: string, userId: string) {
  console.log(`[MemoryAgent] Queued thread ${threadId}`);
  queue.push({ threadId, userId });
  processQueue();
}
