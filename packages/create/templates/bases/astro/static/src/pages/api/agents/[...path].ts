import type { APIRoute } from "astro";
import app from "../../../lib/better-agent/server";

export const ALL: APIRoute = async ({ request }) => app.handler(request);
