import type { z } from "zod";
import type { ToolContext } from "./types";

/**
 * Base tool definition shape
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BaseTool = {
  description: string;
  inputSchema: z.ZodType<any>;
  execute: (params: any, options: { ctx: ToolContext }) => Promise<any>;
};

/**
 * Tool registry - stores all registered tools
 */
const toolRegistry: Record<string, BaseTool> = {};

/**
 * Register a tool with the registry
 * @param name - Unique tool name
 * @param tool - Tool definition
 */
export function registerTool(name: string, tool: BaseTool) {
  if (toolRegistry[name]) {
    console.warn(`[Tools] Tool "${name}" is already registered, overwriting`);
  }
  toolRegistry[name] = tool;
}

/**
 * Get all registered tools
 */
export function getToolRegistry() {
  return toolRegistry;
}

/**
 * Get all registered tool names
 */
export function getRegisteredToolNames() {
  return Object.keys(toolRegistry);
}

