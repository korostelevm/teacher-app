/**
 * Tests for the Thread Namer Worker (thread-namer-worker.ts)
 *
 * Tests thread title generation based on conversation content.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { Types } from "mongoose";

// Mock all external dependencies before importing the module
vi.mock("@/models/message", () => ({
  Message: {
    find: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

vi.mock("@/models/thread", () => ({
  Thread: {
    findById: vi.fn(),
    findByIdAndUpdate: vi.fn(),
  },
}));

vi.mock("@/core/agent", () => ({
  Agent: vi.fn().mockImplementation(() => ({
    generateFromPrompt: vi.fn(),
  })),
}));

// Helper to create mock ObjectId - converts a simple id to valid 24-char hex
const mockObjectId = (id: string) => {
  const hex = Buffer.from(id).toString("hex").slice(0, 24).padStart(24, "0");
  return new Types.ObjectId(hex);
};

describe("Thread Namer Worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("queueThreadNaming", () => {
    it("should queue thread for naming and process it", async () => {
      vi.resetModules();

      vi.doMock("@/models/message", () => ({
        Message: {
          find: vi.fn(),
          countDocuments: vi.fn(),
        },
      }));

      vi.doMock("@/models/thread", () => ({
        Thread: {
          findById: vi.fn(),
          findByIdAndUpdate: vi.fn(),
        },
      }));

      vi.doMock("@/lib/ably", () => ({
        publishThreadUpdate: vi.fn(),
      }));

      const mockGenerate = vi.fn().mockResolvedValue({
        title: "7th Grade Fractions Lesson",
      });

      vi.doMock("@/core/agent", () => ({
        Agent: vi.fn().mockImplementation(() => ({
          generateFromPrompt: mockGenerate,
        })),
      }));

      const { Message } = await import("@/models/message");
      const { Thread } = await import("@/models/thread");
      const { queueThreadNaming } = await import(
        "@/workers/thread-namer-worker"
      );

      const threadId = mockObjectId("thread1").toString();

      // Setup mocks - thread with 2 messages and default title
      (Thread.findById as Mock).mockResolvedValue({
        _id: mockObjectId("thread1"),
        title: "Chat - 12/1/2024",
        ownerId: mockObjectId("user1"),
      });

      (Message.countDocuments as Mock).mockResolvedValue(2);

      (Message.find as Mock).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              _id: mockObjectId("msg1"),
              role: "user",
              content: "I need help creating a lesson on fractions for 7th grade",
            },
            {
              _id: mockObjectId("msg2"),
              role: "assistant",
              content:
                "I'd be happy to help you create a fractions lesson for 7th grade!",
            },
          ]),
        }),
      });

      (Thread.findByIdAndUpdate as Mock).mockResolvedValue({});

      queueThreadNaming(threadId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should have called the LLM
      expect(mockGenerate).toHaveBeenCalled();

      // Should have updated the thread title
      expect(Thread.findByIdAndUpdate).toHaveBeenCalledWith(threadId, {
        title: "7th Grade Fractions Lesson",
      });
    });

    it("should skip threads with message counts outside 2-5 range", async () => {
      vi.resetModules();

      vi.doMock("@/models/message", () => ({
        Message: {
          find: vi.fn(),
          countDocuments: vi.fn(),
        },
      }));

      vi.doMock("@/models/thread", () => ({
        Thread: {
          findById: vi.fn(),
          findByIdAndUpdate: vi.fn(),
        },
      }));

      const mockGenerate = vi.fn();

      vi.doMock("@/core/agent", () => ({
        Agent: vi.fn().mockImplementation(() => ({
          generateFromPrompt: mockGenerate,
        })),
      }));

      const { Message } = await import("@/models/message");
      const { Thread } = await import("@/models/thread");
      const { queueThreadNaming } = await import(
        "@/workers/thread-namer-worker"
      );

      const threadId = mockObjectId("thread2").toString();

      (Thread.findById as Mock).mockResolvedValue({
        _id: mockObjectId("thread2"),
        title: "Chat - 12/1/2024",
      });

      // Thread has 6 messages - should skip (outside 2-5 range)
      (Message.countDocuments as Mock).mockResolvedValue(6);

      queueThreadNaming(threadId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should NOT call the LLM
      expect(mockGenerate).not.toHaveBeenCalled();

      // Should NOT update the thread
      expect(Thread.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("should run on 3rd message (greeting flow - AI starts)", async () => {
      vi.resetModules();

      vi.doMock("@/models/message", () => ({
        Message: {
          find: vi.fn(),
          countDocuments: vi.fn(),
        },
      }));

      vi.doMock("@/models/thread", () => ({
        Thread: {
          findById: vi.fn(),
          findByIdAndUpdate: vi.fn(),
        },
      }));

      vi.doMock("@/lib/ably", () => ({
        publishThreadUpdate: vi.fn(),
      }));

      const mockGenerate = vi.fn().mockResolvedValue({
        title: "Fractions Help Request",
      });

      vi.doMock("@/core/agent", () => ({
        Agent: vi.fn().mockImplementation(() => ({
          generateFromPrompt: mockGenerate,
        })),
      }));

      const { Message } = await import("@/models/message");
      const { Thread } = await import("@/models/thread");
      const { queueThreadNaming } = await import(
        "@/workers/thread-namer-worker"
      );

      const threadId = mockObjectId("thread2c").toString();

      (Thread.findById as Mock).mockResolvedValue({
        _id: mockObjectId("thread2c"),
        title: "Chat - 12/1/2024",
        ownerId: mockObjectId("user1"),
      });

      // Thread has 3 messages (greeting flow: AI greeting + user + AI response)
      (Message.countDocuments as Mock).mockResolvedValue(3);

      (Message.find as Mock).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { role: "assistant", content: "Hello! How can I help you today?" },
            { role: "user", content: "I need help with fractions" },
            { role: "assistant", content: "Sure, let me help you with that!" },
          ]),
        }),
      });

      (Thread.findByIdAndUpdate as Mock).mockResolvedValue({});

      queueThreadNaming(threadId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should call the LLM
      expect(mockGenerate).toHaveBeenCalled();

      // Should update the thread
      expect(Thread.findByIdAndUpdate).toHaveBeenCalledWith(threadId, {
        title: "Fractions Help Request",
      });
    });

    it("should run on 4th message for better context", async () => {
      vi.resetModules();

      vi.doMock("@/models/message", () => ({
        Message: {
          find: vi.fn(),
          countDocuments: vi.fn(),
        },
      }));

      vi.doMock("@/models/thread", () => ({
        Thread: {
          findById: vi.fn(),
          findByIdAndUpdate: vi.fn(),
        },
      }));

      vi.doMock("@/lib/ably", () => ({
        publishThreadUpdate: vi.fn(),
      }));

      const mockGenerate = vi.fn().mockResolvedValue({
        title: "Fraction Word Problems Lesson",
      });

      vi.doMock("@/core/agent", () => ({
        Agent: vi.fn().mockImplementation(() => ({
          generateFromPrompt: mockGenerate,
        })),
      }));

      const { Message } = await import("@/models/message");
      const { Thread } = await import("@/models/thread");
      const { queueThreadNaming } = await import(
        "@/workers/thread-namer-worker"
      );

      const threadId = mockObjectId("thread2b").toString();

      (Thread.findById as Mock).mockResolvedValue({
        _id: mockObjectId("thread2b"),
        title: "Chat - 12/1/2024",
        ownerId: mockObjectId("user1"),
      });

      // Thread has 4 messages - should process
      (Message.countDocuments as Mock).mockResolvedValue(4);

      (Message.find as Mock).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { role: "user", content: "Help with fractions" },
            { role: "assistant", content: "Sure! What grade level?" },
            { role: "user", content: "7th grade, focus on word problems" },
            { role: "assistant", content: "Great, let me create that for you" },
          ]),
        }),
      });

      (Thread.findByIdAndUpdate as Mock).mockResolvedValue({});

      queueThreadNaming(threadId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should call the LLM with 4 messages of context
      expect(mockGenerate).toHaveBeenCalled();

      // Should update the thread
      expect(Thread.findByIdAndUpdate).toHaveBeenCalledWith(threadId, {
        title: "Fraction Word Problems Lesson",
      });
    });

    it("should skip threads with custom titles", async () => {
      vi.resetModules();

      vi.doMock("@/models/message", () => ({
        Message: {
          find: vi.fn(),
          countDocuments: vi.fn(),
        },
      }));

      vi.doMock("@/models/thread", () => ({
        Thread: {
          findById: vi.fn(),
          findByIdAndUpdate: vi.fn(),
        },
      }));

      const mockGenerate = vi.fn();

      vi.doMock("@/core/agent", () => ({
        Agent: vi.fn().mockImplementation(() => ({
          generateFromPrompt: mockGenerate,
        })),
      }));

      const { Message } = await import("@/models/message");
      const { Thread } = await import("@/models/thread");
      const { queueThreadNaming } = await import(
        "@/workers/thread-namer-worker"
      );

      const threadId = mockObjectId("thread3").toString();

      // Thread already has a custom title (doesn't start with "Chat - ")
      (Thread.findById as Mock).mockResolvedValue({
        _id: mockObjectId("thread3"),
        title: "My Custom Thread Title",
      });

      (Message.countDocuments as Mock).mockResolvedValue(2);

      queueThreadNaming(threadId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should NOT call the LLM
      expect(mockGenerate).not.toHaveBeenCalled();

      // Should NOT update the thread
      expect(Thread.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it("should skip if thread not found", async () => {
      vi.resetModules();

      vi.doMock("@/models/message", () => ({
        Message: {
          find: vi.fn(),
          countDocuments: vi.fn(),
        },
      }));

      vi.doMock("@/models/thread", () => ({
        Thread: {
          findById: vi.fn(),
          findByIdAndUpdate: vi.fn(),
        },
      }));

      const mockGenerate = vi.fn();

      vi.doMock("@/core/agent", () => ({
        Agent: vi.fn().mockImplementation(() => ({
          generateFromPrompt: mockGenerate,
        })),
      }));

      const { Message } = await import("@/models/message");
      const { Thread } = await import("@/models/thread");
      const { queueThreadNaming } = await import(
        "@/workers/thread-namer-worker"
      );

      const threadId = mockObjectId("thread4").toString();

      // Thread not found
      (Thread.findById as Mock).mockResolvedValue(null);
      (Message.countDocuments as Mock).mockResolvedValue(2);

      queueThreadNaming(threadId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should NOT call the LLM
      expect(mockGenerate).not.toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      vi.resetModules();

      vi.doMock("@/models/message", () => ({
        Message: {
          find: vi.fn(),
          countDocuments: vi.fn(),
        },
      }));

      vi.doMock("@/models/thread", () => ({
        Thread: {
          findById: vi.fn(),
          findByIdAndUpdate: vi.fn(),
        },
      }));

      const mockGenerate = vi.fn().mockRejectedValue(new Error("LLM error"));

      vi.doMock("@/core/agent", () => ({
        Agent: vi.fn().mockImplementation(() => ({
          generateFromPrompt: mockGenerate,
        })),
      }));

      const { Message } = await import("@/models/message");
      const { Thread } = await import("@/models/thread");
      const { queueThreadNaming } = await import(
        "@/workers/thread-namer-worker"
      );

      const threadId = mockObjectId("thread5").toString();

      (Thread.findById as Mock).mockResolvedValue({
        _id: mockObjectId("thread5"),
        title: "Chat - 12/1/2024",
      });

      (Message.countDocuments as Mock).mockResolvedValue(2);

      (Message.find as Mock).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { role: "user", content: "Hello" },
            { role: "assistant", content: "Hi!" },
          ]),
        }),
      });

      // Should not throw even if LLM fails
      queueThreadNaming(threadId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should have attempted to call the LLM
      expect(mockGenerate).toHaveBeenCalled();

      // Should NOT have updated the thread (because of error)
      expect(Thread.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });
});

