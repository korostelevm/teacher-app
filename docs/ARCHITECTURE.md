# System Architecture

## Overview

Next.js-based AI chatbot for creating middle school math lesson plans. Features real-time streaming via Ably, MongoDB persistence, Google OAuth authentication, and an intelligent memory system for context retention across sessions.

**Key Design**: Users, AI assistants, and service accounts are unified principals with consistent permissions — enabling scalable multi-agent systems without special cases.

## High-Level Architecture

```mermaid
flowchart TB
    subgraph Client["Client (Browser)"]
        UI[React UI]
        AblyClient[Ably Client]
    end
    
    subgraph NextJS["Next.js Server"]
        API[API Routes]
        Agent[Chat Agent]
        MemAgent[Memory Agent]
        NamerAgent[Thread Namer Agent]
        Tools[Tool System]
    end
    
    subgraph External["External Services"]
        Google[Google OAuth]
        OpenAI[OpenAI API]
        AblyServer[Ably Realtime]
    end
    
    subgraph Data["Data Layer"]
        MongoDB[(MongoDB)]
    end
    
    UI <--> API
    UI <--> AblyClient
    AblyClient <-.->|WebSocket| AblyServer
    API --> Agent
    Agent --> OpenAI
    Agent --> Tools
    Agent -.->|Publish| AblyServer
    API --> MemAgent
    MemAgent --> OpenAI
    Agent --> NamerAgent
    NamerAgent --> OpenAI
    NamerAgent --> MongoDB
    API --> Google
    Agent --> MongoDB
    MemAgent --> MongoDB
    Tools --> MongoDB
```

## Authentication Flow

Google OAuth 2.0 with server-side session management.

```mermaid
sequenceDiagram
    participant U as User
    participant B as Browser
    participant N as Next.js API
    participant G as Google OAuth
    participant DB as MongoDB

    U->>B: Click "Sign in with Google"
    B->>N: GET /api/auth/google
    N->>G: Redirect to Google OAuth
    G->>U: Show consent screen
    U->>G: Grant permission
    G->>N: GET /api/auth/redirect?code=xxx
    N->>G: Exchange code for tokens
    G-->>N: Access token + user info
    N->>DB: Upsert User document
    N->>DB: Create/update Session
    N->>B: Set httpOnly cookie + redirect
    B->>U: Show authenticated UI
```

## Chat Message Flow

Real-time streaming architecture with background processing.

```mermaid
sequenceDiagram
    participant U as User
    participant UI as React UI
    participant Ably as Ably Client
    participant API as /api/chat
    participant Agent as Chat Agent
    participant OpenAI as OpenAI API
    participant AblyS as Ably Server
    participant DB as MongoDB

    U->>UI: Type message
    UI->>Ably: Subscribe to chat:{messageId}
    UI->>API: POST {content, threadId}
    API->>DB: Save user message
    API->>API: Queue memory extraction
    API-->>UI: {messageId, threadId}
    
    Note over API,Agent: Background processing starts
    
    API->>Agent: createResponse()
    Agent->>DB: Load thread messages + memories
    Agent->>OpenAI: Stream completion (with tools)
    
    loop Streaming
        OpenAI-->>Agent: Token chunk
        Agent->>AblyS: publish stream:text
        AblyS-->>Ably: Push to client
        Ably-->>UI: Update message
    end
    
    Agent->>DB: Save assistant message
    Agent->>Agent: Queue thread naming
    Agent->>AblyS: publish stream:complete
    AblyS-->>Ably: Completion event
    Ably-->>UI: Finalize message
    
    Note over Agent,DB: Background: Thread naming runs if 2nd or 4th message
```

## Tool Execution Flow

The agent can call tools during response generation. Tools are executed in parallel when possible.

```mermaid
flowchart TB
    subgraph Agent["Chat Agent Loop"]
        A[Start Response] --> B[Call OpenAI]
        B --> C{Tool calls?}
        C -->|Yes| D[Execute Tools]
        D --> E[Add results to context]
        E --> B
        C -->|No| F[Stream final response]
    end
    
    subgraph ToolExec["Tool Execution"]
        D --> T1[Save to DB - running]
        T1 --> T2[Publish tool:start via Ably]
        T2 --> T3[Execute tool function]
        T3 --> T4[Update DB - complete]
        T4 --> T5[Publish tool:complete via Ably]
    end
    
    subgraph Available["Available Tools"]
        createLessonPlan
        listLessonPlans
        getLessonPlan
        updateLessonPlan
        deleteLessonPlan
        addLessonActivity
        addLessonAssessment
        addLessonDifferentiation
    end
```

