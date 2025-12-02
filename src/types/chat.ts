/**
 * Represents user information associated with a message
 * @typedef {Object} MessageAuthor
 * @property {string} displayName - The display name of the user
 * @property {string} email - The email of the user
 * @property {string} [photo] - Optional photo URL of the user
 */
export type MessageAuthor = {
  displayName: string;
  email: string;
  photo?: string;
};

/**
 * Represents a tool call made by the AI assistant
 */
export type ToolCall = {
  toolName: string;
  status: "running" | "complete";
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  durationMs?: number;
};

/**
 * Represents a memory that was referenced in a response
 */
export type MemoryUsed = {
  id: string;
  content: string;
  deleted?: boolean;
};

/**
 * Represents a chat message in the application
 * @typedef {Object} Message
 * @property {string} id - Unique identifier for the message
 * @property {string} content - The text content of the message
 * @property {"user" | "assistant"} role - Indicates whether the message is from the user or AI assistant
 * @property {File[]} [files] - Optional array of files attached to the message
 * @property {string} [debug] - Optional debug information associated with the message
 * @property {MessageAuthor} [author] - Optional user information of the message author
 * @property {ToolCall[]} [toolCalls] - Optional array of tool calls made during this message
 */
export type Message = {
  id: string;
  content: string;
  role: "user" | "assistant";
  files?: File[];
  debug?: string;
  author?: MessageAuthor;
  toolCalls?: ToolCall[];
  memoriesUsed?: MemoryUsed[];
};
