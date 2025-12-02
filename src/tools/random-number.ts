import { z } from "zod";
import { registerTool } from "./registry";
import type { ToolContext } from "./types";

/**
 * Tool that generates a random number within a specified range
 */
registerTool("generateRandomNumber", {
  description: "Generate a random number between a minimum and maximum value",
  inputSchema: z.object({
    min: z.number().describe("Minimum value (inclusive)"),
    max: z.number().describe("Maximum value (inclusive)"),
  }),
  execute: async (
    { min, max }: { min: number; max: number },
    { ctx }: { ctx: ToolContext }
  ) => {
    const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
    console.log(`[Tool] Random number generated for user: ${ctx.user.displayName}`);
    return {
      number: randomNumber,
      range: { min, max },
      generatedFor: ctx.user.displayName,
    };
  },
});

