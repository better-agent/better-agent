/**
 * Supported HTTP methods for Better Agent routes.
 */
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";

/**
 * Path params extracted from a matched route.
 */
export type RouteParams = Record<string, string>;

/**
 * Context passed to a route handler.
 */
export interface RouteContext<P extends RouteParams = RouteParams> {
    request: Request;
    path: string;
    params: P;
    query: URLSearchParams;
}

/**
 * One route entry in the server router.
 */
export interface RouteEntry<Path extends string = string> {
    method: HttpMethod;
    pattern: Path;
    public?: boolean;
    handler(ctx: RouteContext<ParamsFromPath<Path>>): Response | Promise<Response>;
}

/**
 * Route table consumed by the router.
 */
export type RouteTable = RouteEntry[];

/**
 * Successful route match for one method and path.
 */
export interface RouteMatch {
    route: RouteEntry;
    params: RouteParams;
}

/**
 * Route match for a path regardless of method.
 */
export interface RoutePathMatch {
    params: RouteParams;
    methods: HttpMethod[];
    route: RouteEntry;
}

/**
 * Method-aware router used by the built-in server.
 */
export interface Router {
    readonly routes: RouteTable;
    match(method: HttpMethod, path: string): RouteMatch | null;
    matchPath(path: string): RoutePathMatch | null;
}

/**
 * Defines one typed route entry.
 */
export const defineRoute = <const P extends string>(route: RouteEntry<P>): RouteEntry<P> => route;

/**
 * Matches a URL path against a route pattern.
 */
export const matchRoutePath = (pattern: string, path: string): RouteParams | null => {
    const routeParts = pattern.split("/").filter(Boolean);
    const pathParts = path.split("/").filter(Boolean);
    if (routeParts.length !== pathParts.length) {
        return null;
    }

    const params: RouteParams = {};
    for (let index = 0; index < routeParts.length; index += 1) {
        const expected = routeParts[index];
        const actual = pathParts[index];
        if (expected === undefined || actual === undefined) {
            return null;
        }

        if (expected.startsWith(":")) {
            params[expected.slice(1)] = actual;
            continue;
        }

        if (expected !== actual) {
            return null;
        }
    }

    return params;
};

/**
 * Creates a simple method-aware router from a route table.
 */
export const createRouter = (routes: RouteTable): Router => ({
    routes,
    match(method, path) {
        for (const route of routes) {
            if (route.method !== method) {
                continue;
            }

            const params = matchRoutePath(route.pattern, path);
            if (params) {
                return { route, params };
            }
        }

        return null;
    },
    matchPath(path) {
        const methods: HttpMethod[] = [];
        let firstMatch: { route: RouteEntry; params: RouteParams } | null = null;

        for (const route of routes) {
            const params = matchRoutePath(route.pattern, path);
            if (!params) {
                continue;
            }

            methods.push(route.method);
            if (!firstMatch) {
                firstMatch = { route, params };
            }
        }

        return firstMatch ? { ...firstMatch, methods } : null;
    },
});

type ExtractParamKeys<Path extends string> = Path extends `${string}:${infer Param}/${infer Rest}`
    ? Param | ExtractParamKeys<`/${Rest}`>
    : Path extends `${string}:${infer Param}`
      ? Param
      : never;

type ParamsFromPath<Path extends string> = {
    [K in ExtractParamKeys<Path>]: string;
};
