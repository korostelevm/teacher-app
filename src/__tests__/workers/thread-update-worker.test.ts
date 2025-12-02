/**
 * Tests for the Memory Worker (thread-update-worker.ts)
 *
 * Tests memory extraction, consolidation, and expiration logic.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { Types } from "mongoose";

// Mock all external dependencies before importing the module
vi.mock("@/models/message", () => ({
  Message: {
    find: vi.fn(),
  },
}));

vi.mock("@/models/memory", () => ({
  Memory: {
    create: vi.fn(),
    find: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    updateMany: vi.fn(),
  },
  findActiveMemories: vi.fn(),
  softDeleteMemories: vi.fn(),
  expireMemories: vi.fn(),
}));

vi.mock("@/models/tool-call", () => ({
  getMessageToolCalls: vi.fn(),
}));

vi.mock("@/models/lesson-plan", () => ({
  getUserLessonPlans: vi.fn(),
}));

vi.mock("@/core/agent", () => ({
  Agent: vi.fn().mockImplementation(() => ({
    generateFromPrompt: vi.fn(),
  })),
}));

// Import after mocking
import { Message } from "@/models/message";
import {
  Memory,
  findActiveMemories,
  softDeleteMemories,
  expireMemories,
} from "@/models/memory";
import { getMessageToolCalls } from "@/models/tool-call";
import { getUserLessonPlans } from "@/models/lesson-plan";
import { Agent } from "@/core/agent";

// Helper to create mock ObjectId - converts a simple id to valid 24-char hex
const mockObjectId = (id: string) => {
  // Convert to hex and pad to 24 chars
  const hex = Buffer.from(id).toString("hex").slice(0, 24).padStart(24, "0");
  return new Types.ObjectId(hex);
};

// Helper to create sortable mock query
const mockSortableQuery = (data: unknown[]) => ({
  sort: vi.fn().mockReturnValue({
    limit: vi.fn().mockResolvedValue(data),
  }),
});

const mockSortableQueryNoLimit = (data: unknown[]) => ({
  sort: vi.fn().mockResolvedValue(data),
});

describe("Memory Worker", () => {
  let mockAgentInstance: { generateFromPrompt: Mock };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock agent instance
    mockAgentInstance = {
      generateFromPrompt: vi.fn(),
    };
    (Agent as unknown as Mock).mockImplementation(() => mockAgentInstance);
  });

  describe("queueMemoryExtraction", () => {
    it("should queue jobs and process them", async () => {
      // Import the function fresh to get new module state
      const { queueMemoryExtraction } = await import(
        "@/workers/thread-update-worker"
      );

      const threadId = mockObjectId("thread1").toString();
      const userId = mockObjectId("user1").toString();

      // Setup mocks for empty state (no messages)
      (Message.find as Mock).mockReturnValue(
        mockSortableQuery([])
      );
      (findActiveMemories as Mock).mockReturnValue(
        mockSortableQueryNoLimit([])
      );
      (getUserLessonPlans as Mock).mockResolvedValue([]);

      // Queue the job
      queueMemoryExtraction(threadId, userId);

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should have attempted to fetch messages
      expect(Message.find).toHaveBeenCalledWith({ threadId });
    });
  });

  describe("extractMemories (via queueMemoryExtraction)", () => {
    it("should skip extraction when no messages exist", async () => {
      const { queueMemoryExtraction } = await import(
        "@/workers/thread-update-worker"
      );

      const threadId = mockObjectId("thread2").toString();
      const userId = mockObjectId("user2").toString();

      // No messages
      (Message.find as Mock).mockReturnValue(mockSortableQuery([]));
      (findActiveMemories as Mock).mockReturnValue(
        mockSortableQueryNoLimit([])
      );
      (getUserLessonPlans as Mock).mockResolvedValue([]);

      queueMemoryExtraction(threadId, userId);
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Agent should not be called when no messages
      expect(mockAgentInstance.generateFromPrompt).not.toHaveBeenCalled();
    });

    it("should extract new memories from conversation", async () => {
      // Need to re-import to get fresh module with new Agent mock
      vi.resetModules();

      // Re-setup mocks after reset
      vi.doMock("@/models/message", () => ({
        Message: {
          find: vi.fn(),
        },
      }));
      vi.doMock("@/models/memory", () => ({
        Memory: {
          create: vi.fn(),
          find: vi.fn(),
          findByIdAndUpdate: vi.fn(),
        },
        findActiveMemories: vi.fn(),
        softDeleteMemories: vi.fn(),
        expireMemories: vi.fn(),
      }));
      vi.doMock("@/models/tool-call", () => ({
        getMessageToolCalls: vi.fn().mockResolvedValue([]),
      }));
      vi.doMock("@/models/lesson-plan", () => ({
        getUserLessonPlans: vi.fn().mockResolvedValue([]),
      }));

      const mockGenerate = vi.fn().mockResolvedValue({
        memories: [
          {
            content: "User teaches 7th grade math",
            sourceIds: [],
            lessonPlanId: null,
          },
        ],
      });

      vi.doMock("@/core/agent", () => ({
        Agent: vi.fn().mockImplementation(() => ({
          generateFromPrompt: mockGenerate,
        })),
      }));

      const { Message: MockMessage } = await import("@/models/message");
      const {
        Memory: MockMemory,
        findActiveMemories: mockFindActive,
        expireMemories: mockExpire,
      } = await import("@/models/memory");
      const { queueMemoryExtraction } = await import(
        "@/workers/thread-update-worker"
      );

      const threadId = mockObjectId("thread3").toString();
      const userId = mockObjectId("user3").toString();

      // Setup messages
      const mockMessages = [
        {
          _id: mockObjectId("msg1"),
          role: "user",
          content: "I teach 7th grade math",
          messageId: null,
        },
        {
          _id: mockObjectId("msg2"),
          role: "assistant",
          content: "Great! How can I help with your 7th grade class?",
          messageId: "resp-1",
        },
      ];

      (MockMessage.find as Mock).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([...mockMessages].reverse()),
        }),
      });

      (mockFindActive as Mock).mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      });

      (MockMemory.create as Mock).mockResolvedValue({
        _id: mockObjectId("mem1"),
        content: "User teaches 7th grade math",
      });

      (mockExpire as Mock).mockResolvedValue({ expiredCount: 0, expiredIds: [] });

      queueMemoryExtraction(threadId, userId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should create a new memory
      expect(MockMemory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId,
          userId,
          content: "User teaches 7th grade math",
          lessonPlanId: null,
        })
      );
    });

    it("should consolidate overlapping memories", async () => {
      vi.resetModules();

      const memId1 = mockObjectId("mem1");
      const memId2 = mockObjectId("mem2");

      vi.doMock("@/models/message", () => ({
        Message: {
          find: vi.fn(),
        },
      }));

      vi.doMock("@/models/memory", () => ({
        Memory: {
          create: vi.fn(),
          find: vi.fn(),
          findByIdAndUpdate: vi.fn(),
        },
        findActiveMemories: vi.fn(),
        softDeleteMemories: vi.fn(),
        expireMemories: vi.fn(),
      }));

      vi.doMock("@/models/tool-call", () => ({
        getMessageToolCalls: vi.fn().mockResolvedValue([]),
      }));

      vi.doMock("@/models/lesson-plan", () => ({
        getUserLessonPlans: vi.fn().mockResolvedValue([]),
      }));

      // LLM returns consolidated memory
      const mockGenerate = vi.fn().mockResolvedValue({
        memories: [
          {
            content: "User prefers hands-on activities for teaching",
            sourceIds: [memId1.toString(), memId2.toString()],
            lessonPlanId: null,
          },
        ],
      });

      vi.doMock("@/core/agent", () => ({
        Agent: vi.fn().mockImplementation(() => ({
          generateFromPrompt: mockGenerate,
        })),
      }));

      const { Message: MockMessage } = await import("@/models/message");
      const {
        Memory: MockMemory,
        findActiveMemories: mockFindActive,
        softDeleteMemories: mockSoftDelete,
        expireMemories: mockExpire,
      } = await import("@/models/memory");
      const { queueMemoryExtraction } = await import(
        "@/workers/thread-update-worker"
      );

      const threadId = mockObjectId("thread4").toString();
      const userId = mockObjectId("user4").toString();

      // Existing memories to consolidate
      const existingMemories = [
        {
          _id: memId1,
          content: "User likes hands-on activities",
          accessCount: 3,
          lastAccessedAt: new Date("2024-01-01"),
          createdAt: new Date("2024-01-01"),
          consolidatedFromIds: [],
        },
        {
          _id: memId2,
          content: "User prefers interactive teaching",
          accessCount: 2,
          lastAccessedAt: new Date("2024-01-15"),
          createdAt: new Date("2024-01-10"),
          consolidatedFromIds: [],
        },
      ];

      (MockMessage.find as Mock).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { _id: mockObjectId("msg1"), role: "user", content: "test" },
          ]),
        }),
      });

      (mockFindActive as Mock).mockReturnValue({
        sort: vi.fn().mockResolvedValue(existingMemories),
      });

      (MockMemory.findByIdAndUpdate as Mock).mockResolvedValue({});
      (mockSoftDelete as Mock).mockResolvedValue(undefined);
      (mockExpire as Mock).mockResolvedValue({ expiredCount: 0, expiredIds: [] });

      queueMemoryExtraction(threadId, userId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should update oldest memory with consolidated content
      expect(MockMemory.findByIdAndUpdate).toHaveBeenCalledWith(
        memId1,
        expect.objectContaining({
          content: "User prefers hands-on activities for teaching",
          accessCount: 5, // Sum of 3 + 2
        })
      );

      // Should soft delete the newer memory
      expect(mockSoftDelete).toHaveBeenCalledWith([memId2]);
    });

    it("should update existing memory when content changes", async () => {
      vi.resetModules();

      const memId = mockObjectId("mem1");

      vi.doMock("@/models/message", () => ({
        Message: { find: vi.fn() },
      }));

      vi.doMock("@/models/memory", () => ({
        Memory: {
          create: vi.fn(),
          find: vi.fn(),
          findByIdAndUpdate: vi.fn(),
        },
        findActiveMemories: vi.fn(),
        softDeleteMemories: vi.fn(),
        expireMemories: vi.fn(),
      }));

      vi.doMock("@/models/tool-call", () => ({
        getMessageToolCalls: vi.fn().mockResolvedValue([]),
      }));

      vi.doMock("@/models/lesson-plan", () => ({
        getUserLessonPlans: vi.fn().mockResolvedValue([]),
      }));

      // LLM returns updated memory
      const mockGenerate = vi.fn().mockResolvedValue({
        memories: [
          {
            content: "User teaches 8th grade math (updated from 7th)",
            sourceIds: [memId.toString()],
            lessonPlanId: null,
          },
        ],
      });

      vi.doMock("@/core/agent", () => ({
        Agent: vi.fn().mockImplementation(() => ({
          generateFromPrompt: mockGenerate,
        })),
      }));

      const { Message: MockMessage } = await import("@/models/message");
      const {
        Memory: MockMemory,
        findActiveMemories: mockFindActive,
        expireMemories: mockExpire,
      } = await import("@/models/memory");
      const { queueMemoryExtraction } = await import(
        "@/workers/thread-update-worker"
      );

      const threadId = mockObjectId("thread5").toString();
      const userId = mockObjectId("user5").toString();

      const existingMemory = {
        _id: memId,
        content: "User teaches 7th grade math",
        accessCount: 1,
        lastAccessedAt: null,
        createdAt: new Date(),
        lessonPlanId: null,
        consolidatedFromIds: [],
      };

      (MockMessage.find as Mock).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { _id: mockObjectId("msg1"), role: "user", content: "Actually I teach 8th grade now" },
          ]),
        }),
      });

      (mockFindActive as Mock).mockReturnValue({
        sort: vi.fn().mockResolvedValue([existingMemory]),
      });

      (MockMemory.findByIdAndUpdate as Mock).mockResolvedValue({});
      (mockExpire as Mock).mockResolvedValue({ expiredCount: 0, expiredIds: [] });

      queueMemoryExtraction(threadId, userId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should update the memory content
      expect(MockMemory.findByIdAndUpdate).toHaveBeenCalledWith(
        memId.toString(),
        expect.objectContaining({
          content: "User teaches 8th grade math (updated from 7th)",
        })
      );
    });

    it("should include tool call results in conversation context", async () => {
      vi.resetModules();

      vi.doMock("@/models/message", () => ({
        Message: { find: vi.fn() },
      }));

      vi.doMock("@/models/memory", () => ({
        Memory: { create: vi.fn(), find: vi.fn(), findByIdAndUpdate: vi.fn() },
        findActiveMemories: vi.fn(),
        softDeleteMemories: vi.fn(),
        expireMemories: vi.fn(),
      }));

      const mockGetToolCalls = vi.fn().mockResolvedValue([
        {
          toolName: "createLessonPlan",
          output: { id: "lp123", title: "Fractions Lesson" },
        },
      ]);

      vi.doMock("@/models/tool-call", () => ({
        getMessageToolCalls: mockGetToolCalls,
      }));

      vi.doMock("@/models/lesson-plan", () => ({
        getUserLessonPlans: vi.fn().mockResolvedValue([]),
      }));

      const mockGenerate = vi.fn().mockResolvedValue({ memories: [] });

      vi.doMock("@/core/agent", () => ({
        Agent: vi.fn().mockImplementation(() => ({
          generateFromPrompt: mockGenerate,
        })),
      }));

      const { Message: MockMessage } = await import("@/models/message");
      const { findActiveMemories: mockFindActive, expireMemories: mockExpire } =
        await import("@/models/memory");
      const { queueMemoryExtraction } = await import(
        "@/workers/thread-update-worker"
      );

      const threadId = mockObjectId("thread6").toString();
      const userId = mockObjectId("user6").toString();

      (MockMessage.find as Mock).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              _id: mockObjectId("msg1"),
              role: "assistant",
              content: "I created a lesson plan for you",
              messageId: "resp-123",
            },
          ]),
        }),
      });

      (mockFindActive as Mock).mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      });

      (mockExpire as Mock).mockResolvedValue({ expiredCount: 0, expiredIds: [] });

      queueMemoryExtraction(threadId, userId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should fetch tool calls for assistant messages
      expect(mockGetToolCalls).toHaveBeenCalledWith("resp-123");
    });

    it("should soft delete memories removed by LLM", async () => {
      vi.resetModules();

      const memIdToKeep = mockObjectId("mem1");
      const memIdToDelete = mockObjectId("mem2");

      vi.doMock("@/models/message", () => ({
        Message: { find: vi.fn() },
      }));

      vi.doMock("@/models/memory", () => ({
        Memory: { create: vi.fn(), find: vi.fn(), findByIdAndUpdate: vi.fn() },
        findActiveMemories: vi.fn(),
        softDeleteMemories: vi.fn(),
        expireMemories: vi.fn(),
      }));

      vi.doMock("@/models/tool-call", () => ({
        getMessageToolCalls: vi.fn().mockResolvedValue([]),
      }));

      vi.doMock("@/models/lesson-plan", () => ({
        getUserLessonPlans: vi.fn().mockResolvedValue([]),
      }));

      // LLM returns only one memory - the other should be soft deleted
      const mockGenerate = vi.fn().mockResolvedValue({
        memories: [
          {
            content: "User teaches 7th grade math",
            sourceIds: [memIdToKeep.toString()],
            lessonPlanId: null,
          },
        ],
      });

      vi.doMock("@/core/agent", () => ({
        Agent: vi.fn().mockImplementation(() => ({
          generateFromPrompt: mockGenerate,
        })),
      }));

      const { Message: MockMessage } = await import("@/models/message");
      const {
        Memory: MockMemory,
        findActiveMemories: mockFindActive,
        softDeleteMemories: mockSoftDelete,
        expireMemories: mockExpire,
      } = await import("@/models/memory");
      const { queueMemoryExtraction } = await import(
        "@/workers/thread-update-worker"
      );

      const threadId = mockObjectId("thread7").toString();
      const userId = mockObjectId("user7").toString();

      // Two existing memories - LLM will only keep one
      const existingMemories = [
        {
          _id: memIdToKeep,
          content: "User teaches 7th grade math",
          accessCount: 2,
          createdAt: new Date("2024-01-01"),
          lessonPlanId: null,
          consolidatedFromIds: [],
        },
        {
          _id: memIdToDelete,
          content: "Outdated information that should be removed",
          accessCount: 0,
          createdAt: new Date("2024-01-10"),
          lessonPlanId: null,
          consolidatedFromIds: [],
        },
      ];

      (MockMessage.find as Mock).mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            { _id: mockObjectId("msg1"), role: "user", content: "test" },
          ]),
        }),
      });

      (mockFindActive as Mock).mockReturnValue({
        sort: vi.fn().mockResolvedValue(existingMemories),
      });

      (MockMemory.findByIdAndUpdate as Mock).mockResolvedValue({});
      (mockSoftDelete as Mock).mockResolvedValue(undefined);
      (mockExpire as Mock).mockResolvedValue({ expiredCount: 0, expiredIds: [] });

      queueMemoryExtraction(threadId, userId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should soft delete the memory that LLM didn't include in output
      expect(mockSoftDelete).toHaveBeenCalledWith([memIdToDelete]);
    });
  });
});

