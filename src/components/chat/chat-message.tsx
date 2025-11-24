"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { BotIcon, FileIcon, ImageIcon, UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";

/**
 * Props interface for the ChatMessage component
 * @interface ChatMessageProps
 */
interface ChatMessageProps {
  /** 
   * Message object containing content and metadata
   */
  message: {
    /** The text content of the message */
    content: string;
    /** Indicates whether the message is from the user or the AI assistant */
    role: "user" | "assistant";
    /** Optional array of files attached to the message */
    files?: File[];
    /** Optional debug information to display with the message */
    debug?: string;
  };
}

/**
 * ChatMessage component that displays a single message in the chat interface,
 * including the sender's avatar, message content, attached files, and debug information.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {Object} props.message - The message object containing content and metadata
 * @param {string} props.message.content - The text content of the message
 * @param {('user'|'assistant')} props.message.role - Indicates if message is from user or AI
 * @param {File[]} [props.message.files] - Optional array of attached files
 * @param {string} [props.message.debug] - Optional debug information to display
 * @returns {JSX.Element} A message bubble with avatar and content
 */
export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <Avatar className={cn(isUser ? "bg-slate-700" : "bg-muted")}>
        <AvatarFallback>
          {isUser ? 
            <UserIcon data-testid="user-icon" /> : 
            <BotIcon data-testid="bot-icon" />
          }
        </AvatarFallback>
      </Avatar>
      <Card className={cn("p-4 max-w-[80%] ", isUser ? "bg-muted" : "bg-slate-700")}>
        <ReactMarkdown className="text-sm whitespace-pre-wrap prose dark:prose-invert prose-sm">
          {message.content}
        </ReactMarkdown>
        {message.files && message.files.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.files.map((file, index) => (
              <div
                key={index.toString()}
                className="flex items-center gap-2 bg-background/10 p-2 rounded-md"
              >
                {file.type.startsWith("image/") ? (
                  <ImageIcon className="h-4 w-4" />
                ) : (
                  <FileIcon className="h-4 w-4" />
                )}
                <span className="text-xs truncate max-w-[150px]">
                  {file.name}
                </span>
              </div>
            ))}
          </div>
        )}
        {message.debug && (
          <pre className="mt-2 p-2 bg-background/10 rounded-md text-xs overflow-x-auto">
            {message.debug}
          </pre>
        )}
      </Card>
    </div>
  );
}
