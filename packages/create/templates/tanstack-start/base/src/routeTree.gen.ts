/* eslint-disable */
// @ts-nocheck

import { Route as rootRouteImport } from "./routes/__root";
import { Route as AgentsSplatRouteImport } from "./routes/agents/$";
import { Route as IndexRouteImport } from "./routes/index";

const IndexRoute = IndexRouteImport.update({
    id: "/",
    path: "/",
    getParentRoute: () => rootRouteImport,
} as never);
const AgentsSplatRoute = AgentsSplatRouteImport.update({
    id: "/agents/$",
    path: "/agents/$",
    getParentRoute: () => rootRouteImport,
} as never);

declare module "@tanstack/react-router" {
    interface FileRoutesByPath {
        "/": {
            id: "/";
            path: "/";
            fullPath: "/";
            preLoaderRoute: typeof IndexRouteImport;
            parentRoute: typeof rootRouteImport;
        };
        "/agents/$": {
            id: "/agents/$";
            path: "/agents/$";
            fullPath: "/agents/$";
            preLoaderRoute: typeof AgentsSplatRouteImport;
            parentRoute: typeof rootRouteImport;
        };
    }
}

export const routeTree = rootRouteImport._addFileChildren({
    IndexRoute,
    AgentsSplatRoute,
});

import type { getRouter } from "./router.tsx";
declare module "@tanstack/react-start" {
    interface Register {
        ssr: true;
        router: Awaited<ReturnType<typeof getRouter>>;
    }
}
