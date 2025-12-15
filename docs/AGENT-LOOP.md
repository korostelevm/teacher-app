# Agent Completion Loop

The `createResponse` method in `src/core/agent.ts` implements an iterative agentic loop that handles tool calls and streams responses.

## Full Flow Diagram

```mermaid
flowchart TB
    Start([User Message]) --> Load[/"Load in parallel:
    - User profile
    - Thread messages  
    - User memories (active only)"/]
    
    Load --> Build["Build context:
    - Inject memories into system prompt
    - Build tools array
    - Build ResponseSchema with memory IDs as enum"]
    
    Build --> Loop{{"Completion Loop
    (max 10 passes)"}}
    
    Loop --> Stream["Stream LLM call
    with tools enabled"]
    
    Stream --> Collect["Collect streamed chunks:
    - Content
    - Tool calls"]
    
    Collect --> ToolCheck{Tool calls?}
    
    ToolCheck -->|Yes| Execute["Execute tools in parallel
    (via Promise.all)"]
    
    Execute --> T1["Save ToolCall: status=running"] --> T2["Publish tool:start"]
    T2 --> T3["Run tool function"]
    T3 --> T4["Update ToolCall: status=complete"] --> T5["Publish tool:complete"]
    
    T5 --> AddResults["Add tool results to messages"]
    AddResults --> Loop
    
    ToolCheck -->|No| Final["Stream structured response
    using ResponseSchema"]
    
    Final --> Parse["Parse JSON:
    { memoriesReferenced, response }"]
    
    Parse --> MemAccess["Update referenced memories:
    accessCount++, lastAccessedAt=now"]
    
    MemAccess --> Persist["Save assistant message
    with referencedMemories"]
    
    Persist --> Naming["Queue thread naming"]
    Naming --> Publish["Publish stream:complete"]
    Publish --> End([Response Complete])
    
    End ~~~ M1
    
    Start -.->|"async (after user msg saved)"| M1
    
    subgraph MemWorker["Memory Extraction Worker (background)"]
        M1["Load: messages, memories, lesson plans"]
        M1 --> M2["Call Memory Agent LLM"]
        M2 --> M3{"Each output memory"}
        M3 -->|"new"| M4["Create"]
        M3 -->|"updated"| M5["Update"]
        M3 -->|"merged"| M6["Consolidate"]
        M3 -->|"removed"| M7["Soft delete"]
        M4 & M5 & M6 & M7 --> M8{"Over limit?"}
        M8 -->|Yes| M9["Expire lowest-score"]
        M8 -->|No| M10["Publish memory:update"]
        M9 --> M10
    end
```

## ResponseSchema with Memory ID Enum

The schema dynamically constrains `memoriesReferenced` to only valid memory IDs:

```typescript
// Memory IDs from DB become an enum constraint
const memoryIds = memories.map(m => m._id.toString());

const ResponseSchema = z.object({
  // LLM can ONLY return IDs that exist in the enum
  memoriesReferenced: z.array(
    z.enum(memoryIds as [string, ...string[]])
  ).describe("IDs of memories used in this response"),
  
  response: z.string().describe("The conversational reply")
});
```

**Why this matters:**
- Prevents hallucinated memory IDs — the LLM must choose from exact IDs in the system prompt
- Referenced IDs increment `accessCount`, which factors into the expiration score
- Memories with higher access counts survive longer during expiration

## Key Aspects

| Aspect | Implementation |
|--------|----------------|
| **Parallel loading** | User, messages, and memories fetched via `Promise.all` |
| **Dynamic schema** | Memory IDs injected as Zod enum at runtime |
| **Streaming** | All LLM calls use streaming to minimize TTFB |
| **Tool execution** | Multiple tools in one pass run via `Promise.all` |
| **Tool persistence** | Each tool call saved to DB with input/output/duration |
| **Structured output** | Final response uses `response_format` for reliable JSON |
| **Real-time updates** | Tokens stream to clients via Ably pub/sub |
| **Memory tracking** | Referenced memories get `accessCount++` for scoring |

## Memory Expiration Scoring

When a user exceeds the memory limit (default: 5), lowest-scoring memories are expired:

```
score = accessCount - (ageDays × 0.1)
```

- Higher access count → higher score → survives longer
- Older memories get a small penalty
- Memories referenced in responses naturally accumulate higher scores

