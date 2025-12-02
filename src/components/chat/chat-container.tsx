"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessage } from "@/components/chat/chat-message";
import { useRef, useState, useEffect, useCallback } from "react";
import type { Message } from "@/types/chat";
import { useChatStream } from "@/hooks/use-chat-stream";
import type { User } from "@/hooks/use-user";

/**
 * Props interface for the ChatContainer component
 * @interface ChatContainerProps
 */
export interface ChatContainerProps {
  /**
   * Optional thread ID to load messages from
   */
  threadId?: string | null;

  /**
   * Optional CSS class name to apply custom styles
   * @default ""
   */
  className?: string;

  /**
   * API endpoint for handling file uploads
   * @default "/api/upload"
   */
  uploadEndpoint?: string;

  /**
   * API endpoint for chat message processing
   * @default "/api/chat"
   */
  chatEndpoint?: string;

  /**
   * Optional callback fired when a message is successfully sent
   * @param message The message that was sent
   */
  onMessageSent?: (message: Message) => void;

  /**
   * Optional callback fired when an error occurs
   * @param error The error that occurred
   */
  onError?: (error: Error) => void;

  /**
   * Optional user object containing current user information
   */
  user?: User | null;
}

/**
 * ChatContainer component that provides a complete chat interface with message history,
 * file upload capabilities, and message sending functionality.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {string} [props.className=""] - Optional CSS class name for custom styling
 * @param {string} [props.uploadEndpoint="/api/upload"] - API endpoint for handling file uploads
 * @param {string} [props.chatEndpoint="/api/chat"] - API endpoint for processing chat messages
 * @param {function} [props.onMessageSent] - Optional callback fired when a message is sent successfully
 * @param {function} [props.onError] - Optional callback fired when an error occurs
 * @returns {JSX.Element} A chat interface with message history and input controls
 */
