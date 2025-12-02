/**
 * Tool definitions for the AI agent
 * 
 * Tools allow the LLM to execute functions and receive structured results.
 * 
 * To add a new tool:
 * 1. Create a new file in /tools (e.g., my-tool.ts)
 * 2. Call registerTool("myToolName", { description, inputSchema, execute })
 * 3. Import the file below to trigger registration
 */

// Import tool files to trigger registration (add new tools here)
import "./random-number";
import "./lesson-plan";

import { publishToolStart, publishToolComplete } from "@/lib/ably";
import { startToolCall, completeToolCall } from "@/models/tool-call";
import { getToolRegistry, getRegisteredToolNames, type BaseTool } from "./registry";
import type { ToolContext } from "./types";

/**
 * Wraps a tool with context binding and database logging
 */
function wrapTool(toolName: string, tool: BaseTool, ctx: ToolContext) {
  return {
    description: tool.description,
    inputSchema: tool.inputSchema,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    execute: async (params: any) => {
      const input = params as Record<string, unknown>;
      console.log(`[Tool] ${toolName} starting with input:`, input);

      // Validate input against Zod schema before execution
      const validation = tool.inputSchema.safeParse(params);
      if (!validation.success) {
        const errors = validation.error.issues.map(
          (issue) => `${issue.path.join(".")}: ${issue.message}`
        ).join("; ");
        console.error(`[Tool] ${toolName} validation failed:`, errors);
        throw new Error(`Invalid input: ${errors}`);
      }

      // Save tool call to DB with "running" status
      const savedToolCall = await startToolCall({
        threadId: ctx.threadId,
        messageId: ctx.messageId,
        toolName,
        input,
        userId: ctx.user._id,
      });
      console.log(`[Tool] ${toolName} saved to DB:`, savedToolCall._id);

      // Publish tool call start (frontend will fetch from DB)
      console.log(`[Tool] ${toolName} publishing start event`);
      await publishToolStart(ctx.messageId, toolName);

      const startTime = performance.now();
      const result = await tool.execute(params, { ctx });
      const durationMs = Math.round(performance.now() - startTime);
      const output = result as Record<string, unknown>;
      console.log(`[Tool] ${toolName} completed in ${durationMs}ms with output:`, output);

      // Update tool call in DB with output
      await completeToolCall({
        messageId: ctx.messageId,
        toolName,
        output,
        durationMs,
      });
      console.log(`[Tool] ${toolName} DB updated`);

      // Publish tool call complete (frontend will fetch updated record)
      console.log(`[Tool] ${toolName} publishing complete event`);
      await publishToolComplete(ctx.messageId, toolName);

      return result;
    },
  };
}

/**
 * All available tool names
 */
export const availableToolNames = getRegisteredToolNames();

/**
 * Create tools with context bound to them
 * This allows tools to access user session data and logs tool calls to DB
 * @param ctx - Tool context with user, thread, and message info
 * @param toolNames - Optional list of tool names to include. If not provided, all tools are included.
 */
export function createTools(ctx: ToolContext, toolNames?: string[]) {
  const registry = getToolRegistry();
  const wrappedTools: Record<string, ReturnType<typeof wrapTool>> = {};

  const namesToInclude = toolNames ?? Object.keys(registry);

  for (const name of namesToInclude) {
    const tool = registry[name];
    if (tool) {
      wrappedTools[name] = wrapTool(name, tool, ctx);
    } else {
      console.warn(`[Tools] Unknown tool name: ${name}`);
    }
  }

  return wrappedTools;
}

