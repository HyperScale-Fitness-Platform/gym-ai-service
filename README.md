# Gym AI Service

## Overview

`gym-ai-service` is a Node.js/Express backend that exposes an AI chat endpoint under `/ai/chat`. It uses PostgreSQL to store chat sessions and messages, and forwards user messages to an external LLM API via `src/config/llm.js`.

The service is organized with a clear MVC-like pattern:

- `src/index.js` - app bootstrap, middleware, routes, error handling
- `src/routes/chat.routes.js` - route definition for `/ai/chat`
- `src/controllers/chat.controller.js` - request handling and response shaping
- `src/services/chat.service.js` - business logic, conversation state, LLM calls
- `src/models/chat.model.js` - database queries for sessions and messages
- `src/config/database.js` - PostgreSQL connection pool
- `src/config/llm.js` - external LLM HTTP client
- `src/middleware/auth.middleware.js` - attaches user metadata from request headers
- `src/middleware/errorHandler.middleware.js` - centralized error response handling
- `src/knowledge/app-knowledge.js` - system prompt / app knowledge sent to the LLM

## Architecture

1. Client sends POST request to `POST /ai/chat`
2. `auth.middleware` attaches `req.user` from headers
3. `chat.controller.chat` validates request and calls `chatService.sendMessage`
4. `chat.service` loads or creates a session and prior messages
5. `chat.service` calls the external LLM via `callLLM`
6. User and assistant messages are stored in PostgreSQL
7. The API returns `sessionId` and the assistant reply

## API Contract

### Endpoint

`POST /ai/chat`

### Request Headers

- `user-id` - required for request user identity
- `user-email` - optional
- `user-role` - optional

### Request Body

```json
{
  "sessionId": "<existing-session-id>",
  "message": "Hello, I need help with my workout plan"
}
```

- `sessionId` is optional. If omitted, the service creates a new chat session.
- `message` must be a non-empty string.

### Response

```json
{
  "sessionId": "<session-id>",
  "reply": "<assistant response>"
}
```

## Environment Setup

Create a `.env` file in the project root with the following values:

```env
PORT=4006
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=devpass
DB_NAME=gym_ai
SBG_API_KEY=<your-sbg-api-key>
LLM_BASE_URL=http://apiaccess.iti.net.eg/api/v1
LLM_MODEL_ID=openai.gpt-oss-120b-1:0
```

### Explanation

- `PORT` - port where the service listens (default `4006`)
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` - PostgreSQL connection settings
- `SBG_API_KEY` - API key used to authenticate with the LLM provider
- `LLM_BASE_URL` - base URL for the external LLM API
- `LLM_MODEL_ID` - model identifier for the LLM call

## Install Dependencies

```bash
npm ci
```

## Run Locally

Start the service in development mode:

```bash
npm run dev
```

Start in production mode:

```bash
npm start
```

The app will listen on `http://localhost:4006` by default.

## PostgreSQL with Docker

### Start a PostgreSQL container

```bash
docker run -d \
  --name gym-ai-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=devpass \
  -e POSTGRES_DB=gym_ai \
  -p 5432:5432 \
  postgres:16
```

### Verify the database is running

```bash
docker logs gym-ai-db | tail -n 20
```

### Create the schema

The schema is stored in `db.txt`.

#### Option 1: Use `docker exec`

```bash
docker cp db.txt gym-ai-db:/tmp/db.txt
docker exec -i gym-ai-db psql -U postgres -d gym_ai -f /tmp/db.txt
```

#### Option 2: Use host `psql`

```bash
PGPASSWORD=devpass psql -h localhost -U postgres -d gym_ai -f db.txt
```

### Schema Details

The database schema creates two tables:

- `chat_sessions`
  - `id` UUID primary key
  - `user_id` UUID
  - `created_at` timestamp

