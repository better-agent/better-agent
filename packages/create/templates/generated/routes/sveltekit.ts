import app from "$lib/better-agent/server";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ request }) => app.handler(request);
export const POST: RequestHandler = async ({ request }) => app.handler(request);
export const PUT: RequestHandler = async ({ request }) => app.handler(request);
export const PATCH: RequestHandler = async ({ request }) => app.handler(request);
export const DELETE: RequestHandler = async ({ request }) => app.handler(request);
export const OPTIONS: RequestHandler = async ({ request }) => app.handler(request);
export const HEAD: RequestHandler = async ({ request }) => app.handler(request);
