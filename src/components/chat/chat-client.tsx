"use client";

import { ChatContainer } from "@/components/chat/chat-container";
import { Message } from "@/types/chat";
import { useTheme } from "next-themes";

import React from "react";

/**
 * ChatClient component that provides a chat interface with message history,
 * file upload capabilities, and message sending functionality.
 * 
 * @component
 * @returns {React.JSX.Element} A chat interface with message history and input controls
 */
function ChatClient(): React.JSX.Element {
  const { theme } = useTheme();

  const handleMessageSent = (message: Message) => {
    console.log("Message sent:", message);
  };

  const handleError = (error: Error) => {
    console.error("Error:", error);
  };

  return (
    <div className={`${theme ?? "dark"}`}>
      <ChatContainer
        onMessageSent={handleMessageSent}
        onError={handleError}
      />
    </div>
  );
}

export default ChatClient;
