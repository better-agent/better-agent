import { withDocs } from "@farming-labs/next/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    reactStrictMode: true,
    turbopack: {
        root: import.meta.dirname,
    },
};

export default withDocs(nextConfig);
