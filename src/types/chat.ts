/**
 * Represents a chat message in the application
 * @typedef {Object} Message
 * @property {string} id - Unique identifier for the message
 * @property {string} content - The text content of the message
 * @property {"user" | "assistant"} role - Indicates whether the message is from the user or AI assistant
 * @property {File[]} [files] - Optional array of files attached to the message
 * @property {string} [debug] - Optional debug information associated with the message
 */
export type Message = {
  id: string;
  content: string;
  role: "user" | "assistant";
  files?: File[];
  debug?: string;
};
