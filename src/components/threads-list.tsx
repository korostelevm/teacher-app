"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

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

  useEffect(() => {
    const fetchThreads = async () => {
      try {
        const response = await fetch("/api/threads");
        const data = await response.json();
        setThreads(data.threads || []);
      } catch (error) {
        console.error("Failed to fetch threads:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchThreads();
  }, []);

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

