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

import { createToolCall } from "@/models/tool-call";
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
      const startTime = performance.now();
      const result = await tool.execute(params, { ctx });
      const durationMs = Math.round(performance.now() - startTime);

      // Log tool call to database
      await createToolCall({
        threadId: ctx.threadId,
        messageId: ctx.messageId,
        toolName,
        input: params as Record<string, unknown>,
        output: result as Record<string, unknown>,
        userId: ctx.user._id,
        durationMs,
      });

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

