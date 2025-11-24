/**
 * Validation Schemas
 * 
 * Zod schemas for structured outputs and data validation
 */

import { z } from "zod";

// Example: Chat message validation
export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  timestamp: z.string().datetime().optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// TODO: Add your domain-specific schemas here