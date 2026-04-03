import type { AppConfig } from "@remix-run/dev";

export default {
    future: {
        v3_fetcherPersist: true,
        v3_lazyRouteDiscovery: true,
        v3_relativeSplatPath: true,
        v3_singleFetch: true,
        v3_throwAbortReason: true,
    },
} satisfies AppConfig;
