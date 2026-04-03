import app from "../../../better-agent/server";

export const dynamic = "force-dynamic";

const handle = async (request: Request): Promise<Response> => app.handler(request);

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
export const HEAD = handle;
