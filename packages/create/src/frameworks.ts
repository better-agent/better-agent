import path from "node:path";

export const frameworks = {
    nextjs: {
        label: "Next.js",
        baseUrl: "/api/agents",
        serverFile: "lib/better-agent/server.ts",
        dynamicFiles: [
            { output: ".env.example", template: "dynamic/.env.example.hbs" },
            { output: "README.md", template: "dynamic/README.md.hbs" },
            { output: "package.json", template: "dynamic/package.json.hbs" },
            {
                output: "lib/better-agent/server.ts",
                template: "dynamic/lib/better-agent/server.ts.hbs",
            },
            { output: "app/layout.tsx", template: "dynamic/app/layout.tsx.hbs" },
            { output: "app/page.tsx", template: "dynamic/app/page.tsx.hbs" },
        ],
        envMode: "node",
    },
    sveltekit: {
        label: "SvelteKit",
        baseUrl: "/api/agents",
        serverFile: "src/lib/better-agent/server.ts",
        dynamicFiles: [
            { output: ".env.example", template: "dynamic/.env.example.hbs" },
            { output: "README.md", template: "dynamic/README.md.hbs" },
            { output: "package.json", template: "dynamic/package.json.hbs" },
            {
                output: "src/lib/better-agent/server.ts",
                template: "dynamic/src/lib/better-agent/server.ts.hbs",
            },
            { output: "src/routes/+page.svelte", template: "dynamic/src/routes/+page.svelte.hbs" },
        ],
        envMode: "sveltekit-private",
    },
    remix: {
        label: "Remix",
        baseUrl: "/api/agents",
        serverFile: "app/lib/better-agent/server.ts",
        dynamicFiles: [
            { output: ".env.example", template: "dynamic/.env.example.hbs" },
            { output: "README.md", template: "dynamic/README.md.hbs" },
            { output: "package.json", template: "dynamic/package.json.hbs" },
            {
                output: "app/lib/better-agent/server.ts",
                template: "dynamic/app/lib/better-agent/server.ts.hbs",
            },
            {
                output: "app/routes/_index.tsx",
                template: "dynamic/app/routes/_index.tsx.hbs",
            },
        ],
        envMode: "node",
    },
    "tanstack-start": {
        label: "TanStack Start",
        baseUrl: "/api/agents",
        serverFile: "src/lib/better-agent/server.ts",
        dynamicFiles: [
            { output: ".env.example", template: "dynamic/.env.example.hbs" },
            { output: "README.md", template: "dynamic/README.md.hbs" },
            { output: "package.json", template: "dynamic/package.json.hbs" },
            {
                output: "src/lib/better-agent/server.ts",
                template: "dynamic/src/lib/better-agent/server.ts.hbs",
            },
            {
                output: "src/routes/index.tsx",
                template: "dynamic/src/routes/index.tsx.hbs",
            },
        ],
        envMode: "node",
    },
    "solid-start": {
        label: "SolidStart",
        baseUrl: "/api/agents",
        serverFile: "src/lib/better-agent/server.ts",
        dynamicFiles: [
            { output: ".env.example", template: "dynamic/.env.example.hbs" },
            { output: "README.md", template: "dynamic/README.md.hbs" },
            { output: "package.json", template: "dynamic/package.json.hbs" },
            {
                output: "src/lib/better-agent/server.ts",
                template: "dynamic/src/lib/better-agent/server.ts.hbs",
            },
            {
                output: "src/routes/index.tsx",
                template: "dynamic/src/routes/index.tsx.hbs",
            },
        ],
        envMode: "node",
    },
    astro: {
        label: "Astro",
        baseUrl: "/api/agents",
        serverFile: "src/lib/better-agent/server.ts",
        dynamicFiles: [
            { output: ".env.example", template: "dynamic/.env.example.hbs" },
            { output: "README.md", template: "dynamic/README.md.hbs" },
            { output: "package.json", template: "dynamic/package.json.hbs" },
            {
                output: "src/lib/better-agent/server.ts",
                template: "dynamic/src/lib/better-agent/server.ts.hbs",
            },
            {
                output: "src/components/better-agent-chat.tsx",
                template: "dynamic/src/components/better-agent-chat.tsx.hbs",
            },
            { output: "src/pages/index.astro", template: "dynamic/src/pages/index.astro.hbs" },
        ],
        envMode: "astro",
    },
    nuxt: {
        label: "Nuxt",
        baseUrl: "/api/agents",
        serverFile: "lib/better-agent/server.ts",
        dynamicFiles: [
            { output: ".env.example", template: "dynamic/.env.example.hbs" },
            { output: "README.md", template: "dynamic/README.md.hbs" },
            { output: "package.json", template: "dynamic/package.json.hbs" },
            {
                output: "lib/better-agent/server.ts",
                template: "dynamic/lib/better-agent/server.ts.hbs",
            },
            { output: "nuxt.config.ts", template: "dynamic/nuxt.config.ts.hbs" },
            { output: "app/app.vue", template: "dynamic/app/app.vue.hbs" },
        ],
        envMode: "node",
    },
} as const;

export type Framework = keyof typeof frameworks;

export const frameworkEntries = Object.entries(frameworks) as [
    Framework,
    (typeof frameworks)[Framework],
][];

export const frameworkIds = frameworkEntries.map(([framework]) => framework) as [
    Framework,
    ...Framework[],
];

export const getFramework = (framework: Framework) => frameworks[framework];

export const getBaseTemplateDir = (framework: Framework) =>
    path.resolve(import.meta.dirname, "..", "templates", "bases", framework);
