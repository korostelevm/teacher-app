"use client";

import { ChatContainer } from "@/components/chat/chat-container";
import { ProfileMenu } from "@/components/profile-menu";
import { ThreadsList } from "@/components/threads-list";
import { MemoriesList } from "@/components/memories-list";
import { Message } from "@/types/chat";
import { useTheme } from "next-themes";
import { useUser } from "@/hooks/use-user";
import { useAbly } from "@/hooks/use-ably";
import { Sparkles, BookOpen, Brain, Loader2 } from "lucide-react";

import React, { useState, useEffect } from "react";

/**
 * WelcomeHero component shown when no thread is active
 */
function WelcomeHero({ onStart, isReady }: { onStart: () => void; isReady: boolean }) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-2xl text-center space-y-8">
        {/* Hero Icon */}
        <div className="flex justify-center">
          <div className="relative">
            <div className="absolute inset-0 blur-2xl bg-violet-500/30 rounded-full" />
            <div className="relative bg-gradient-to-br from-violet-500 to-fuchsia-500 p-6 rounded-3xl">
              <Sparkles className="h-16 w-16 text-white" />
            </div>
          </div>
        </div>

        {/* Heading */}
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white via-violet-200 to-fuchsia-200 bg-clip-text text-transparent">
            Your AI Lesson Planning Assistant
          </h1>
          <p className="text-lg text-slate-400 leading-relaxed">
            Create engaging, standards-aligned lesson plans in minutes. 
            I'll help you design activities, assessments, and differentiated 
            instruction tailored to your students' needs.
          </p>
        </div>

        {/* Feature Pills */}
        <div className="flex flex-wrap justify-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-full border border-slate-700">
            <BookOpen className="h-4 w-4 text-violet-400" />
            <span className="text-sm text-slate-300">Standards-Aligned</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-full border border-slate-700">
            <Brain className="h-4 w-4 text-fuchsia-400" />
            <span className="text-sm text-slate-300">Remembers Your Preferences</span>
          </div>
        </div>

        {/* CTA Button */}
        <button
          type="button"
          onClick={onStart}
          disabled={!isReady}
          className="group relative px-8 py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-xl font-semibold text-white text-lg shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          <span className="relative z-10 flex items-center gap-2">
            {isReady ? (
              <>
                Let's Get Started
                <Sparkles className="h-5 w-5 group-hover:rotate-12 transition-transform" />
              </>
            ) : (
              <>
                Connecting...
                <Loader2 className="h-5 w-5 animate-spin" />
              </>
            )}
          </span>
        </button>

        <p className="text-sm text-slate-500">
          Start a conversation to create your first lesson plan
        </p>
      </div>
    </div>
  );
}

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
  const [showChat, setShowChat] = useState(false);
  const [isAblyConnected, setIsAblyConnected] = useState(false);
  
  // Initialize Ably connection early - this starts connecting immediately
  const ably = useAbly();
  
  // Track Ably connection status
  useEffect(() => {
    if (!ably) return;
    
    const handleConnected = () => setIsAblyConnected(true);
    const handleDisconnected = () => setIsAblyConnected(false);
    
    // Check current state
    if (ably.connection.state === "connected") {
      setIsAblyConnected(true);
    }
    
    ably.connection.on("connected", handleConnected);
    ably.connection.on("disconnected", handleDisconnected);
    ably.connection.on("failed", handleDisconnected);
    
    return () => {
      ably.connection.off("connected", handleConnected);
      ably.connection.off("disconnected", handleDisconnected);
      ably.connection.off("failed", handleDisconnected);
    };
  }, [ably]);

  const handleMessageSent = (message: Message) => {
    console.log("Message sent:", message);
  };

  const handleError = (error: Error) => {
    console.error("Error:", error);
  };

  const handleSelectThread = (threadId: string | null) => {
    setSelectedThreadId(threadId);
    if (threadId) {
      setShowChat(true);
    }
  };

  const [triggerGreeting, setTriggerGreeting] = useState(false);

  const handleStartChat = () => {
    setShowChat(true);
    setTriggerGreeting(true);
  };

  // Show chat if a thread is selected OR if user clicked "Let's Get Started"
  const shouldShowChat = showChat || selectedThreadId !== null;
  
  // Only trigger greeting for new chats, not when selecting existing threads
  const shouldTriggerGreeting = triggerGreeting && selectedThreadId === null;

  return (
    <div className={`${theme ?? "dark"} h-screen flex flex-col`}>
      <div className="flex justify-between items-center p-4 border-b">
        <h1 className="font-semibold">Magic School</h1>
        <ProfileMenu user={user} />
      </div>
      <div className="flex-1 overflow-hidden flex">
        <div className="w-64 border-r overflow-auto">
          <ThreadsList onSelectThread={handleSelectThread} selectedThreadId={selectedThreadId} />
        </div>
        <div className="flex-1 overflow-hidden">
          {shouldShowChat ? (
            <ChatContainer
              threadId={selectedThreadId}
              onMessageSent={handleMessageSent}
              onError={handleError}
              user={user}
              triggerInitialGreeting={shouldTriggerGreeting}
            />
          ) : (
            <WelcomeHero onStart={handleStartChat} isReady={isAblyConnected} />
          )}
        </div>
        <div className="w-72 border-l overflow-auto">
          <MemoriesList />
        </div>
      </div>
    </div>
  );
}

export default ChatClient;
