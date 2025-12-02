import { generateText, generateObject, type ModelMessage } from "ai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { openaiClient, getRawOpenAI } from "@/lib/openai";
import {
  publishStreamText,
  publishStreamComplete,
  publishStreamError,
} from "@/lib/ably";
import { Message, createMessage, type IMessage } from "@/models/message";
import { getMessageToolCalls } from "@/models/tool-call";
import { Memory, type IMemory, recordMemoryAccess, findActiveMemories } from "@/models/memory";
import { User, type IUser } from "@/models/user";
import { createTools } from "@/tools";

export interface AgentConfig {
  systemPrompt?: string;
  toolNames?: string[];
  model?: string;
  systemId: string;
}

export class Agent {
  readonly systemPrompt?: string;
  readonly toolNames?: string[];
  readonly model: string;
  readonly systemId: string;

  constructor(config: AgentConfig) {
    this.systemPrompt = config.systemPrompt;
    this.toolNames = config.toolNames;
    this.model = config.model || process.env.OPENAI_MODEL || "gpt-4o-mini";
    this.systemId = config.systemId;
  }

  /**
   * Simple generate - no streaming, no persistence
   */
  async generate<T = string>(
    messages: ModelMessage[],
    schema?: z.ZodType<T>
  ): Promise<T> {
    if (schema) {
      const { object } = await generateObject({
        model: openaiClient()(this.model),
        system: this.systemPrompt,
        messages,
        schema,
      });
      return object as T;
    }
    const { text } = await generateText({
      model: openaiClient()(this.model),
      system: this.systemPrompt,
      messages,
    });
    return text as T;
  }

  /**
   * Generate from a prompt string
   */
  async generateFromPrompt<T = string>(prompt: string, schema?: z.ZodType<T>): Promise<T> {
    return this.generate([{ role: "user", content: prompt }], schema);
  }

