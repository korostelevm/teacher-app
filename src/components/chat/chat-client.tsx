"use client";

import { ChatContainer } from "@/components/chat/chat-container";
import { ProfileMenu } from "@/components/profile-menu";
import { ThreadsList } from "@/components/threads-list";
import { Message } from "@/types/chat";
import { useTheme } from "next-themes";
import { useUser } from "@/hooks/use-user";

import React, { useState } from "react";

/**
 * ChatClient component that provides a chat interface with message history,
 * file upload capabilities, and message sending functionality.
 * 
 * @component
 * @returns {React.JSX.Element} A chat interface with message history and input controls
 */
function ChatClient(): React.JSX.Element {
  const { theme } = useTheme();
  const { user } = useUser();
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  const handleMessageSent = (message: Message) => {
    console.log("Message sent:", message);
  };

  const handleError = (error: Error) => {
    console.error("Error:", error);
  };

  return (
    <div className={`${theme ?? "dark"} h-screen flex flex-col`}>
      <div className="flex justify-between items-center p-4 border-b">
        <h1 className="font-semibold">Magic School RAG</h1>
        <ProfileMenu user={user} />
      </div>
      <div className="flex-1 overflow-hidden flex gap-4">
        <div className="w-64 border-r overflow-auto">
          <ThreadsList onSelectThread={setSelectedThreadId} selectedThreadId={selectedThreadId} />
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatContainer
            threadId={selectedThreadId}
          onMessageSent={handleMessageSent}
          onError={handleError}
        />
        </div>
      </div>
    </div>
  );
}

export default ChatClient;
