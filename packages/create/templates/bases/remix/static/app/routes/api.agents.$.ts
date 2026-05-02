import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import app from "../lib/better-agent/server";

export const loader = async ({ request }: LoaderFunctionArgs) => app.handler(request);

export const action = async ({ request }: ActionFunctionArgs) => app.handler(request);
