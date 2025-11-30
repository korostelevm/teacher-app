# System Architecture

## Overview
Next.js-based RAG chatbot with real-time streaming via Ably, MongoDB persistence, and Google OAuth authentication.

**Key Design**: Users, AI assistants, and service accounts are unified principals with consistent permissions - enabling scalable multi-agent systems without special cases.

## Data Flow
User → Google OAuth → User (MongoDB) → owns Thread(s) → contains Message(s)

Each message is authored by a principal (human, AI, or service account) via `authorId`.

## Component Design

### Authentication (`src/app/api/auth/`)
- Google OAuth 2.0 callback, session management, logout

### Chat Layer (`src/app/api/chat/`)
- Message ingestion, thread creation/management, AI orchestration, Ably streaming
- Automatically creates threads on first message if `threadId` not provided
- Saves user and assistant messages to MongoDB
- Returns `threadId` in response for frontend tracking

### Core Logic (`src/core/`)
- `chat.ts`: Message flow orchestration
- `agent.ts`: AI configuration
- `memory.ts`: Context management
- `rag.ts`: Retrieval pipeline

### Real-time (`src/hooks/use-chat-stream.ts`)
- Ably subscription management, streaming UI updates

### Data (`src/lib/`, `src/models/`)
- MongoDB connection, User/Thread/Message models

## Data Models

**Thread**: `{ title, ownerId (user), timestamps }`  
**Message**: `{ threadId, authorId (any principal), role, content, timestamps }`  
**User**: `{ type: "human"|"system"|"service-account", roles, permissions, ...auth }`

## Trade-offs

| Decision | Why | Alternative |
|----------|-----|-------------|
| Unified Principal Model | Scales to multi-agent without special logic | Separate AI/ServiceAccount models = duplicate permission systems |
| MongoDB | Flexible schema for evolving user types | PostgreSQL = requires migrations |
| Ably Streaming | Managed real-time, handles backpressure | WebSockets = sticky sessions, manual reconnect |
| Cookie Sessions | Simple, server-controlled revocation | JWT = harder to revoke |

## Future Extensions
- Service accounts (crawlers, processors)
- Multi-agent collaboration (multiple AI models)
- Team/workspace support (shared threads)
- Rate limiting & quotas (per-principal)
