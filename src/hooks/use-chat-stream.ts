"use client";

import { useCallback, useRef } from "react";
import Ably from "ably";
import { useAbly } from "@/hooks/use-ably";

interface UseChatStreamOptions {
  chatEndpoint: string;
  onTextChunk: (chunk: string) => void;
  onComplete: (finalResponse: string) => void;
  onError: (error: Error) => void;
}

export interface ChatResponse {
  messageId: string;
  channel: string;
  threadId: string;
  timestamp: string;
}

/**
 * Custom hook for handling chat streaming via Ably
 */
export function useChatStream({
  chatEndpoint,
  onTextChunk,
  onComplete,
  onError,
}: UseChatStreamOptions) {
  const ably = useAbly();
  const channelRef = useRef<ReturnType<Ably.Realtime["channels"]["get"]> | null>(null);
  const subscriptionsRef = useRef<Array<() => void>>([]);

  const sendMessage = useCallback(
    async (content: string, assistantMessageId: string, threadId?: string | null): Promise<ChatResponse> => {
      if (!ably) {
        throw new Error("Ably not connected. Please wait a moment and try again.");
      }

      // Wait for connection to be established
      if (ably.connection.state !== "connected") {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Ably connection timeout"));
          }, 5000);

          ably.connection.once("connected", () => {
            clearTimeout(timeout);
            resolve();
          });

          ably.connection.once("failed", () => {
            clearTimeout(timeout);
            reject(new Error("Ably connection failed"));
          });
        });
      }

      // Use the assistantMessageId as the request message ID
      const requestMessageId = assistantMessageId;

      // Subscribe to the channel for this message
      const channel = ably.channels.get(`chat:${requestMessageId}`);
      channelRef.current = channel;

      // Clear previous subscriptions
      subscriptionsRef.current.forEach((unsub) => unsub());
      subscriptionsRef.current = [];

      // Set up event handlers for streaming
      const unsubscribeText = () => {
        channel.unsubscribe("stream:text");
      };
      channel.subscribe("stream:text", (message) => {
        const data = message.data as { text: string; messageId: string };
        if (data.messageId === requestMessageId) {
          onTextChunk(data.text);
        }
      });

      const unsubscribeComplete = () => {
        channel.unsubscribe("stream:complete");
      };
      channel.subscribe("stream:complete", (message) => {
        const data = message.data as {
          messageId: string;
          finalResponse: string;
        };
        if (data.messageId === requestMessageId) {
          onComplete(data.finalResponse);
          // Unsubscribe all handlers after completion
          unsubscribeText();
          unsubscribeComplete();
          unsubscribeError();
        }
      });

      const unsubscribeError = () => {
        channel.unsubscribe("stream:error");
      };
      channel.subscribe("stream:error", (message) => {
        const data = message.data as {
          messageId: string;
          error: string;
        };
        if (data.messageId === requestMessageId) {
          console.error("[Chat] Stream error:", data.error);
          onError(new Error(data.error));
          // Unsubscribe all handlers after error
          unsubscribeText();
          unsubscribeComplete();
          unsubscribeError();
        }
      });

      subscriptionsRef.current = [
        unsubscribeText,
        unsubscribeComplete,
        unsubscribeError,
      ];

      // Send request to chat endpoint
      const response = await fetch(chatEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content, messageId: requestMessageId, threadId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to send message");
      }

      return await response.json();
    },
    [
      ably,
      chatEndpoint,
      onTextChunk,
      onComplete,
      onError,
    ]
  );

  return { sendMessage };
}