  /**
   * Create a streaming response to a thread (for chat)
   * Outputs structured JSON but streams only the response text
   */
  async createResponse(params: {
    threadId: string;
    responseMessageId: string;
    userId: string;
  }): Promise<string> {
    const { threadId, responseMessageId, userId } = params;

    try {
      const [user, threadMessages, memories] = await Promise.all([
        User.findById(userId),
        Message.find({ threadId }).sort({ createdAt: 1 }),
        findActiveMemories({ userId }).sort({ createdAt: -1 }),
      ]);

      if (!user) throw new Error(`User not found: ${userId}`);

      // If no messages, this is an init request - agent starts the conversation
      const isInit = threadMessages.length === 0;
      const messages = isInit 
        ? [{ role: "user" as const, content: "Start a new conversation" }]
        : await this.buildMessages(threadMessages);
      
      // Log context being sent to LLM
      console.log(`[ChatAgent] Loaded ${memories.length} memories for user`);
      console.log(`[ChatAgent] Context (${messages.length} messages):`);
      for (const msg of messages) {
        const preview = typeof msg.content === 'string' 
          ? msg.content.slice(0, 200) + (msg.content.length > 200 ? '...' : '')
          : JSON.stringify(msg.content).slice(0, 200);
        console.log(`  ${msg.role}: ${preview}`);
      }
      
      const tools = createTools(
        { user: user as IUser, threadId, messageId: responseMessageId },
        this.toolNames
      );

      // Build schema with memory ID enum constraint
      const memoryIds = (memories as IMemory[]).map((m) => m._id.toString());
      console.log(`[ChatAgent] Available memory IDs for enum: ${JSON.stringify(memoryIds)}`);
      const ResponseSchema = memoryIds.length > 0
        ? z.object({
            memoriesReferenced: z.array(z.enum(memoryIds as [string, ...string[]])).describe("IDs of memories you used to inform your response. Include all relevant memory IDs."),
            response: z.string().describe("Your conversational reply to the user. Do not mention memory IDs here."),
          })
        : z.object({
            memoriesReferenced: z.array(z.string()).describe("Memory IDs (empty if none available)"),
            response: z.string().describe("Your conversational reply to the user."),
          });

      // Build system prompt with user info and memory context included
      const systemPrompt = this.buildSystemPromptWithContext(user as IUser, memories as IMemory[], memoryIds);

      // Use raw OpenAI client with completion loop (handles tools + structured output)
      const openai = getRawOpenAI();
      const currentMessages: ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content as string })),
      ];

      // Convert tools to OpenAI format (tools already have pre-converted JSON Schema parameters)
      const openaiTools: ChatCompletionTool[] = Object.entries(tools).map(([name, tool]) => ({
        type: "function" as const,
        function: {
          name,
          description: (tool as any).description || "",
          parameters: (tool as any).parameters || { type: "object", properties: {} },
        },
      }));

      let responseText = "";
      let referencedMemoryIds: string[] = [];
      const maxPasses = 10;

      // Completion loop - uses streaming throughout, handles tool calls then final structured response
      for (let pass = 1; pass <= maxPasses; pass++) {
        console.log(`[ChatAgent] Pass ${pass}, messages: ${currentMessages.length}, tools: ${openaiTools.length}`);

        // Stream all requests to avoid double API calls
        const stream = await openai.chat.completions.create({
          model: this.model,
          messages: currentMessages,
          tools: openaiTools.length > 0 ? openaiTools : undefined,
          tool_choice: openaiTools.length > 0 ? "auto" : undefined,
          stream: true,
        });

        // Collect the streamed response
        let fullContent = "";
        let toolCalls: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }> = [];
        let finishReason: string | null = null;

        for await (const chunk of stream) {
          const choice = chunk.choices[0];
          if (!choice) continue;

          finishReason = choice.finish_reason || finishReason;
          const delta = choice.delta;

          // Accumulate content
          if (delta?.content) {
            fullContent += delta.content;
          }

          // Accumulate tool calls
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              if (!toolCalls[idx]) {
                toolCalls[idx] = { id: tc.id || "", type: "function", function: { name: "", arguments: "" } };
              }
              if (tc.id) toolCalls[idx].id = tc.id;
              if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
              if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
            }
          }
        }

        console.log(`[ChatAgent] finish_reason: ${finishReason}, tool_calls: ${toolCalls.length}`);

        // Check for tool calls
        if (finishReason === "tool_calls" || toolCalls.length > 0) {
          // Add assistant message with tool calls
          currentMessages.push({
            role: "assistant",
            content: fullContent || null,
            tool_calls: toolCalls,
          } as ChatCompletionMessageParam);

          // Execute tools in parallel when possible
          const toolResults = await Promise.all(
            toolCalls.map(async (tc) => {
              const toolName = tc.function.name;
              const toolFn = (tools as any)[toolName];
              
              let result: string;
              if (toolFn && typeof toolFn.execute === "function") {
                try {
                  const args = JSON.parse(tc.function.arguments);
                  const output = await toolFn.execute(args);
                  result = typeof output === "string" ? output : JSON.stringify(output);
                  console.log(`[ChatAgent] Tool ${toolName} result: ${result.slice(0, 100)}`);
                } catch (err: any) {
                  result = `Error: ${err.message}`;
                  console.error(`[ChatAgent] Tool ${toolName} error:`, err);
                }
              } else {
                result = `Error: Tool ${toolName} not found`;
              }
              return { tool_call_id: tc.id, content: result };
            })
          );

          // Add tool results to messages
          for (const tr of toolResults) {
            currentMessages.push({
              role: "tool",
              tool_call_id: tr.tool_call_id,
              content: tr.content,
            });
          }
          continue; // Loop back for next completion
        }

        // No tool calls - now stream the final structured response
        console.log(`[ChatAgent] Streaming structured final response...`);
        
        const structuredStream = await openai.chat.completions.create({
          model: this.model,
          messages: currentMessages,
          response_format: zodResponseFormat(ResponseSchema, "chat_response"),
          stream: true,
        });

        // Stream and parse the response field as it comes in
        let structuredContent = "";
        let inResponseField = false;
        let responseBuffer = "";
        let streamedLength = 0;

        for await (const chunk of structuredStream) {
          const delta = chunk.choices[0]?.delta?.content || "";
          structuredContent += delta;

          // Look for "response":" pattern to start streaming
          if (!inResponseField) {
            const responseStart = structuredContent.indexOf('"response":"');
            if (responseStart !== -1) {
              inResponseField = true;
              responseBuffer = structuredContent.slice(responseStart + 12); // After "response":"
            }
          } else {
            responseBuffer += delta;
          }

          // Stream new content from response field (handle escapes, stop at closing quote)
          if (inResponseField && responseBuffer.length > streamedLength) {
            // Find unescaped closing quote
            let endIdx = -1;
            for (let i = streamedLength; i < responseBuffer.length; i++) {
              if (responseBuffer[i] === '"' && responseBuffer[i - 1] !== '\\') {
                endIdx = i;
                break;
              }
            }

            const toStream = endIdx === -1 
              ? responseBuffer.slice(streamedLength)
              : responseBuffer.slice(streamedLength, endIdx);

            if (toStream.length > 0) {
              // Unescape JSON string (order matters: backslash first)
              const unescaped = toStream
                .replace(/\\\\/g, '\u0000')  // Temp placeholder for escaped backslashes
                .replace(/\\n/g, '\n')
                .replace(/\\"/g, '"')
                .replace(/\u0000/g, '\\');   // Restore backslashes
              await publishStreamText(responseMessageId, unescaped);
              streamedLength += toStream.length;
            }
          }
        }

        // Parse the complete JSON for memory IDs
        try {
          const parsed = JSON.parse(structuredContent);
          responseText = parsed.response || "";
          referencedMemoryIds = parsed.memoriesReferenced || [];
          console.log(`[ChatAgent] Parsed memories:`, referencedMemoryIds);
        } catch (e) {
          console.error(`[ChatAgent] Failed to parse JSON:`, e);
          responseText = structuredContent;
        }
        break; // Exit loop
      }

      // Log output
      console.log(`[ChatAgent] Output:`);
      console.log(`  Response: ${responseText.slice(0, 300)}${responseText.length > 300 ? '...' : ''}`);
      console.log(`  Memories referenced: ${referencedMemoryIds.length > 0 ? referencedMemoryIds.join(', ') : 'none'}`);

      // Fetch referenced memory details and update access counts
      let memoriesUsed: { id: string; content: string }[] = [];
      if (referencedMemoryIds.length > 0) {
        await recordMemoryAccess(referencedMemoryIds);
        const referencedMemories = await Memory.find({ _id: { $in: referencedMemoryIds } });
        memoriesUsed = referencedMemories.map((m) => ({ 
          id: m._id.toString(), 
          content: m.content 
        }));
      }

      if (responseText.trim()) {
        await createMessage({
          threadId,
          role: "assistant",
          content: responseText,
          authorId: this.systemId,
          messageId: responseMessageId,
          referencedMemories: referencedMemoryIds,
        });
      }

      await publishStreamComplete(responseMessageId, responseText, memoriesUsed);
      return responseText;
    } catch (error) {
      console.error("[Agent] Error:", error);
      try {
        await publishStreamError(
          responseMessageId,
          error instanceof Error ? error.message : "Unknown error"
        );
      } catch {}
      throw error;
    }
  }

  /**
   * Build system prompt with user info and memory context included
   * This keeps context in the system prompt rather than polluting conversation history
   */
  private buildSystemPromptWithContext(user: IUser, memories: IMemory[], memoryIds: string[]): string {
    const basePrompt = this.systemPrompt || "";
    
    // User info section
    const userSection = `
## Current User
You are talking to ${user.displayName} (${user.email}).
Address them by their first name when appropriate.
`;

    // Memories section
    let memoriesSection = "";
    if (memories.length > 0) {
      const memoriesText = memories
        .map((m) => `- [id: ${m._id}] ${m.content}`)
        .join("\n");
      memoriesSection = `
## User Context (Memories)
The following are things you know about this user from previous conversations:
${memoriesText}

When you use information from these memories in your response, include the relevant memory IDs in "memoriesReferenced".
`;
    }

    return `${basePrompt}
${userSection}
${memoriesSection}
## Response Format
Your "response" should be natural and conversational - never mention memory IDs there.
If you use information from the user's memories, include those memory IDs in "memoriesReferenced".`;
  }

  private async buildMessages(messages: IMessage[]): Promise<ModelMessage[]> {
    const result: ModelMessage[] = [];

    for (const msg of messages) {
      let content = msg.content;

      // Include tool call results for assistant messages
      if (msg.role === "assistant" && msg.messageId) {
        const toolCalls = await getMessageToolCalls(msg.messageId);
        if (toolCalls.length > 0) {
          const toolResultsText = toolCalls
            .map((tc) => `[Tool: ${tc.toolName}] ${JSON.stringify(tc.output)}`)
            .join("\n");
          content = `${toolResultsText}\n\n${content}`;
        }
      }

      result.push({ role: msg.role, content });
    }

    return result;
  }
}

