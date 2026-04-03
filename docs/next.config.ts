import path from "node:path";
import { fileURLToPath } from "node:url";
import { createMDX } from "fumadocs-mdx/next";
import type { NextConfig } from "next";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(rootDir, "..");

const withMDX = createMDX();

const nextConfig: NextConfig = {
    async rewrites() {
        return [
            {
                source: "/docs/:path*.mdx",
                destination: "/llms.mdx/docs/:path*",
            },
            {
                source: "/cookbook/:path*.mdx",
                destination: "/llms.mdx/cookbook/:path*",
            },
        ];
    },
    turbopack: {
        root: workspaceRoot,
    },
    reactStrictMode: true,
};

export default withMDX(nextConfig);
