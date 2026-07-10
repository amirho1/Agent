# Agent

Agent is a Next.js MVP for chat-driven hotel PMS actions. It supports read-only room queries and human-reviewed mutation proposals for dummy-PMS room and price-capacity data.

## MVP Flow

- Create or open a chat.
- Ask for a read-only room query, for example: `Show hotel 3 10 cheapest rooms`.
- Ask for a mutation, for example: `Edit room 5 name to Deluxe Double Room` or `Find two cheapest rooms in hotel 3 and add 3 dollars to their display price`.
- Read-only requests fetch live PMS data and render a result table without Confirm or Reject buttons.
- Mutation requests fetch current PMS data, store a pending action proposal in SQLite, and render the diff table.
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

## Supported Examples

- `Show hotel 3 rooms`
- `Show hotel 3 10 cheapest rooms`
- `Find two cheapest rooms in hotel 3 and add 3 dollars to their display price`
- `Increase display price of the 2 cheapest rooms of hotel 3 by 10 percent`
- `Set board price to 100 for room 4 in hotel 3`
- `Edit room 5 name to Deluxe Double Room`
- `Add VIP Suite to hotel 3 with default count 2`
- `Delete room 7`
- `Deactivate all rooms with no availability in hotel 3`
- `Increase all prices by 10% for all double rooms in hotel 1`

## Agent Decision Flow

For room and price actions, the active chat flow uses deterministic PMS intent
handling with an LLM fallback:

1. Parse hard user instructions such as hotel ID, room ID, quantity, ranking,
   filter, price field, and price operation.
2. Fetch live dummy-PMS rooms and price-capacity rows.
3. Filter rooms, sort deterministically when ranking is requested, and select
   the requested number of distinct rooms.
4. Expand selected rooms into executable price-capacity rows, calculate old and
   new values, and store a pending proposal with a diff.
5. Wait for Confirm before executing the PMS write.

There is no default price field in this MVP. If the user says only `price` or
`prices`, the agent asks whether to update `displayPrice`, `boardPrice`,
`payablePrice`, or `all prices` before preparing a write.

## dummy-PMS Endpoints Used

- `GET /hotels/:hotelId/rooms`
- `GET /hotels/:hotelId/rooms/:roomId`
- `POST /hotels/:hotelId/rooms`
- `PATCH /hotels/:hotelId/rooms/:roomId`
- `DELETE /hotels/:hotelId/rooms/:roomId`
- `GET /hotels/:hotelId/price-capacity`
- `POST /hotels/:hotelId/price-capacity/upsert`

`DELETE /hotels/:hotelId/rooms/:roomId` is a hard delete and also removes linked price-capacity rows in dummy-PMS.

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

## Acceptance Checks

1. `Show hotel 3 10 cheapest rooms.` renders a read-only room table and no Confirm or Reject buttons.
2. `Find two cheapest rooms in hotel 3 and add 3 dollars to their display price.` creates a price proposal with a diff table and only executes after Confirm.
3. `Increase display price of the 2 cheapest rooms of hotel 3 by 10 percent.` selects two distinct rooms, expands their current price-capacity rows, and previews old and new values.
4. `Edit room 5 name to Deluxe Double Room.` creates a room update proposal and executes only after Confirm.
5. `Add VIP Suite to hotel 3 with default count 2.` creates a room creation proposal and executes only after Confirm.
6. `Delete room 7.` creates a hard-delete proposal, warns when linked price rows exist, and executes only after Confirm.
