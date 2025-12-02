# AI Systems Engineering Take-Home

## 🚀 Live Demo

**Try it now:** [https://magic-school.mikekorostelev.com/](https://magic-school.mikekorostelev.com/)

> **Note:** You'll need a Google account to sign in and use the application.

### Features (Option 2: Memory & Context Retention)

- **Intelligent Memory System** — Extracts, consolidates, and expires memories from conversations
- **Cross-Session Context** — Memories persist and influence future responses
- **Lesson Plan Tools** — Create, edit, and manage lesson plans via chat
- **Tool Framework** — Registry pattern with Zod validation, user context injection, DB logging, and real-time status via Ably
- **Real-Time Streaming** — Ably-powered response streaming
- **Memory Visualization** — See which memories were used in each response
- **Auto Thread Naming** — Conversations are automatically titled based on content

### Why Raw OpenAI API for the Agent Loop?

The chat agent uses OpenAI's native API directly for the completion loop. The pattern requires: tool calls → tool execution → structured output with `response_format: json_schema` → real-time extraction of the `response` field from streaming JSON (for immediate display) while capturing `memoriesReferenced` from the final parse.

Additionally, the response is **async** — the HTTP request returns immediately with a channel ID, and streaming happens via Ably pub/sub in the background. The Vercel AI SDK's streaming abstractions are designed for synchronous HTTP streaming (SSE), not decoupled pub/sub delivery.

This architecture is intentional: a production system would use state machine orchestration on distributed compute (e.g., Temporal, Step Functions), where in-memory streaming isn't possible. Decoupling the response channel from the HTTP request enables that future scalability.

### Known Limitations & Next Steps

**Context growth** — Currently, all thread messages are sent to the LLM without summarization. A production system needs a **context pruning agent** that summarizes older messages to stay within token limits while preserving key information.

**Lesson plan-specific memory** — The memory system already supports `lessonPlanId` associations, but injection is static. Next step: **dynamic memory injection** that loads relevant memories based on which lesson plan is being discussed, rather than all user memories.

---

## Overview

This take-home evaluates your ability to design and implement a small but complete AI-powered system that demonstrates thoughtful architecture, reasoning, and applied machine learning or language model integration.

You will choose one of several system types that reflect real work at MagicSchool.ai. Each option focuses on different aspects of AI systems engineering such as retrieval, reasoning, tool use, and memory.

You must build a **lesson planning web app for teachers**. Teachers value both thoroughness and speed depending on their context. Educational accuracy and student safety is critical - incorrect alignment to standards or unsafe content recommendations erode trust quickly. Teachers often ask follow-up questions within the same session, and cost efficiency matters at scale. You will primarily be evaluated on the AI features you implement, so **do not spend time on elaborate UI features or polish**.

We expect this project to take 2 to 4 hours for a strong Staff-level engineer. The focus should be on clarity, structure, and design rationale rather than visual polish or exhaustive feature completeness.

---

## Project Options

Choose one of the following project types. You are not expected to build all of them. Each tests a different aspect of applied AI systems engineering.

### Option 1: Retrieval-Augmented Generation (RAG)

Build a retrieval-based assistant that uses the provided documents (math standards included in the `/docs` folder) to generate standards-aligned lesson plans, as well as answer teacher questions regarding the standards.

Teachers must align their lessons to their state, district, and site standards. They value accurate citations and need confidence when the system isn't certain about an answer.

**Core goals**

* Embed and store content for retrieval.
* Implement context assembly and language model synthesis.
* Justify your retrieval approach, including chunking, ranking, or hybrid search if applicable.

**Optional extension**
Implement a GraphRAG or multi-hop retrieval model that captures relationships between standards or concepts.

---

### Option 2: Memory and Context Retention

Build an assistant that can recall prior interactions across chat sessions or requests.

Teachers often work on the same lesson plans over multiple sessions and ask follow-up questions within a conversation. They value systems that remember what they've discussed without needing to repeat context, but also appreciate transparency about what prior information is being used.

**Core goals**

* Persist and retrieve conversation history or user state.
* Demonstrate how past context influences future responses.
* Log or visualize how the memory evolves over time.

**Optional extension**
Integrate or design an open-source memory store (for example, `mem0`, a vector-based session memory, or a custom solution).

---

### Option 3: Multi-Agent System

Build a small system that coordinates multiple reasoning agents.

Teachers often need to differentiate instruction for multiple student cohorts (advanced learners, struggling students, English language learners, etc.). A multi-agent system could coordinate specialized agents to generate tailored content for each group. If using multiple agents, you should be able to justify why it produces better differentiated outcomes than a simpler approach, while avoiding unnecessary complexity or latency.

**Core goals**

* Implement role-based communication or task planning.
* Show how agents coordinate or share context.
* Evaluate correctness and consistency across agents.

**Optional extension**
Use graph-based or dynamic task planning for adaptive coordination.

---

## Technical Requirements

| Area         | Requirement                                                                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework    | Next.js 15 (App Router)                                                                                                                                           |
| Language     | TypeScript                                                                                                                                                        |
| AI SDK       | Prefer the Vercel AI SDK v5, but you may use another library (LangChain, LlamaIndex, Semantic Kernel, or custom) if you justify the choice in your documentation. |
| Data Layer   | Default: PostgreSQL with pgvector. Optional: Chroma, LanceDB, or another open-source store.                                                                       |
| LLM Provider | OpenAI, Anthropic, or another model with justification.                                                                                                           |

---

## Suggested Project Layout

```
src/
  core/
    agent.ts
    memory.ts
    rag.ts
  data/
    embeddings.ts
  ui/
    ChatContainer.tsx
docs/
  ARCHITECTURE.md
  EVALUATION.md
  DECISIONS.md
```

---

## Deliverables

| File               | Description                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `ARCHITECTURE.md`  | Explain your design, including data flow, orchestration logic, and trade-offs. Diagrams are welcome but optional. |
| `EVALUATION.md`    | Describe how you validated your system (for example, retrieval quality, accuracy, latency, or cost).              |
| `DECISIONS.md`     | Document assumptions, design trade-offs, and what you would do with more time.                                    |
| Working Demo       | Running app or notebook that demonstrates your chosen system type.                                                |
| Optional `DEMO.md` | Screenshots or a short walkthrough description of your project.                                                   |

---

## Core Expectations for All Projects

* Clear separation between orchestration, reasoning, and data layers.
* Proper TypeScript typing and modularity.
* At least one test for a critical function or component.
* Graceful error handling and fallback logic.
* Transparent reasoning or context flow.
* Clean, consistent commits using conventional commit style.

---

## Example Use Cases

You can use the math standards dataset provided in `/docs` or create a small dataset of your own to demonstrate functionality.
Examples of relevant prompts include:

* "What does standard NC.7.SP.3 cover?"
* "How do 6th and 7th grade standards differ in proportional relationships?"
* "Summarize key changes in geometry standards between grades."
* "Calculate how many lessons align with standard 7.SP.5."
* "Recall what the teacher said about probability in the last session."

Choose examples appropriate to your selected project type.

---

## Evaluation Criteria

| Dimension     | Expectation                                | Staff-Level Signal                                       |
| ------------- | ------------------------------------------ | -------------------------------------------------------- |
| Architecture  | Modular, composable design                 | Clear boundaries between components; scalable design     |
| AI Reasoning  | Use of context, memory, or tools           | Structured reasoning, explainable flow                   |
| Data Modeling | Retrieval, memory, or graph storage design | Awareness of trade-offs in embeddings and storage        |
| Scalability   | Handles realistic data and latency         | Mentions caching, batching, async design                 |
| Code Quality  | Type safety, testing, and structure        | Robust, cleanly organized code                           |
| Evaluation    | Method for assessing correctness           | Simple but meaningful validation or metrics              |
| Documentation | Clarity and rationale                      | Explains design and trade-offs clearly                   |
| Creativity    | Thoughtfulness of approach                 | Justified deviation from defaults, clear problem framing |

---

## Guidance

* Focus on clarity and reasoning more than feature completeness.
* Explain why you chose your approach and how it might scale.
* Avoid building unnecessary UI polish; show system behavior clearly.
* Strong submissions show how a prototype could evolve into a reusable production system.

---

## Questions / Issues

If you run into any issues while working on the project or have any questions about the tasks or other parts of the project, feel free to email <infra@magicschool.ai>.
  
## Submission

When you’re ready to submit your work please create a new pull request with your changes. Email <infra@magicschool.ai> to let us to let us know when you’re finished.

Please have your code pulled up and running for the interview.