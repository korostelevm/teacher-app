"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Trash2 } from "lucide-react";
import { useAbly } from "@/hooks/use-ably";
import { useUser } from "@/hooks/use-user";

interface Memory {
  _id: string;
  content: string;
  createdAt: string;
}

export function MemoriesList() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const ably = useAbly();
  const { user } = useUser();

  const fetchMemories = useCallback(async () => {
    try {
      const response = await fetch("/api/memories");
      const data = await response.json();
      setMemories(data.memories || []);
    } catch (error) {
      console.error("Failed to fetch memories:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteMemory = async (memoryId: string) => {
    setDeletingId(memoryId);
    try {
      const response = await fetch("/api/memories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memoryId }),
      });
      
      if (response.ok) {
        setMemories((prev) => prev.filter((m) => m._id !== memoryId));
      } else {
        console.error("Failed to delete memory");
      }
    } catch (error) {
      console.error("Failed to delete memory:", error);
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  // Realtime updates via Ably
  useEffect(() => {
    if (!ably || !user?._id) return;

    const channel = ably.channels.get(`user:${user._id}`);
    const handleMemoryUpdate = () => {
      fetchMemories();
    };

    channel.subscribe("memory:update", handleMemoryUpdate);

    return () => {
      channel.unsubscribe("memory:update", handleMemoryUpdate);
    };
  }, [ably, user?._id, fetchMemories]);

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading memories...</div>;
  }

  return (
    <div className="p-4 space-y-2">
      <h2 className="text-lg font-semibold mb-4">Memories</h2>
      {memories.length === 0 ? (
        <p className="text-sm text-muted-foreground">No memories yet</p>
      ) : (
        <div className="space-y-2">
          {memories.map((memory) => (
            <Card key={memory._id} className="p-3 group relative">
              <div className="text-sm pr-8">{memory.content}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {new Date(memory.createdAt).toLocaleDateString()}
              </div>
              <button
                type="button"
                onClick={() => deleteMemory(memory._id)}
                disabled={deletingId === memory._id}
                className="absolute top-2 right-2 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                title="Delete memory"
              >
                <Trash2 className={`h-4 w-4 ${deletingId === memory._id ? 'animate-pulse' : ''}`} />
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

