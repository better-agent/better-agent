import type { APIEvent } from "@solidjs/start/server";
import app from "../../../better-agent/server";

const handle = async (event: APIEvent) => app.handler(event.request);

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
export const HEAD = handle;
