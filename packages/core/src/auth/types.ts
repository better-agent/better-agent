export interface AuthContext {
    subject: string;
    tenant?: string;
    scopes?: readonly string[];
    claims?: Record<string, unknown>;
}

export type AuthResolver = (ctx: { request: Request }) =>
    | AuthContext
    | null
    | Promise<AuthContext | null>;
