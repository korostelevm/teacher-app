# Design Decisions

## Why Option 2 (Memory & Context Retention)

The assignment offered three options: RAG, Memory, or Multi-Agent systems.

**Choice: Memory & Context Retention**

Reasoning:
- **Foundational overlap** — Threads, messages, and the agent loop are prerequisites for *any* of the three options. Building the memory system forced getting these foundations right first.
- **Demo quality** — RAG or multi-agent without solid thread/message infrastructure would feel incomplete. Memory naturally showcases the full user flow from conversation → extraction → retention → recall.
- **Data dependency** — RAG requires meaningful seed data. While NC math standard PDFs are provided, processing them into useful chunks would be additional work that doesn't demonstrate core engineering skills as clearly as the memory system design does.

The memory system became a vehicle for building robust infrastructure (auth, threads, messages, tools, real-time streaming) that could later support RAG or multi-agent extensions.

---

## Technology Choices

### SDK Choice: Raw OpenAI API for Agent Loop

The assignment recommends the Vercel AI SDK v5. This project uses the SDK for simple cases (`generateObject`, `generateText` in workers) but drops to the raw OpenAI client for the main chat agent loop.

**Why the raw API?**

The chat agent requires a pattern that the Vercel AI SDK doesn't support:

1. **Tools + Structured Output in the same loop** — The SDK separates `generateText` (supports tools) from `generateObject` (supports structured output). You can't have optional tool calls *and* a structured final response in one completion loop.

2. **Forced memory attribution** — The structured response schema requires the model to output `memoriesReferenced: string[]` alongside its `response: string`. This forces explicit memory attribution that can be shown in the UI and tracked.

3. **Strict schema enforcement** — OpenAI's `zodResponseFormat` helper sets `strict: true` by default, guaranteeing schema compliance. The Vercel AI SDK's OpenAI provider defaults `strictJsonSchema: false`, meaning schemas are hints rather than guarantees.

4. **Ably pub/sub streaming** — The SDK's streaming is designed for synchronous HTTP responses (SSE). This architecture decouples the response channel from the HTTP request, streaming via Ably in the background. This enables future scalability to distributed compute (Temporal, Step Functions) where in-memory streaming isn't possible.

**The pattern:**
```
Loop:
  1. Call OpenAI with tools available (streaming)
  2. If finish_reason === "tool_calls": execute tools, add results, continue loop
  3. If no tool calls: make final call with json_schema response_format
  4. Stream the "response" field as it arrives, capture "memoriesReferenced" from final parse
```

### Database Choice: MongoDB over PostgreSQL

The assignment suggests PostgreSQL with pgvector as the default.

**Why MongoDB?**

1. **Faster prototyping** — MongoDB's native object/document structure maps directly to JavaScript objects. No ORM translation layer, no type mismatches.

2. **No migrations** — Schema changes don't require migration files. During rapid iteration, this removes friction when evolving data models.

3. **Flexible schema** — As the app evolved (adding `lessonPlanId` to memories, `consolidatedFromIds` for memory merging, etc.), changes were additive without breaking existing documents.

**Trade-off acknowledged**: PostgreSQL with pgvector would be the better choice for production RAG features (vector similarity search). If adding RAG later, could either:
- Add pgvector alongside MongoDB for embeddings only
- Migrate to PostgreSQL once schema stabilizes

### Model Choice: GPT-4o + GPT-4o-mini

**GPT-4o** for the main chat agent:
- Heavy tool calling (8 lesson plan tools) requiring reliable function selection and argument generation
- Structured output with memory attribution
- User-facing responses where quality matters

**GPT-4o-mini** for background workers:
- Thread namer: summarizes conversation → short title (simple reformatting)
- Memory extractor: identifies facts from conversation (extraction/summarization)
- These are internal operations where cost matters more than peak quality

---

### Real-Time Streaming: Ably Pub/Sub

Chose Ably over Server-Sent Events (SSE), WebSockets, or other alternatives.

**Why Ably?**

1. **Decoupled from HTTP request** — The chat API returns immediately with a channel ID. Streaming happens in the background via Ably publish. This decoupling is intentional.

2. **Scalable across compute instances** — With SSE or WebSockets, the streaming connection is tied to the server instance handling the request. With Ably, any worker/instance can publish to the channel. This enables future architectures like:
   - Temporal workflows on separate workers
   - Step Functions with Lambda
   - Horizontal scaling without sticky sessions

