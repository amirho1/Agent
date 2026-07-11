# Agent

Agent is a Next.js MVP for chat-driven Lamasoo rate-plan price updates. Users can type a rate sheet request or upload a Markdown rate sheet, review the exact Lamasoo update payload, and then confirm or reject the proposal.

## MVP Flow

- Create or open a chat.
- Type a rate-plan price update request, or upload a `.md` / `.txt` rate sheet.
- The agent parses hotel, bundle/title, date range, rooms, rate plans, and explicit core price fields.
- The server fetches live Lamasoo hotels, room type providers, rate plans, and bundle prices.
- The proposal diff shows hotel and room/rate-plan IDs, old prices when available, new prices, row issues, and the exact JSON payload.
- Confirm executes the Lamasoo upsert after a current-value conflict check; Reject records a no-write rejection.

Only `boardPrice`, `displayPrice`, and `payablePrice` are executable in this MVP. Extra guest, child price, capacity, and constraint fields are ignored with warnings.

## Environment

Copy `.env.example` to `.env.local` or `.env` and set:

```env
DATABASE_URL=file:./dev.db
LAMASOO_BASE_URL=https://whale.lamasoo.com/
AUTHORIZATION=<JWT_BEARER_TOKEN>
```

The token is sent as `Authorization: Bearer <token>`. Hotel-scoped Lamasoo calls also include the `hotel-id` header.

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

## Lamasoo Endpoints Used

- `GET /api/exchange/hotels`
- `GET /api/exchange/room-type-providers`
- `GET /api/exchange/rate-plans`
- `GET /api/bundle`
- `GET /api/bundle/{bundleId}`
- `POST /api/exchange/price-capacity/upsert`

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Acceptance Checks

1. Uploading `docs/arwerk-test-rate-sheet.md` parses the metadata and rows, converts Jalali dates, and creates a review proposal.
2. A row with generic `price` instead of `boardPrice`, `displayPrice`, or `payablePrice` creates a clarification proposal with zero executable items.
3. Unmatched hotels, bundles, rooms, or rate plans do not guess IDs and keep Confirm disabled.
4. Confirm re-fetches bundle prices before calling Lamasoo.
5. Reject records a rejection and never calls Lamasoo.
