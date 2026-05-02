import { BetterAgentError } from "@better-agent/shared/errors";
import type { AnyDefinedAgent } from "../agent/types";
import type { BetterAgentConfig } from "../app/types";
import type { AuthContext } from "./types";

export async function resolveAuth(
    config: Pick<BetterAgentConfig, "auth">,
    request: Request,
): Promise<AuthContext | null> {
    return (await config.auth?.({ request })) ?? null;
}

export function throwUnauthorized(message = "Authentication required."): never {
    throw BetterAgentError.fromCode("UNAUTHORIZED", message, {
        status: 401,
        title: "Unauthorized",
    });
}

export function throwForbidden(message = "Forbidden."): never {
    throw BetterAgentError.fromCode("FORBIDDEN", message, {
        status: 403,
        title: "Forbidden",
    });
}

export async function assertAgentAccess(input: {
    agent: AnyDefinedAgent;
    auth: AuthContext | null;
    request: Request;
    hasAppAuth: boolean;
}): Promise<void> {
    const access = input.agent.access ?? (input.hasAppAuth ? "authenticated" : "public");
    const allowed =
        access === "public"
            ? true
            : access === "authenticated"
              ? Boolean(input.auth)
              : await access({
                    auth: input.auth,
                    agentName: input.agent.name,
                    request: input.request,
                });

    if (allowed) {
        return;
    }

    if (!input.auth) {
        throwUnauthorized();
    }

    throwForbidden();
}

export function resolveDefaultScope(auth: AuthContext): string {
    return auth.tenant
        ? `tenant:${auth.tenant}:subject:${auth.subject}`
        : `subject:${auth.subject}`;
}
