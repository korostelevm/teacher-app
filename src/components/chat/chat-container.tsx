"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessage } from "@/components/chat/chat-message";
import { useRef, useState, useEffect, useCallback } from "react";
import type { Message } from "@/types/chat";

/**
 * Props interface for the ChatContainer component
 * @interface ChatContainerProps
 */
export interface ChatContainerProps {
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
  className = "",
  uploadEndpoint = "/api/upload",
  chatEndpoint = "/api/chat",
  onMessageSent,
  onError,
}: ChatContainerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const handleSendMessage = async (content: string, files?: File[]) => {
    // Add user message immediately
    const messageId = crypto.randomUUID();
    const newMessage: Message = {
      id: messageId,
      content,
      role: "user",
      files,
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

    // Send message to chat endpoint
    setIsLoading(true);
    try {
      const response = await fetch(chatEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const data = await response.json();

      // Add assistant message
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        content: data.message,
        role: "assistant",
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chat error:", error);
      // Add error message as assistant message
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        content: "Sorry, there was an error processing your message. Please try again.",
        role: "assistant",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
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
      className={`container max-w-7xl mx-auto h-[calc(100vh-2rem)] p-4 ${className}`}
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
