# Better Agent Next.js Daytona Example

This app was bootstrapped with the official `create-next-app` CLI and then wired to Better Agent with the Daytona sandbox plugin.

## Included

- `src/app/page.tsx`: chat UI for sandbox-oriented prompts
- `src/app/agents/[...path]/route.ts`: Better Agent route mounted at `/agents`
- `src/better-agent/server.ts`: Better Agent app definition using `createDaytonaSandboxClient`
- `src/better-agent/client.ts`: typed client for the generated app

## Setup

1. Install dependencies.
2. Copy `.env.example` to `.env.local`.
3. Fill in your model provider keys and Daytona settings.
4. Run `npm run dev`.

## Environment

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `XAI_API_KEY`
- `BETTER_AGENT_SECRET`
- `DAYTONA_API_KEY`
- `NEXT_PUBLIC_DEFAULT_AGENT` optional, defaults to `openai`
- `DAYTONA_API_URL` optional
- `DAYTONA_TARGET` optional
- `DAYTONA_TEMPLATE` defaults to `node:20`
- `DAYTONA_TEMPLATE_KIND` optional; set it explicitly for custom templates, usually `snapshot` for named snapshots and `image` for image refs like `node:20`
- `DAYTONA_TIMEOUT_MS` optional, defaults to `180000`
- `DAYTONA_PUBLIC` defaults to `false`

## Try It

Ask the agent to:

- create a Daytona sandbox and run `node -v`
- write a small script inside the sandbox and execute it
- start an HTTP server and return a preview URL