- `chat_messages`
  - `id` UUID primary key
  - `session_id` references `chat_sessions(id)`
  - `role` text (`user` or `assistant`)
  - `content` text
  - `created_at` timestamp

There is also an index on `chat_messages(session_id, created_at)` for efficient session history queries.

## Docker Build & Run

### Build the image

```bash
docker build -t gym-ai-service .
```

### Run the container

```bash
docker run -d \
  --name gym-ai-service \
  --env-file .env \
  -p 4006:4006 \
  gym-ai-service
```

> Note: The Dockerfile exposes port `3000`, but the app listens on the `PORT` environment variable. Be sure to bind the port you set in `.env`, such as `4006`.

## Database Configuration in Code

`src/config/database.js` builds the Postgres connection string from environment variables:

```js
postgresql://<DB_USER>:<DB_PASSWORD>@<DB_HOST>:<DB_PORT>/<DB_NAME>
```

## LLM Integration

`src/config/llm.js` sends requests to a student chat endpoint:

- `model_id` from `LLM_MODEL_ID`
- `messages` array containing prior chat history plus the current user message
- `system_prompt` from `src/knowledge/app-knowledge.js`

The response is expected to include `output_text`, which becomes the assistant reply.

## Testing

A manual test script exercises the chatbot against a fixed set of
scenarios: feature-knowledge accuracy, multi-turn memory, off-topic
handling, hallucination resistance, bad input, and session isolation.
It is not a `jest`-based automated suite — it prints results for you to
review, rather than asserting pass/fail.

### Location

tests/test-chat.js


### Prerequisites

- The service must already be running (`npm run dev` in a separate
  terminal) before running the test script, since it sends real HTTP
  requests to `http://localhost:4006`.
- `axios` must be installed (already a dependency of this service).

### Running it

```bash
node tests/test-chat.js
```

### What it covers

- Feature knowledge: booking, membership freeze, community/find-a-buddy
- Multi-turn memory: a follow-up question that only makes sense if the
  prior turn's context was retained
- Off-topic handling: an unrelated question (should redirect) and a
  general fitness question (should get a brief real answer, per the
  system prompt's rules)
- Hallucination resistance: asks about a feature that does not exist,
  checking the reply correctly says so rather than inventing steps
- Bad input: empty message, missing `message` field, wrong type, a very
  long message
- Missing identity: a request sent with no `user-id` header at all
- Session isolation: a second user attempting to continue the first
  user's `sessionId`
- Invalid session: a `sessionId` that was never created

### Reading the output

Each case prints its label, the HTTP status returned, and either the
reply text (truncated to the first 150 characters for readability) or
the error body. Review manually:

- `200` responses with a `reply` should be checked for accuracy against
  `src/knowledge/app-knowledge.js`
- `400` responses are expected for the bad-input cases
- `404` responses are expected for the session-isolation and
  invalid-session cases
- The missing-identity case should return `401` once
  `auth.middleware.js` validates the header is present — a `500` here
  indicates that check is missing or not yet deployed

### Notes

- Each successful LLM call logs its token usage and cost to the
  service's own terminal (not the test script's output) — check there
  if you want to track spend across a test run.
- Network blips to the external LLM endpoint can occasionally surface
  as a single `502` mid-run; rerun that specific case in isolation
  before treating it as a real bug.

## Important Notes

- This service trusts user identity values from request headers. In production, replace this with real authentication.
- `sessionId` must be preserved by the client to continue a conversation.
- The `/k8s` folder currently contains placeholder manifest files; they are not populated in this repository.

## Troubleshooting

- If the service cannot connect to Postgres, verify `.env` and that the DB container is running.
- If the LLM call fails, check `SBG_API_KEY`, `LLM_BASE_URL`, and whether the external API is reachable.
- Use `docker ps` to verify running containers and `docker logs` to inspect any errors.

## Useful Commands

```bash
npm ci
npm run dev
npm start
docker ps
docker logs gym-ai-db
```

