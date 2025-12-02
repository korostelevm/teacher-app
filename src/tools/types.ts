import type { IUser } from "@/models/user";

/**
 * Context passed to tool execute functions
 */
export interface ToolContext {
  user: IUser;
  threadId: string;
  messageId: string;
}

