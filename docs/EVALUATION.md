# Evaluation Strategy

## Approach: Instrumentation-First

Rather than building evaluation tooling directly, this project focuses on **data exhaust** — capturing everything needed to run evaluations offline or integrate with observability platforms.

Every action in the system is logged with references:
- **Tool calls** → stored with `messageId`, input, output, duration, status
- **Memory references** → each assistant message records which memory IDs were used
- **Memory lifecycle** → creation, updates, consolidation sources, access counts, soft deletes

This enables multiple evaluation approaches without baking any single one into the app.

---

## Memory Quality Evaluation

### Offline LLM-as-Judge

With the data exhaust, an evaluation pipeline could:
1. Sample conversation threads
2. For each thread, ask an LLM judge: "Given this conversation, what facts should be remembered?"
3. Compare judge output to actual extracted memories
4. Score precision/recall

### Fixture-Based Testing

For deterministic testing:
1. Create fixture conversations with known facts
2. Define expected memory extractions
3. Run memory agent, compare actual vs. expected
4. Assert on memory IDs referenced in responses

The `referencedMemories` array on each message makes this comparison straightforward — we know exactly which memories the model claimed to use.

---

## Latency & Performance

### Current State

No formal instrumentation in this prototype. Response latency depends on:
- OpenAI API latency (~1-3s for first token)
- Number of tool calls in the loop (each adds a round trip)
- Ably publish latency (minimal, ~50ms)

### Production Approach

OpenTelemetry integration with a platform like Honeycomb or Datadog:
- Trace spans for each agent pass
- Tool execution timing
- Memory retrieval queries
- End-to-end request duration

This is standard infrastructure, not specific to this project.

---

## Cost Tracking

### Current State

No cost tracking implemented. Token usage is logged by OpenAI but not aggregated.

### Production Approach

A tracing platform like LangSmith or custom solution:
- Full message traces (system prompt, user input, tool calls, final response)
- Token counts per trace
- Metadata tagging (thread ID, user ID, operation type)
- Aggregation to answer: "What kinds of operations cost the most?"

Cost optimization opportunities identified:
- Memory agent runs on every user message — could batch or debounce
- Thread namer runs twice (2nd and 4th message) — could run once
- All thread messages sent to LLM — context summarization would reduce tokens

---

## Manual Validation Performed

During development, validated through manual testing:

1. **Memory extraction** — Sent messages with clear facts ("I teach 7th grade"), verified they appeared in memories list
2. **Memory recall** — In new threads, asked questions that should trigger memory use, verified `memoriesUsed` appeared in response metadata
3. **Consolidation** — Created overlapping memories, verified they merged with combined access counts
4. **Expiration** — Exceeded memory limit, verified lowest-scored memories were soft-deleted
5. **Tool execution** — Created lesson plans via chat, verified tools executed and results persisted

---

## What Would Formal Evaluation Look Like?

Given more time, a proper evaluation suite would include:

| Dimension | Method | Metric |
|-----------|--------|--------|
| Memory extraction precision | LLM judge on sample threads | % of extracted memories rated "relevant" |
| Memory extraction recall | Fixture conversations with known facts | % of expected facts captured |
| Memory attribution accuracy | Manual review of `memoriesReferenced` | % of attributions rated "correct use" |
| Response latency | OpenTelemetry p50/p95/p99 | Time to first token, total time |
| Cost efficiency | LangSmith traces | Tokens per conversation turn |
| Tool reliability | Fixture-based integration tests | % of tool calls completing successfully |

The data exhaust exists to support all of these — the evaluation tooling itself was out of scope.