### Agent Completion Loop (Detailed)

See [AGENT-LOOP.md](./AGENT-LOOP.md) for the full diagram including tool execution, memory tracking, and background memory extraction.

## Background Workers

The system uses queue-based background workers for non-blocking post-processing.

```mermaid
flowchart LR
    subgraph Triggers["Trigger Points"]
        UM[User Message Saved]
        AM[Assistant Message Saved]
    end
    
    subgraph Workers["Background Workers"]
        MW[Memory Worker]
        TN[Thread Namer]
    end
    
    subgraph Actions["Actions"]
        ME[Extract Memories]
        MC[Consolidate Memories]
        GT[Generate Title]
        UT[Update Thread]
    end
    
    UM --> MW
    AM --> MW
    AM --> TN
    
    MW --> ME
    MW --> MC
    TN --> GT
    GT --> UT
```

### Thread Namer Worker

Automatically generates descriptive titles for threads based on conversation content.

- **Triggers**: After 2nd message (first exchange) and 4th message (refined context)
- **Skip conditions**: Thread already has custom title, wrong message count
- **Model**: GPT-4o-mini (fast/cheap)
- **Output**: Title under 50 characters, topic-focused

```mermaid
flowchart TB
    A[Message Saved] --> B{Message count?}
    B -->|2 or 4| C{Has custom title?}
    B -->|Other| X[Skip]
    C -->|Yes| X
    C -->|No| D[Load messages]
    D --> E[Call LLM]
    E --> F[Update thread title]
```

## Memory System

Intelligent memory extraction and consolidation for cross-session context.

```mermaid
flowchart TB
    subgraph Trigger["After User Message"]
        A[User sends message] --> B[Queue memory extraction]
    end
    
    subgraph Extract["Memory Agent"]
        B --> C[Load recent messages]
        C --> D[Load existing memories]
        D --> E[Load user's lesson plans]
        E --> F[Call LLM with context]
        F --> G{Analyze output}
    end
    
    subgraph Process["Memory Processing"]
        G -->|New memory| H[Create in DB]
        G -->|Updated memory| I[Update content]
        G -->|Consolidated| J[Merge memories]
        G -->|Removed| K[Soft delete]
        J --> L[Sum access counts]
        L --> M[Keep oldest record]
    end
    
    subgraph Expire["Memory Expiration"]
        H --> N{Over limit?}
        I --> N
        J --> N
        K --> N
        N -->|Yes| O[Score memories]
        O --> P[Expire lowest scores]
        N -->|No| Q[Done]
        P --> Q
    end
```

### Memory Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Active: Created from conversation
    Active --> Active: Accessed (count++)
    Active --> Active: Updated content
    Active --> Consolidated: Merged with similar
    Active --> Expired: Low score + over limit
    Active --> Deleted: LLM removed
    Consolidated --> Active: Content updated
    Expired --> [*]: Soft deleted
    Deleted --> [*]: Soft deleted
