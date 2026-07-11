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
LOG_DIR=./logs
LOG_LEVEL=info
LAMASOO_BASE_URL=https://whale.lamasoo.com/
AUTHORIZATION=<JWT_BEARER_TOKEN>
EXCHANGE_AUTHORIZATION=<LAMASOO_EXCHANGE_TOKEN>
```

For Lamasoo exchange APIs, `EXCHANGE_AUTHORIZATION` is sent as `exchange-authorization: <token>`. Bundle/current-price APIs use `AUTHORIZATION` as `Authorization: Bearer <token>`. If `EXCHANGE_AUTHORIZATION` is omitted, the app falls back to `AUTHORIZATION`, but Lamasoo may reject a CRS/web JWT with `user not found`. Hotel-scoped calls also include the `hotel-id` header.

## Logging

The server writes structured JSON logs to `LOG_DIR` with daily rotation:

- `app-YYYY-MM-DD.log`
- `access-YYYY-MM-DD.log`
- `error-YYYY-MM-DD.log`

Development console logs are pretty-printed. Production defaults to `/logs` when `LOG_DIR` is not set, so mount that directory as persistent storage in your runtime if you run the app in containers.

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
