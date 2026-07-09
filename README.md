# Agent

Agent is a Next.js MVP for chat-driven hotel PMS actions. The first supported action flow is a human-reviewed price update proposal for dummy-PMS price-capacity rows.

## MVP Flow

- Create or open a chat.
- Ask for a percentage price change, for example: `Increase room prices by 10% for hotel 1`.
- The server fetches live dummy-PMS rooms, rate plans, children categories, and price-capacity rows.
- The app stores agent steps, tool calls, messages, and a pending action proposal in SQLite.
- Review the field-level diff table.
- Confirm to execute through dummy-PMS, or reject to store a no-write rejection.

## Local Services

- Agent: `http://localhost:3001`
- RAG-KBS: `http://localhost:3000`
- dummy-PMS: `http://localhost:4000`

## Environment

Copy `.env.example` to `.env.local` or `.env` and set:

```env
DATABASE_URL=file:./dev.db
OPENROUTER_API_KEY=
AGENT_MODEL=
DUMMY_PMS_BASE_URL=http://localhost:4000
DUMMY_PMS_AUTH_TOKEN=test-token
```

RAG-KBS variables are optional for the core action demo.

## Setup

```bash
pnpm install
pnpm prisma:generate
pnpm db:init
pnpm dev
```

## Routes

- `GET /api/chats`
- `POST /api/chats`
- `GET /api/chats/[chatId]`
- `POST /api/chats/[chatId]/messages`
- `POST /api/chats/[chatId]/uploads`
- `POST /api/action-proposals/[proposalId]/execute`
- `POST /api/action-proposals/[proposalId]/reject`

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Run dummy-PMS separately:

```bash
cd /Users/amirho/Projects/dummy-PMS
pnpm test
pnpm dev
```