export function ChatContainer({
  threadId: initialThreadId,
  className = "",
  uploadEndpoint = "/api/upload",
  chatEndpoint = "/api/chat",
  onMessageSent,
  onError,
  user,
}: ChatContainerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(initialThreadId || null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Track current assistant message
  const currentAssistantMessageIdRef = useRef<string | null>(null);

  // Load messages when thread changes
  useEffect(() => {
    if (initialThreadId) {
      setThreadId(initialThreadId);
      const loadMessages = async () => {
        try {
          const response = await fetch(`/api/threads/${initialThreadId}/messages`);
          if (!response.ok) {
            throw new Error(`Failed to load messages: ${response.status} ${response.statusText}`);
          }
          const data = await response.json();
          const dbMessages = data.messages || [];
          // Convert DB messages to Message type
          const displayMessages: Message[] = dbMessages.map((msg: any) => ({
            id: msg.id,
            content: msg.content,
            role: msg.role,
            author: msg.author,
            toolCalls: msg.toolCalls,
          }));
          setMessages(displayMessages);
        } catch (error) {
          console.error("Failed to load thread messages:", error);
          onError?.(error instanceof Error ? error : new Error("Failed to load thread messages"));
        }
      };
      loadMessages();
    } else {
      setMessages([]);
      setThreadId(null);
    }
  }, [initialThreadId]);

  // Use chat stream hook for streaming
  const { sendMessage } = useChatStream({
    chatEndpoint,
    onTextChunk: (chunk) => {
      if (currentAssistantMessageIdRef.current) {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === currentAssistantMessageIdRef.current) {
              return { ...msg, content: msg.content + chunk };
            }
            return msg;
          })
        );
      }
    },
    onComplete: async (finalResponse) => {
      setIsLoading(false);
      
      const messageId = currentAssistantMessageIdRef.current;
      
      // Update final message with response
      if (messageId) {
        setMessages((prev) =>
          prev.map((msg) => {
            if (msg.id === messageId) {
              return {
                ...msg,
                content: finalResponse || msg.content || "No response generated.",
              };
            }
            return msg;
          })
        );
        
        // Fetch full tool call details from API
        try {
          const response = await fetch(`/api/tool-calls/${messageId}`);
          if (response.ok) {
            const data = await response.json();
            if (data.toolCalls?.length > 0) {
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === messageId
                    ? { ...msg, toolCalls: data.toolCalls }
                    : msg
                )
              );
            }
          }
        } catch (error) {
          console.error("Failed to fetch tool calls:", error);
        }
      }
      
      currentAssistantMessageIdRef.current = null;
    },
    onError: (error) => {
      console.error("Chat stream error:", error);
      setIsLoading(false);
      
      if (currentAssistantMessageIdRef.current) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === currentAssistantMessageIdRef.current
              ? {
                  ...msg,
                  content: error.message || "Sorry, there was an error processing your message.",
                }
              : msg
          )
        );
      }
      
      onError?.(error);
      currentAssistantMessageIdRef.current = null;
    },
    onToolStart: async (toolName) => {
      const messageId = currentAssistantMessageIdRef.current;
      if (messageId) {
        // Fetch tool calls from DB (includes the new one with input)
        try {
          const response = await fetch(`/api/tool-calls/${messageId}`);
          if (response.ok) {
            const data = await response.json();
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === messageId ? { ...msg, toolCalls: data.toolCalls } : msg
              )
            );
          }
        } catch (error) {
          console.error("Failed to fetch tool calls:", error);
        }
      }
    },
    onToolComplete: async (toolName) => {
      const messageId = currentAssistantMessageIdRef.current;
      if (messageId) {
        // Fetch updated tool calls from DB (includes output)
        try {
          const response = await fetch(`/api/tool-calls/${messageId}`);
          if (response.ok) {
            const data = await response.json();
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === messageId ? { ...msg, toolCalls: data.toolCalls } : msg
              )
            );
          }
        } catch (error) {
          console.error("Failed to fetch tool calls:", error);
        }
      }
    },
  });

  const handleSendMessage = async (content: string, files?: File[]) => {
    // Add user message immediately
    const messageId = crypto.randomUUID();
    const newMessage: Message = {
      id: messageId,
      content,
      role: "user",
      files,
      author: user ? {
        displayName: user.displayName,
        email: user.email,
        photo: user.photo,
      } : undefined,
    };
    setMessages((prev) => [...prev, newMessage]);
    onMessageSent?.(newMessage);

    // Handle file upload if files are present
    if (files?.length) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        for (const file of files) {
          formData.append("file", file);
        }

        const response = await fetch(uploadEndpoint, {
          method: "POST",
          body: formData,
        });

        const data = await response.json();
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? { ...msg, debug: JSON.stringify(data, null, 2) }
              : msg,
          ),
        );
      } catch (error) {
        console.error("Upload error:", error);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  debug: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
                }
              : msg,
          ),
        );
        onError?.(error as Error);
      } finally {
        setIsUploading(false);
      }
    }

    // Send message to chat endpoint and stream response via Ably
    setIsLoading(true);
    const assistantMessageId = crypto.randomUUID();
    currentAssistantMessageIdRef.current = assistantMessageId;
    
    // Create placeholder assistant message for streaming
    const assistantMessage: Message = {
      id: assistantMessageId,
      content: "", // Empty content - UI will show "Thinking..." when empty
      role: "assistant",
      toolCalls: [], // Initialize for streaming tool calls
    };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      const response = await sendMessage(content, assistantMessageId, threadId);
      // Store thread ID from response for subsequent messages
      if (response?.threadId && !threadId) {
        setThreadId(response.threadId);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setIsLoading(false);
      
      // Update assistant message with error
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: error instanceof Error 
                  ? `Sorry, there was an error: ${error.message}` 
                  : "Sorry, there was an error processing your message. Please try again.",
              }
            : msg
        )
      );
      onError?.(error as Error);
      currentAssistantMessageIdRef.current = null;
    }
  };

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom =
      Math.abs(target.scrollHeight - target.clientHeight - target.scrollTop) < 10;
    setShouldAutoScroll(isAtBottom);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    scrollToBottomImmediate();
  }, [messages]);

// Separate scroll handler for immediate scrolling (no smooth behavior)
const scrollToBottomImmediate = useCallback(() => {
  if (!messagesEndRef.current) return;

  messagesEndRef.current.scrollIntoView({
    block: "end",
  });
}, []);

  // Scroll to bottom of chat when messages change.
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollEndElement = scrollAreaRef.current.querySelector("#chat-scroll-end");
      if (scrollEndElement) {
        scrollEndElement.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [messages]);

  return (
    <div
      className={`h-full w-full flex flex-col ${className}`}
    >
      <Card className="h-full flex flex-col">
        <ScrollArea
          ref={scrollAreaRef}
          className="flex-1 p-4"
          onScroll={handleScroll}
          onChange={() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
          }}
        >
          <div className="space-y-4">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            <div ref={messagesEndRef} className="py-4" />
          </div>
        </ScrollArea>
        <div className="border-t border-border p-4">
          <ChatInput
            onSendMessage={handleSendMessage}
            isUploading={isUploading}
            isLoading={isLoading}
          />
        </div>
      </Card>
    </div>
  );
}
