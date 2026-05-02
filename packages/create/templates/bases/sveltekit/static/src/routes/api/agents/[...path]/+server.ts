import app from "$lib/better-agent/server";
import type { RequestHandler } from "./$types";

const handle: RequestHandler = async ({ request }) => app.handler(request);

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
export const HEAD = handle;