// Chat agent - using gpt-4o for better structured output handling
export const chatAgent = new Agent({
  systemId: "000000000000000000000001",
  toolNames: [
    "createLessonPlan",
    "listLessonPlans",
    "getLessonPlan",
    "updateLessonPlan",
    "deleteLessonPlan",
    "addLessonActivity",
    "addLessonAssessment",
    "addLessonDifferentiation",
  ],
  model: "gpt-4o",
  systemPrompt: `You are a helpful AI assistant that specializes in helping teachers create engaging, standards-aligned lesson plans for middle school math (grades 6, 7, and 8 only).

IMPORTANT CONSTRAINTS:
- You can ONLY create lesson plans for grades 6, 7, or 8
- When calling createLessonPlan, gradeLevel MUST be exactly "6", "7", or "8" (as a string)
- If a teacher asks for a different grade level, politely explain you only support middle school math (grades 6-8)

Your capabilities:
- Create comprehensive lesson plans with objectives, activities, assessments, and differentiation strategies
- Align lessons to NC Math Standards for grades 6-8
- Suggest engaging activities and resources appropriate for middle school students
- Help modify existing lesson plans based on teacher feedback
- Remember teacher preferences and teaching context across conversations

Communication style:
- Be warm, supportive, and encouraging
- Ask clarifying questions to understand the teacher's needs
- Provide practical, actionable suggestions
- Keep responses focused and organized

When starting a new conversation (the message is "Start a new conversation"), introduce yourself briefly and ask whether they'd like to work on an existing lesson plan or create a new one. Mention that you specialize in middle school math (grades 6-8). Keep this greeting concise and welcoming.`,
});
