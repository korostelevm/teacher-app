/**
 * Tests for the Agent class (agent.ts)
 *
 * Tests agent initialization, message generation, response streaming,
 * tool execution, and memory integration.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { Types } from "mongoose";
import { z } from "zod";

// Mock all external dependencies
vi.mock("ai", () => ({
  generateText: vi.fn(),
  generateObject: vi.fn(),
}));

vi.mock("@/lib/openai", () => ({
  openaiClient: vi.fn(() => vi.fn()),
  getRawOpenAI: vi.fn(),
}));

vi.mock("@/lib/ably", () => ({
  publishStreamText: vi.fn(),
  publishStreamComplete: vi.fn(),
  publishStreamError: vi.fn(),
}));

vi.mock("@/models/message", () => ({
  Message: {
    find: vi.fn(),
  },
  createMessage: vi.fn(),
}));

vi.mock("@/models/memory", () => ({
  Memory: {
    find: vi.fn(),
  },
  findActiveMemories: vi.fn(),
  recordMemoryAccess: vi.fn(),
}));

vi.mock("@/models/user", () => ({
  User: {
    findById: vi.fn(),
  },
}));

vi.mock("@/models/tool-call", () => ({
  getMessageToolCalls: vi.fn(),
}));

vi.mock("@/tools", () => ({
  createTools: vi.fn(),
}));

vi.mock("@/workers/thread-namer-worker", () => ({
  queueThreadNaming: vi.fn(),
}));

// Import after mocking
import { generateText, generateObject } from "ai";
import { openaiClient, getRawOpenAI } from "@/lib/openai";
import {
  publishStreamText,
  publishStreamComplete,
  publishStreamError,
} from "@/lib/ably";
import { Message, createMessage } from "@/models/message";
import { Memory, findActiveMemories, recordMemoryAccess } from "@/models/memory";
import { User } from "@/models/user";
import { getMessageToolCalls } from "@/models/tool-call";
import { createTools } from "@/tools";
import { Agent } from "@/core/agent";

// Helper to create mock ObjectId - converts a simple id to valid 24-char hex
const mockObjectId = (id: string) => {
  // Convert to hex and pad to 24 chars
  const hex = Buffer.from(id).toString("hex").slice(0, 24).padStart(24, "0");
  return new Types.ObjectId(hex);
};

// Helper to create async iterator from array (for mocking streams)
async function* createAsyncIterator<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) {
    yield item;
  }
}

describe("Agent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with provided config", () => {
      const agent = new Agent({
        systemId: "test-system-id",
        systemPrompt: "You are a test assistant",
        toolNames: ["testTool"],
        model: "gpt-4",
      });

      expect(agent.systemId).toBe("test-system-id");
      expect(agent.systemPrompt).toBe("You are a test assistant");
      expect(agent.toolNames).toEqual(["testTool"]);
      expect(agent.model).toBe("gpt-4");
    });

    it("should use default model when not provided", () => {
      const agent = new Agent({
        systemId: "test-system-id",
      });

      expect(agent.model).toBe("gpt-4o-mini");
    });

    it("should use OPENAI_MODEL env var when set", () => {
      const originalEnv = process.env.OPENAI_MODEL;
      process.env.OPENAI_MODEL = "gpt-3.5-turbo";

      const agent = new Agent({
        systemId: "test-system-id",
      });

      expect(agent.model).toBe("gpt-3.5-turbo");
      process.env.OPENAI_MODEL = originalEnv;
    });
  });

  describe("generate", () => {
    it("should generate text without schema", async () => {
      const agent = new Agent({
        systemId: "test-system-id",
        systemPrompt: "Be helpful",
      });

      (generateText as Mock).mockResolvedValue({
        text: "Hello, how can I help?",
      });

      const mockModelFn = vi.fn();
      (openaiClient as Mock).mockReturnValue(() => mockModelFn);

      const result = await agent.generate([
        { role: "user", content: "Hi there" },
      ]);

      expect(result).toBe("Hello, how can I help?");
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          system: "Be helpful",
          messages: [{ role: "user", content: "Hi there" }],
        })
      );
    });

    it("should generate structured object with schema", async () => {
      const agent = new Agent({
        systemId: "test-system-id",
      });

      const TestSchema = z.object({
        answer: z.string(),
        confidence: z.number(),
      });

      (generateObject as Mock).mockResolvedValue({
        object: { answer: "Test answer", confidence: 0.95 },
      });

      const mockModelFn = vi.fn();
      (openaiClient as Mock).mockReturnValue(() => mockModelFn);

      const result = await agent.generate(
        [{ role: "user", content: "What is 2+2?" }],
        TestSchema
      );

      expect(result).toEqual({ answer: "Test answer", confidence: 0.95 });
      expect(generateObject).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: "user", content: "What is 2+2?" }],
          schema: TestSchema,
        })
      );
    });
  });

  describe("generateFromPrompt", () => {
    it("should convert prompt string to message array", async () => {
      const agent = new Agent({
        systemId: "test-system-id",
      });

      (generateText as Mock).mockResolvedValue({
        text: "Response to prompt",
      });

      const mockModelFn = vi.fn();
      (openaiClient as Mock).mockReturnValue(() => mockModelFn);

      const result = await agent.generateFromPrompt("Test prompt");

      expect(result).toBe("Response to prompt");
      expect(generateText).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: "user", content: "Test prompt" }],
        })
      );
    });
  });

  describe("createResponse", () => {
    const userId = mockObjectId("user1").toString();
    const threadId = mockObjectId("thread1").toString();
    const responseMessageId = "msg-12345";

    const mockUser = {
      _id: mockObjectId("user1"),
      displayName: "Test User",
      email: "test@example.com",
    };

    beforeEach(() => {
      // Setup default mocks
      (User.findById as Mock).mockResolvedValue(mockUser);
      (createTools as Mock).mockReturnValue({});
      (getMessageToolCalls as Mock).mockResolvedValue([]);
      (recordMemoryAccess as Mock).mockResolvedValue(undefined);
      (createMessage as Mock).mockResolvedValue({});
      (publishStreamText as Mock).mockResolvedValue(undefined);
      (publishStreamComplete as Mock).mockResolvedValue(undefined);
      (publishStreamError as Mock).mockResolvedValue(undefined);
    });

    it("should throw error when user not found", async () => {
      const agent = new Agent({
        systemId: "test-system-id",
      });

      (User.findById as Mock).mockResolvedValue(null);
      (Message.find as Mock).mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      });
      (findActiveMemories as Mock).mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      });

      await expect(
        agent.createResponse({
          threadId,
          responseMessageId,
          userId,
          channelName: `chat:${userId}:${responseMessageId}`,
        })
      ).rejects.toThrow("User not found");
    });

    it("should handle init request when no messages exist", async () => {
      const agent = new Agent({
        systemId: "test-system-id",
        systemPrompt: "You are helpful",
      });

      // No messages - init case
      (Message.find as Mock).mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      });

      (findActiveMemories as Mock).mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      });

      // Mock OpenAI streaming response
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn(),
          },
        },
      };

      // First call - no tool calls, returns stop
      const streamChunks1 = [
        { choices: [{ delta: { content: "" }, finish_reason: null }] },
        { choices: [{ delta: { content: "" }, finish_reason: "stop" }] },
      ];

      // Second call - structured response
      const structuredResponse = JSON.stringify({
        memoriesReferenced: [],
        response: "Hello! How can I help you today?",
      });

      const streamChunks2 = structuredResponse
        .split("")
        .map((char) => ({
          choices: [{ delta: { content: char }, finish_reason: null }],
        }));
      streamChunks2.push({
        choices: [{ delta: { content: "" }, finish_reason: "stop" }],
      });

      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce(createAsyncIterator(streamChunks1))
        .mockResolvedValueOnce(createAsyncIterator(streamChunks2));

      (getRawOpenAI as Mock).mockReturnValue(mockOpenAI);

      const result = await agent.createResponse({
        threadId,
        responseMessageId,
        userId,
        channelName: `chat:${userId}:${responseMessageId}`,
      });

      expect(result).toBe("Hello! How can I help you today?");
      expect(createMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          threadId,
          role: "assistant",
          content: "Hello! How can I help you today?",
        })
      );
      expect(publishStreamComplete).toHaveBeenCalled();
    });

    it("should build messages from thread history", async () => {
      const agent = new Agent({
        systemId: "test-system-id",
      });

      const threadMessages = [
        {
          _id: mockObjectId("msg1"),
          role: "user",
          content: "Hello",
          messageId: null,
        },
        {
          _id: mockObjectId("msg2"),
          role: "assistant",
          content: "Hi there!",
          messageId: "resp-1",
        },
        {
          _id: mockObjectId("msg3"),
          role: "user",
          content: "How are you?",
          messageId: null,
        },
      ];

      (Message.find as Mock).mockReturnValue({
        sort: vi.fn().mockResolvedValue(threadMessages),
      });

      (findActiveMemories as Mock).mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      });

      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn(),
          },
        },
      };

      const streamChunks1 = [
        { choices: [{ delta: { content: "" }, finish_reason: "stop" }] },
      ];

      const structuredResponse = JSON.stringify({
        memoriesReferenced: [],
        response: "I'm doing great!",
      });

      const streamChunks2 = [
        { choices: [{ delta: { content: structuredResponse }, finish_reason: null }] },
        { choices: [{ delta: { content: "" }, finish_reason: "stop" }] },
      ];

      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce(createAsyncIterator(streamChunks1))
        .mockResolvedValueOnce(createAsyncIterator(streamChunks2));

      (getRawOpenAI as Mock).mockReturnValue(mockOpenAI);

      await agent.createResponse({
        threadId,
        responseMessageId,
        userId,
        channelName: `chat:${userId}:${responseMessageId}`,
      });

      // Verify OpenAI was called with messages from history
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: "system" }),
            expect.objectContaining({ role: "user", content: "Hello" }),
            expect.objectContaining({ role: "assistant", content: "Hi there!" }),
            expect.objectContaining({ role: "user", content: "How are you?" }),
          ]),
        })
      );
    });

    it("should include memories in system prompt", async () => {
      const agent = new Agent({
        systemId: "test-system-id",
        systemPrompt: "Base prompt",
      });

      const memories = [
        {
          _id: mockObjectId("mem1"),
          content: "User teaches 7th grade",
        },
        {
          _id: mockObjectId("mem2"),
          content: "User prefers hands-on activities",
        },
      ];

      (Message.find as Mock).mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      });

      (findActiveMemories as Mock).mockReturnValue({
        sort: vi.fn().mockResolvedValue(memories),
      });

      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn(),
          },
        },
      };

      const streamChunks = [
        { choices: [{ delta: { content: "" }, finish_reason: "stop" }] },
      ];

      const memoryIds = memories.map((m) => m._id.toString());
      const structuredResponse = JSON.stringify({
        memoriesReferenced: [memoryIds[0]],
        response: "Based on your teaching experience...",
      });

      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce(createAsyncIterator(streamChunks))
        .mockResolvedValueOnce(
          createAsyncIterator([
            { choices: [{ delta: { content: structuredResponse }, finish_reason: null }] },
            { choices: [{ delta: { content: "" }, finish_reason: "stop" }] },
          ])
        );

      (getRawOpenAI as Mock).mockReturnValue(mockOpenAI);

      (Memory.find as Mock).mockResolvedValue([memories[0]]);

      await agent.createResponse({
        threadId,
        responseMessageId,
        userId,
        channelName: `chat:${userId}:${responseMessageId}`,
      });

      // Check system prompt contains memory info
      const firstCall = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const systemMessage = firstCall.messages.find(
        (m: { role: string }) => m.role === "system"
      );
      expect(systemMessage.content).toContain("User teaches 7th grade");
      expect(systemMessage.content).toContain("User prefers hands-on activities");

      // Should record memory access
      expect(recordMemoryAccess).toHaveBeenCalledWith([memoryIds[0]]);
    });

    it("should execute tool calls and continue loop", async () => {
      const agent = new Agent({
        systemId: "test-system-id",
        toolNames: ["testTool"],
      });

      (Message.find as Mock).mockReturnValue({
        sort: vi.fn().mockResolvedValue([
          { role: "user", content: "Run the test tool" },
        ]),
      });

      (findActiveMemories as Mock).mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      });

      // Mock tools
      const mockToolExecute = vi.fn().mockResolvedValue({ success: true });
      (createTools as Mock).mockReturnValue({
        testTool: {
          description: "A test tool",
          parameters: { type: "object", properties: {} },
          execute: mockToolExecute,
        },
      });

      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn(),
          },
        },
      };

      // First call returns tool call
      const toolCallChunks = [
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_123",
                    function: { name: "testTool", arguments: "{}" },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        },
        {
          choices: [
            {
              delta: {},
              finish_reason: "tool_calls",
            },
          ],
        },
      ];

      // Second call (after tool results) returns stop
      const stopChunks = [
        { choices: [{ delta: { content: "" }, finish_reason: "stop" }] },
      ];

      // Third call - structured response
      const structuredResponse = JSON.stringify({
        memoriesReferenced: [],
        response: "Tool executed successfully!",
      });

      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce(createAsyncIterator(toolCallChunks))
        .mockResolvedValueOnce(createAsyncIterator(stopChunks))
        .mockResolvedValueOnce(
          createAsyncIterator([
            { choices: [{ delta: { content: structuredResponse }, finish_reason: null }] },
            { choices: [{ delta: { content: "" }, finish_reason: "stop" }] },
          ])
        );

      (getRawOpenAI as Mock).mockReturnValue(mockOpenAI);

      const result = await agent.createResponse({
        threadId,
        responseMessageId,
        userId,
        channelName: `chat:${userId}:${responseMessageId}`,
      });

      expect(mockToolExecute).toHaveBeenCalledWith({});
      expect(result).toBe("Tool executed successfully!");
    });

    it("should handle tool execution errors gracefully", async () => {
      const agent = new Agent({
        systemId: "test-system-id",
        toolNames: ["failingTool"],
      });

      (Message.find as Mock).mockReturnValue({
        sort: vi.fn().mockResolvedValue([
          { role: "user", content: "Run the failing tool" },
        ]),
      });

      (findActiveMemories as Mock).mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      });

      // Mock failing tool
      const mockToolExecute = vi.fn().mockRejectedValue(new Error("Tool failed!"));
      (createTools as Mock).mockReturnValue({
        failingTool: {
          description: "A failing tool",
          parameters: { type: "object", properties: {} },
          execute: mockToolExecute,
        },
      });

      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn(),
          },
        },
      };

      // First call returns tool call
      const toolCallChunks = [
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  {
                    index: 0,
                    id: "call_456",
                    function: { name: "failingTool", arguments: "{}" },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        },
        {
          choices: [{ delta: {}, finish_reason: "tool_calls" }],
        },
      ];

      // Second call returns stop
      const stopChunks = [
        { choices: [{ delta: { content: "" }, finish_reason: "stop" }] },
      ];

      // Third call - structured response acknowledging error
      const structuredResponse = JSON.stringify({
        memoriesReferenced: [],
        response: "I encountered an error with the tool.",
      });

      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce(createAsyncIterator(toolCallChunks))
        .mockResolvedValueOnce(createAsyncIterator(stopChunks))
        .mockResolvedValueOnce(
          createAsyncIterator([
            { choices: [{ delta: { content: structuredResponse }, finish_reason: null }] },
            { choices: [{ delta: { content: "" }, finish_reason: "stop" }] },
          ])
        );

      (getRawOpenAI as Mock).mockReturnValue(mockOpenAI);

      // Should not throw, but handle error gracefully
      const result = await agent.createResponse({
        threadId,
        responseMessageId,
        userId,
        channelName: `chat:${userId}:${responseMessageId}`,
      });

      expect(mockToolExecute).toHaveBeenCalled();
      expect(result).toBe("I encountered an error with the tool.");
    });

    it("should publish error on failure", async () => {
      const agent = new Agent({
        systemId: "test-system-id",
      });

      (User.findById as Mock).mockRejectedValue(new Error("Database error"));
      (Message.find as Mock).mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      });
      (findActiveMemories as Mock).mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      });

      await expect(
        agent.createResponse({
          threadId,
          responseMessageId,
          userId,
        })
      ).rejects.toThrow("Database error");

      expect(publishStreamError).toHaveBeenCalledWith(
        expect.any(String), // channelName
        responseMessageId,
        "Database error"
      );
    });

    it("should stream text chunks via Ably", async () => {
      const agent = new Agent({
        systemId: "test-system-id",
      });

      (Message.find as Mock).mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      });

      (findActiveMemories as Mock).mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      });

      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn(),
          },
        },
      };

      const streamChunks1 = [
        { choices: [{ delta: { content: "" }, finish_reason: "stop" }] },
      ];

      // Simulate streaming - response field appears gradually
      const responseText = "Hello world!";
      const streamChunks2 = [
        { choices: [{ delta: { content: '{"memoriesReferenced":[],"response":"' }, finish_reason: null }] },
        { choices: [{ delta: { content: "Hello " }, finish_reason: null }] },
        { choices: [{ delta: { content: "world!" }, finish_reason: null }] },
        { choices: [{ delta: { content: '"}' }, finish_reason: null }] },
        { choices: [{ delta: { content: "" }, finish_reason: "stop" }] },
      ];

      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce(createAsyncIterator(streamChunks1))
        .mockResolvedValueOnce(createAsyncIterator(streamChunks2));

      (getRawOpenAI as Mock).mockReturnValue(mockOpenAI);

      await agent.createResponse({
        threadId,
        responseMessageId,
        userId,
        channelName: `chat:${userId}:${responseMessageId}`,
      });

      // Verify streaming was called
      expect(publishStreamText).toHaveBeenCalled();
      expect(publishStreamComplete).toHaveBeenCalledWith(
        expect.any(String), // channelName
        responseMessageId,
        responseText,
        expect.any(Array)
      );
    });

    it("should include tool call results in message history", async () => {
      const agent = new Agent({
        systemId: "test-system-id",
      });

      const threadMessages = [
        { role: "user", content: "Create a lesson plan" },
        {
          role: "assistant",
          content: "I created the lesson plan.",
          messageId: "resp-1",
        },
      ];

      // Mock tool calls for the assistant message
      (getMessageToolCalls as Mock).mockResolvedValue([
        {
          toolName: "createLessonPlan",
          output: { id: "lp123", title: "Math Lesson" },
        },
      ]);

      (Message.find as Mock).mockReturnValue({
        sort: vi.fn().mockResolvedValue(threadMessages),
      });

      (findActiveMemories as Mock).mockReturnValue({
        sort: vi.fn().mockResolvedValue([]),
      });

      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn(),
          },
        },
      };

      const streamChunks = [
        { choices: [{ delta: { content: "" }, finish_reason: "stop" }] },
      ];

      const structuredResponse = JSON.stringify({
        memoriesReferenced: [],
        response: "Your lesson plan is ready!",
      });

      mockOpenAI.chat.completions.create
        .mockResolvedValueOnce(createAsyncIterator(streamChunks))
        .mockResolvedValueOnce(
          createAsyncIterator([
            { choices: [{ delta: { content: structuredResponse }, finish_reason: null }] },
            { choices: [{ delta: { content: "" }, finish_reason: "stop" }] },
          ])
        );

      (getRawOpenAI as Mock).mockReturnValue(mockOpenAI);

      await agent.createResponse({
        threadId,
        responseMessageId,
        userId,
      });

      // Check that tool call results were fetched
      expect(getMessageToolCalls).toHaveBeenCalledWith("resp-1");

      // The assistant message should include tool results
      const calls = mockOpenAI.chat.completions.create.mock.calls;
      const firstCall = calls[0][0];
      const assistantMsg = firstCall.messages.find(
        (m: { role: string; content: string }) =>
          m.role === "assistant" && m.content.includes("createLessonPlan")
      );
      expect(assistantMsg).toBeDefined();
    });
  });

  describe("chatAgent export", () => {
    it("should export pre-configured chat agent", async () => {
      const { chatAgent } = await import("@/core/agent");

      expect(chatAgent).toBeInstanceOf(Agent);
      expect(chatAgent.systemId).toBe("000000000000000000000001");
      expect(chatAgent.model).toBe("gpt-4o");
      expect(chatAgent.toolNames).toContain("createLessonPlan");
      expect(chatAgent.toolNames).toContain("listLessonPlans");
    });
  });
});

