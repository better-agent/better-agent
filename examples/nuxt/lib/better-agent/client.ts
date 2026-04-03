import { createClient } from "@better-agent/client";
import type app from "./server";

export const client = createClient<typeof app>({
    baseURL: "/api/agents",
    secret: "your-secret-here",
});
