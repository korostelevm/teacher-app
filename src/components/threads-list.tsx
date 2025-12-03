"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { useAbly } from "@/hooks/use-ably";
import { useUser } from "@/hooks/use-user";

interface Thread {
  _id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ThreadsListProps {
  onSelectThread: (threadId: string) => void;
  selectedThreadId: string | null;
}

export function ThreadsList({ onSelectThread, selectedThreadId }: ThreadsListProps) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const ably = useAbly();
  const { user } = useUser();

  const fetchThreads = useCallback(async () => {
    try {
      const response = await fetch("/api/threads");
      const data = await response.json();
      setThreads(data.threads || []);
    } catch (error) {
      console.error("Failed to fetch threads:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // Subscribe to real-time thread updates
  useEffect(() => {
    if (!ably || !user?._id) return;

    const channel = ably.channels.get(`user:${user._id}`);
    
    const handleThreadUpdate = () => {
      console.log("[ThreadsList] Received thread update, refetching list");
      fetchThreads();
    };

    const handleThreadCreate = () => {
      console.log("[ThreadsList] Received new thread, refetching list");
      fetchThreads();
    };

    channel.subscribe("thread:update", handleThreadUpdate);
    channel.subscribe("thread:create", handleThreadCreate);
    console.log(`[ThreadsList] Subscribed to user:${user._id} for thread events`);

    return () => {
      channel.unsubscribe("thread:update", handleThreadUpdate);
      channel.unsubscribe("thread:create", handleThreadCreate);
    };
  }, [ably, user?._id, fetchThreads]);

  if (loading) {
    return <div className="p-4">Loading threads...</div>;
  }

  return (
    <div className="p-4 space-y-2">
      <h2 className="text-lg font-semibold mb-4">Threads</h2>
      {threads.length === 0 ? (
        <p className="text-sm text-muted-foreground">No threads yet</p>
      ) : (
        <div className="space-y-2">
          {threads.map((thread) => (
            <Card
              key={thread._id}
              onClick={() => onSelectThread(thread._id)}
              className={`p-3 cursor-pointer transition-colors ${
                selectedThreadId === thread._id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent"
              }`}
            >
              <div className="font-medium text-sm">{thread.title}</div>
              <div className="text-xs opacity-70">
                {new Date(thread.createdAt).toLocaleDateString()}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

