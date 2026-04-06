"use client";

import { RootProvider } from "fumadocs-ui/provider/next";
import type { ReactNode } from "react";

export default function Providers({ children }: { children: ReactNode }) {
    return <RootProvider search={{ preload: false }}>{children}</RootProvider>;
}
