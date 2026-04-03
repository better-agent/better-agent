import type { APIRoute } from "astro";
import app from "../../better-agent/server";

export const ALL: APIRoute = async ({ request }) => app.handler(request);
