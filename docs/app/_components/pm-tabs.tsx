"use client";

import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
import { siBun, siNpm, siPnpm } from "simple-icons";

const managers = ["npm", "pnpm", "bun"] as const;

const icons: Record<string, ReactNode> = {
    npm: (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d={siNpm.path} />
        </svg>
    ),
    pnpm: (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d={siPnpm.path} />
        </svg>
    ),
    bun: (
        <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d={siBun.path} />
        </svg>
    ),
};

const PmTabsContext = createContext("npm");

export function PmTabs({ children }: { children: ReactNode }) {
    const [active, setActive] = useState("npm");

    return (
        <div className="pm-tabs">
            <div className="pm-tabs-list" role="tablist">
                {managers.map((pm) => (
                    <button
                        key={pm}
                        type="button"
                        role="tab"
                        aria-selected={active === pm}
                        data-state={active === pm ? "active" : "inactive"}
                        className="pm-tabs-trigger"
                        onClick={() => setActive(pm)}
                    >
                        {icons[pm]}
                        <span>{pm}</span>
                    </button>
                ))}
            </div>
            <PmTabsContext.Provider value={active}>{children}</PmTabsContext.Provider>
        </div>
    );
}

export function PmTab({
    value,
    children,
}: {
    value: string;
    children: ReactNode;
}) {
    const active = useContext(PmTabsContext);
    if (active !== value) return null;
    return <>{children}</>;
}
