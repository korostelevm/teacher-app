"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";

interface Memory {
  _id: string;
  content: string;
  createdAt: string;
}

export function MemoriesList() {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMemories = async () => {
    try {
      const response = await fetch("/api/memories");
      const data = await response.json();
      setMemories(data.memories || []);
    } catch (error) {
      console.error("Failed to fetch memories:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemories();
    // Refresh every 10 seconds to pick up new memories
    const interval = setInterval(fetchMemories, 10000);
    return () => clearInterval(interval);
  }, []);

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
            <Card key={memory._id} className="p-3">
              <div className="text-sm">{memory.content}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {new Date(memory.createdAt).toLocaleDateString()}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

