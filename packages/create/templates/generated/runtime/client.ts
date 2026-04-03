import { createClient } from "@better-agent/client";
import type app from "./server";

export const client = createClient<typeof app>({
    baseURL: "__BASE_URL__",
    secret: __CLIENT_SECRET__,
});