3. **Managed infrastructure** — Handles reconnection, backpressure, and presence without custom implementation.

**Trade-off**: Adds external dependency and cost. For a simple prototype, SSE would be simpler. But the architecture demonstrates production-ready patterns.

---

### Memory System Design

**Three-phase approach:**
1. **LLM-driven extraction** — Memory agent decides what facts/preferences are worth persisting
2. **Consolidation** — Merges overlapping memories, sums access counts, preserves oldest record
3. **Expiration** — Deterministic pruning when over limit

**Key decisions:**

- **Deterministic expiration (no LLM)** — Expiration uses a simple score formula (`accessCount - ageDays * 0.1`). An LLM didn't seem necessary for this; would need to evaluate the benefit before adding that complexity and cost.

- **`maxMemories: 5` limit** — Intentionally low for demo purposes. Allows evaluators to experience the full memory lifecycle (creation → access tracking → consolidation → expiration) within a short conversation. Production would use a higher limit.

- **Soft deletes** — Expired/removed memories are soft-deleted (`deletedAt` timestamp) rather than hard-deleted. Preserves audit trail and allows showing "this response used a memory that was later removed" if needed.

---

### Background Workers: In-Process Queue

Workers use a simple in-process queue pattern:
```typescript
const queue: Job[] = [];
let processing = false;
export function queueJob(data) { queue.push(data); processQueue(); }
```

**Why not a proper job queue (BullMQ, Temporal, etc.)?**

Project scope. This is a prototype simplification.

**Production approach:** Temporal.io workflows triggered by database change streams. This gives:
- Durable execution with retries
- Visibility into workflow state
- Separation from the API server process
- Horizontal scaling of workers

The current in-process approach works for demo but wouldn't survive a server restart mid-job.

---

### Tool System: Custom Registry Pattern

Built a custom tool registry instead of using Vercel AI SDK's tool pattern:

```typescript
registerTool("createLessonPlan", {
  inputSchema: z.object({ ... }),
  execute: async (params, { ctx }) => { ... }
});
```

**Why custom?**

1. **Context injection** — Tools need access to the authenticated user, thread ID, and message ID. The registry wraps execution to inject `ctx: { user, threadId, messageId }` into every tool call. Tools can enforce ownership checks, associate resources with users, etc.

2. **Execution logging** — Tool calls are persisted to the database with status, input, output, and duration. This enables:
   - UI display of tool execution status (via Ably events)
   - Debugging and audit trails
   - Rebuilding conversation context with tool results

3. **Selective tool loading** — Different agents can load different tool subsets by name, rather than all-or-nothing.

---

### Authentication: Google OAuth

Chose Google OAuth with server-side cookie sessions over alternatives (magic links, username/password, other providers).

**Why Google?**

1. **Portable** — Most people have Google accounts. For a live demo that strangers need to access, this minimizes friction.
2. **Public demo** — Hosting publicly meant auth was required. Couldn't leave it open.
3. **Familiar implementation** — Recently implemented elsewhere, so the pattern was top of mind. Didn't want to spend take-home time on auth plumbing.

---

## Assumptions

- **Evaluators have Google accounts** — Required for the live demo
- **Short evaluation sessions** — Memory limit of 5 and thread naming on 2nd/4th message are tuned for quick demonstration of features
- **Middle school math focus is sufficient** — Constrained to grades 6-8 rather than building a general lesson planner
- **AI quality over UI polish** — Per the assignment: "do not spend time on elaborate UI features or polish"

---

## Future Improvements

### Config-Driven Agents
The `Agent` class has stubs for instantiation from config. Goal: agents and users become equivalent "principals" in the system. An agent could own threads, have memories, and be permissioned like a user. This reduces architectural complexity for multi-agent scenarios.

### Context Summarization
Currently all thread messages are sent to the LLM. As threads grow, this hits token limits. A summarization agent (similar to memory consolidation) would compress older messages while preserving key context.

### Lesson-Plan-Specific Memories
The memory model already has `lessonPlanId`. Next step: dynamically load memories relevant to the lesson plan being discussed, rather than loading all user memories. "When I'm editing the fractions lesson, show me what I said about that lesson before."

### Lesson Plan Visualization UI
A dedicated view showing the lesson plan structure as it's being built — activities, assessments, differentiations appearing in real-time as tools execute. Currently tool results are logged but not visually rendered.