```

## Data Models

```mermaid
erDiagram
    User ||--o{ Thread : owns
    User ||--o{ Memory : has
    User ||--o{ LessonPlan : creates
    Thread ||--o{ Message : contains
    Thread ||--o{ Memory : sources
    Message ||--o{ ToolCall : triggers
    Message }o--o{ Memory : references
    LessonPlan ||--o{ LessonActivity : contains
    LessonPlan ||--o{ LessonAssessment : includes
    LessonPlan ||--o{ LessonDifferentiation : specifies
    
    User {
        ObjectId _id
        string googleId
        string displayName
        string email
        string photo
        string role
    }
    
    Thread {
        ObjectId _id
        string title
        ObjectId ownerId
    }
    
    Message {
        ObjectId _id
        ObjectId threadId
        ObjectId authorId
        string role
        string content
        string messageId
        ObjectId[] referencedMemories
    }
    
    Memory {
        ObjectId _id
        ObjectId threadId
        ObjectId userId
        string content
        int accessCount
        Date lastAccessedAt
        Date deletedAt
        ObjectId[] consolidatedFromIds
        ObjectId lessonPlanId
    }
    
    ToolCall {
        ObjectId _id
        ObjectId threadId
        string messageId
        string toolName
        string status
        object input
        object output
        int durationMs
    }
    
    LessonPlan {
        ObjectId _id
        string title
        string subject
        int gradeLevel
        string[] standards
        string[] objectives
        int durationMinutes
        string[] materials
        string status
    }
    
    LessonActivity {
        ObjectId _id
        ObjectId lessonPlanId
        string name
        string type
        int durationMinutes
        string description
        int order
    }
    
    LessonAssessment {
        ObjectId _id
        ObjectId lessonPlanId
        string type
        string name
        string description
        string[] successCriteria
    }
    
    LessonDifferentiation {
        ObjectId _id
        ObjectId lessonPlanId
        string group
        string accommodations
        string modifications
    }
```

## Component Architecture

```mermaid
flowchart TB
    subgraph Pages["Pages (src/app/)"]
        Home[page.tsx]
    end
    
    subgraph Components["Components (src/components/)"]
        CC[ChatContainer]
        CCL[ChatClient]
        CI[ChatInput]
        CM[ChatMessage]
        TL[ThreadsList]
        LPL[LessonPlansList]
        ML[MemoriesList]
        PM[ProfileMenu]
    end
    
    subgraph Hooks["Hooks (src/hooks/)"]
        useAbly
        useChatStream
        useUser
    end
    
    subgraph Core["Core (src/core/)"]
        Agent
        ThreadManager
    end
    
    subgraph Models["Models (src/models/)"]
        User
        Thread
        Message
        Memory
        ToolCall
        LessonPlan
    end
    
    Home --> CC
    CC --> CCL
    CCL --> CI
    CCL --> CM
    CC --> TL
    CC --> LPL
    CC --> ML
    CC --> PM
    
    CCL --> useChatStream
    CCL --> useUser
    useChatStream --> useAbly
```

## API Routes

```mermaid
flowchart LR
    subgraph Auth["/api/auth"]
        AG["/google"] --> AR["/redirect"]
        AL["/logout"]
        AU["/user"]
    end
    
    subgraph Chat["/api/chat"]
        CP["POST - Send message"]
        CG["GET - Health check"]
    end
    
    subgraph Threads["/api/threads"]
        TGL["GET/POST - List/Create"]
        TGM["/[threadId]/messages"]
    end
    
    subgraph Resources["/api"]
        LP["/lesson-plans"]
        MEM["/memories"]
        TC["/tool-calls/[messageId]"]
        INIT["/init"]
        UP["/upload"]
        ABLY["/ably-auth"]
    end
```

## Trade-offs

| Decision | Why | Alternative |
|----------|-----|-------------|
| Unified Principal Model | Scales to multi-agent without special logic | Separate AI/ServiceAccount models = duplicate permission systems |
| MongoDB | Flexible schema for evolving types, document model fits lesson plans | PostgreSQL = requires migrations for schema changes |
| Ably Streaming | Managed real-time, handles backpressure, reconnection | WebSockets = sticky sessions, manual reconnect logic |
| Cookie Sessions | Simple, server-controlled revocation | JWT = harder to revoke, larger payload |
| Background Streaming | Non-blocking HTTP response, better UX | Blocking = slow perceived response time |
| Soft Delete Memories | Audit trail, can show "used deleted memory" context | Hard delete = loses history |
| Memory Consolidation | Reduces redundancy, improves relevance | Keep all = context bloat over time |

## Future Extensions

- **Service Accounts**: Crawlers, processors, and automated agents
- **Multi-Agent Collaboration**: Multiple AI models working together
- **Team/Workspace Support**: Shared threads and lesson plans
- **Rate Limiting & Quotas**: Per-principal usage controls
- **RAG Integration**: Document retrieval for standards/curriculum context
- **Lesson Plan Export**: PDF/DOCX generation
- **Lesson Plan Sharing**: Public/private lesson plan library
