"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { BotIcon, FileIcon, ImageIcon, UserIcon, WrenchIcon, Loader2Icon, CheckCircleIcon, ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import type { Message, ToolCall } from "@/types/chat";

/**
 * Props interface for the ToolCallItem component
 */
interface ToolCallItemProps {
  toolCall: ToolCall;
  index: number;
}

/**
 * Individual tool call display with expandable details
 */
function ToolCallItem({ toolCall, index }: ToolCallItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasDetails = toolCall.input || toolCall.output;

  return (
    <div
      key={index.toString()}
      className={cn(
        "text-xs rounded-md overflow-hidden",
        toolCall.status === "running"
          ? "bg-amber-500/20 text-amber-300"
          : "bg-emerald-500/20 text-emerald-300"
      )}
    >
      <button
        type="button"
        onClick={() => hasDetails && setIsExpanded(!isExpanded)}
        className={cn(
          "flex items-center gap-2 px-2 py-1 w-full text-left",
          hasDetails && "cursor-pointer hover:bg-white/5"
        )}
        disabled={!hasDetails}
      >
        {hasDetails && (
          isExpanded 
            ? <ChevronDownIcon className="h-3 w-3" /> 
            : <ChevronRightIcon className="h-3 w-3" />
        )}
        <WrenchIcon className="h-3 w-3" />
        <span className="font-mono">{toolCall.toolName}</span>
        {toolCall.durationMs !== undefined && (
          <span className="text-[10px] opacity-70">{toolCall.durationMs}ms</span>
        )}
        {toolCall.status === "running" ? (
          <Loader2Icon className="h-3 w-3 animate-spin ml-auto" />
        ) : (
          <CheckCircleIcon className="h-3 w-3 ml-auto" />
        )}
      </button>
      {isExpanded && hasDetails && (
        <div className="px-2 pb-2 space-y-2 border-t border-white/10">
          {toolCall.input && (
            <div>
              <div className="text-[10px] uppercase tracking-wide opacity-50 mt-2 mb-1">Input</div>
              <pre className="text-[11px] bg-black/20 p-2 rounded overflow-x-auto">
                {JSON.stringify(toolCall.input, null, 2)}
              </pre>
            </div>
          )}
          {toolCall.output && (
            <div>
              <div className="text-[10px] uppercase tracking-wide opacity-50 mt-2 mb-1">Output</div>
              <pre className="text-[11px] bg-black/20 p-2 rounded overflow-x-auto">
                {JSON.stringify(toolCall.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Props interface for the ChatMessage component
 * @interface ChatMessageProps
 */
interface ChatMessageProps {
  /** 
   * Message object containing content and metadata
   */
  message: Message;
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
        {isUser && message.author?.photo && (
          <AvatarImage src={message.author.photo} alt={message.author.displayName} />
        )}
        <AvatarFallback>
          {isUser ? 
            <UserIcon data-testid="user-icon" /> : 
            <BotIcon data-testid="bot-icon" />
          }
        </AvatarFallback>
      </Avatar>
      <Card className={cn("p-4 max-w-[80%] ", isUser ? "bg-muted" : "bg-slate-700")}>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="mb-2 space-y-1">
            {message.toolCalls.map((toolCall, index) => (
              <ToolCallItem key={index.toString()} toolCall={toolCall} index={index} />
            ))}
          </div>
        )}
        {message.content ? (
          <ReactMarkdown className="text-sm whitespace-pre-wrap prose dark:prose-invert prose-sm">
            {message.content}
          </ReactMarkdown>
        ) : (
          <div className="text-sm text-muted-foreground italic">Thinking...</div>
        )}
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
