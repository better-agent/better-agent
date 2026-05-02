import { createFileRoute } from "@tanstack/react-router";
import app from "@/lib/better-agent/server";

export const Route = createFileRoute("/api/agents/$")({
  server: {
    handlers: {
      GET: ({ request }) => app.handler(request),
      POST: ({ request }) => app.handler(request),
      PUT: ({ request }) => app.handler(request),
      PATCH: ({ request }) => app.handler(request),
      DELETE: ({ request }) => app.handler(request),
      OPTIONS: ({ request }) => app.handler(request),
      HEAD: ({ request }) => app.handler(request),
    },
  },
});
